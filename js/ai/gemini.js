// Anbindung an die Google Gemini API (Gratis-Stufe). Der Schlüssel kommt nur aus den lokalen Einstellungen.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const TIMEOUT_MS = 45000;

export class AiError extends Error {
  constructor(kind, message, { retryAfterSec = null, detail = '' } = {}) {
    super(message);
    this.kind = kind; // 'nokey' | 'offline' | 'rate-minute' | 'rate-day' | 'key' | 'model' | 'server' | 'timeout' | 'invalid' | 'blocked'
    this.retryAfterSec = retryAfterSec;
    this.detail = detail;
  }
}

// ---------- Nutzungszähler (nur lokal, zur Orientierung) ----------
const USAGE_KEY = 'kc-ai-usage';
function readUsage() {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY)) ?? { day: '', count: 0, recent: [] };
  } catch {
    return { day: '', count: 0, recent: [] };
  }
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function usageToday() {
  const u = readUsage();
  return u.day === today() ? u.count : 0;
}
function recordUsage() {
  const u = readUsage();
  const now = Date.now();
  const next = {
    day: today(),
    count: u.day === today() ? u.count + 1 : 1,
    recent: [...(u.recent ?? []).filter((t) => now - t < 60000), now],
  };
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
/** Eigene Bremse: höchstens 4 Anfragen pro Minute aus der App. */
function localThrottle() {
  const u = readUsage();
  const now = Date.now();
  const recent = (u.recent ?? []).filter((t) => now - t < 60000);
  if (recent.length >= 4) {
    const wait = Math.ceil((60000 - (now - recent[0])) / 1000);
    throw new AiError('rate-minute', `Bitte kurz warten (${wait} s) – Schutz vor dem Minutenlimit.`, { retryAfterSec: wait });
  }
}

// ---------- Fehler verständlich machen ----------
function parseRetry(details = []) {
  const ri = details.find((d) => String(d['@type'] ?? '').includes('RetryInfo'));
  const m = /([\d.]+)s/.exec(ri?.retryDelay ?? '');
  return m ? Math.ceil(parseFloat(m[1])) : null;
}

export function errorFrom(status, body) {
  const e = body?.error ?? {};
  const msg = e.message ?? '';
  const details = e.details ?? [];
  const reasons = details.map((d) => d.reason).filter(Boolean).join(',');
  if (status === 429) {
    const quotaIds = JSON.stringify(details);
    const perDay = /PerDay/i.test(quotaIds) || /per day/i.test(msg);
    const retry = parseRetry(details);
    return perDay
      ? new AiError('rate-day', 'Tageslimit der Gratis-Stufe erreicht. Morgen geht es wieder – heute plant die App lokal.', { retryAfterSec: retry, detail: msg })
      : new AiError('rate-minute', `Zu viele Anfragen pro Minute.${retry ? ` In ${retry} s erneut versuchen.` : ' Kurz warten und erneut versuchen.'}`, { retryAfterSec: retry ?? 30, detail: msg });
  }
  if (/API_KEY_INVALID|API key not valid/i.test(reasons + msg)) return new AiError('key', 'Der API-Schlüssel ist ungültig. Bitte in den Einstellungen prüfen.', { detail: msg });
  if (status === 403) return new AiError('key', 'Zugriff verweigert. Ist der Schlüssel aktiv und die Gemini API für das Projekt freigeschaltet?', { detail: msg });
  if (status === 404) return new AiError('model', 'Dieses Modell gibt es nicht (mehr). Bitte in den Einstellungen eine andere Modell-ID wählen.', { detail: msg });
  if (status === 400 && /location|region|country/i.test(msg)) return new AiError('key', 'Die Gemini API ist in deiner Region für diesen Schlüssel nicht verfügbar.', { detail: msg });
  if (status === 400) return new AiError('invalid', 'Die Anfrage wurde abgelehnt.', { detail: msg });
  if (status >= 500) return new AiError('server', 'Google-Server gerade überlastet. Später noch einmal versuchen.', { retryAfterSec: 20, detail: msg });
  return new AiError('server', `Unerwarteter Fehler (${status}).`, { detail: msg });
}

// ---------- Anfrage ----------
async function post(url, apiKey, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new AiError('timeout', 'Die KI hat zu lange gebraucht (Zeitüberschreitung).');
    throw new AiError('offline', 'Keine Verbindung zur KI (offline?).');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fragt Gemini nach einer JSON-Antwort.
 * @returns {Promise<any>} geparstes JSON (noch nicht gegen das Schema geprüft)
 */
export async function generateJson({ apiKey, model, system, prompt, schema }) {
  if (!apiKey) throw new AiError('nokey', 'Kein API-Schlüssel hinterlegt.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('offline', 'Du bist offline.');
  localThrottle();
  const url = `${BASE}${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
  };
  recordUsage();
  let res = await post(url, apiKey, body);
  let data = await res.json().catch(() => null);

  // Manche Modelle kennen responseJsonSchema evtl. nicht -> einmal ohne Schema (steht dann im Prompt).
  if (res.status === 400 && /responseJsonSchema|response_json_schema|schema/i.test(data?.error?.message ?? '')) {
    body.generationConfig = { responseMimeType: 'application/json' };
    body.contents[0].parts[0].text = `${prompt}\n\nAntworte ausschließlich mit JSON nach diesem Schema:\n${JSON.stringify(schema)}`;
    recordUsage();
    res = await post(url, apiKey, body);
    data = await res.json().catch(() => null);
  }
  if (!res.ok) throw errorFrom(res.status, data);

  const cand = data?.candidates?.[0];
  if (!cand) {
    const block = data?.promptFeedback?.blockReason;
    throw new AiError('blocked', block ? `Anfrage blockiert (${block}).` : 'Leere Antwort der KI.');
  }
  const text = (cand.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  if (cand.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(cand.finishReason) && !text)
    throw new AiError('blocked', `Antwort abgebrochen (${cand.finishReason}).`);
  try {
    return JSON.parse(stripFences(text));
  } catch {
    throw new AiError('invalid', 'Die KI-Antwort war kein gültiges JSON.', { detail: text.slice(0, 300) });
  }
}

function stripFences(t) {
  return t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
}

/** Minimaler Verbindungstest (1 kleine Anfrage). */
export async function testConnection({ apiKey, model }) {
  const r = await generateJson({
    apiKey, model,
    system: 'Antworte knapp.',
    prompt: 'Antworte mit {"ok": true}.',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });
  return r?.ok === true;
}
