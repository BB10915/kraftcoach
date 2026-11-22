// Coach-Chat: Kontext bauen, KI fragen, Antwort prüfen. Ohne KI: einfache Befehle lokal verstehen.

import { EXERCISES, getEx } from '../data/exercises.js';
import { profileText } from '../data/profile.js';
import { nutritionTargets, targetsText } from '../logic/daycoach.js';
import { workSets } from '../logic/history.js';
import { generateJson, AiError } from './gemini.js';
import { validate } from './schema.js';
import { ACTION_DOC, ACTION_TYPES, parseLocalCommand } from './chatactions.js';
import { fmtNum, fmtClock } from '../util.js';

export const CHAT_SCHEMA = {
  type: 'object',
  required: ['antwort', 'aktionen'],
  properties: {
    antwort: { type: 'string', maxLength: 1500 },
    aktionen: {
      type: 'array', maxItems: 6,
      items: {
        type: 'object', required: ['typ'],
        properties: {
          typ: { type: 'string', enum: ACTION_TYPES },
          zahl: { type: 'number' },
          zahl2: { type: 'number' },
          id: { type: 'string' },
          alt: { type: 'string' },
          text: { type: 'string', maxLength: 200 },
        },
      },
    },
  },
};

const SYSTEM = `Du bist "Coach", der freundliche KI-Trainingscoach in der App KraftCoach. Der Nutzer chattet mit dir – oft mitten im Training, also antworte KURZ (meist 1–4 Sätze, bei Wissensfragen höchstens ca. 120 Wörter), auf Deutsch, per du, ohne Markdown-Überschriften.
Themen: Training, Technik, Übungen, Pausen, Progression, Regeneration, Ernährung, Supplements, Motivation, die App selbst.
App ändern: Wenn der Nutzer DEUTLICH sagt, dass etwas geändert werden soll ("stell die Pause auf 2 Minuten", "heute nur 40 Minuten", "tausch Bankdrücken gegen Kurzhantel"), trage passende Einträge in "aktionen" ein. Bei bloßen Fragen ("ist 2 Minuten Pause besser?") KEINE Aktion – biete die Änderung höchstens an. Nenne in "antwort" kurz, was du geändert hast. Erfinde keine Aktionstypen. Übungs-ids nur aus dem KATALOG.
Mögliche aktionen (typ: Bedeutung):
${Object.entries(ACTION_DOC).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
Alles andere (z. B. Sätze nachträglich ändern, Daten löschen, API-Schlüssel) kann nur der Nutzer selbst in der App – sag ihm, wo.
Supplements: sachlich und evidenzbasiert (z. B. Kreatin-Monohydrat 3–5 g täglich gut belegt; Koffein ca. 3 mg/kg vor dem Training; vieles andere schwach belegt). Keine Dosierungen über üblichen Empfehlungen. Bei unter 18-Jährigen: keine Koffein- oder Pre-Workout-Empfehlung. Bei Medikamenten, Vorerkrankungen, Schwangerschaft: Arzt oder Apotheke fragen.
Gesundheit: Keine Diagnosen. Bei Schmerzen (stechend, einschießend, Gelenk) zum Abbrechen der Übung raten und bei Anhalten ärztlich abklären lassen; bei Brustschmerz, Atemnot, Schwindel sofort aufhören und Hilfe holen.
Nutze die Daten unten (Profil, laufendes Training, Leistungen), um persönlich zu antworten. Wenn du etwas nicht weißt, sag es.`;

/** Kompakter Stand der App für die KI (wird jeder Frage frisch mitgegeben). */
export function chatContext({ settings, session = null, sets = [], doneCount = () => 0, now = Date.now() }) {
  const p = settings.profile, t = settings.training;
  const L = [];
  const d = new Date(now);
  L.push(`JETZT: ${d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr`);
  L.push(`\nPROFIL\n${profileText(p)}`);
  L.push(`\nEINSTELLUNGEN: Standarddauer ${t.defaultMin} Min, Pause Grundübung ${t.restCompound} s, Pause Isolation ${t.restIsolation} s, Aufwärmen ${p.warmupMin} Min, Finisher ${p.finisher ? 'an' : 'aus'}, Ton ${t.sound ? 'an' : 'aus'}, Vibration ${t.vibrate ? 'an' : 'aus'}, Bildschirm an ${t.wakeLock ? 'ja' : 'nein'}, Anleitungs-Vorschläge ${t.guideHints !== false ? 'an' : 'aus'}`);

  if (session) {
    const active = session.status === 'active';
    const head = active
      ? `TRAINING LÄUFT: "${session.title}", Budget ${session.budgetMin} Min, seit ${fmtClock((now - (session.startedAt ?? now)) / 1000)}${session.rest ? `, Pause läuft noch ${Math.max(0, Math.round((session.rest.endAt - now) / 1000))} s` : ''}`
      : `HEUTE GEPLANT (noch nicht gestartet): "${session.title}", Budget ${session.budgetMin} Min`;
    const items = session.items.map((i) => {
      const ex = getEx(i.exerciseId);
      const cur = active && i.uid === session.currentUid ? ' ← AKTUELL' : '';
      const st = i.status === 'open' ? '' : ` [${i.status === 'done' ? 'erledigt' : 'gestrichen'}]`;
      if (i.kind === 'timed') return `- ${i.exerciseId} (${ex.name}): ${i.minutes} Min${st}${cur}`;
      return `- ${i.exerciseId} (${ex.name}): ${doneCount(i.uid)}/${i.sets} Sätze, ${i.repsMin}–${i.repsMax} Wdh., RIR ${i.rir}, Pause ${i.restSec} s${st}${cur}`;
    });
    L.push(`\n${head}\n${items.join('\n') || '- noch keine Übungen'}`);
    if (active) {
      const today = workSets(sets).filter((x) => x.sessionId === session.id).slice(-6);
      if (today.length) L.push(`Letzte Sätze heute: ${today.map((x) => `${getEx(x.exerciseId).name} ${fmtNum(x.weight)}×${x.reps} RIR ${x.rir}`).join('; ')}`);
    }
  } else L.push('\nHEUTE: noch kein Training geplant.');

  const recent = workSets(sets).filter((x) => x.sessionId !== session?.id).slice(-40);
  if (recent.length) {
    const best = new Map();
    for (const x of recent) {
      const b = best.get(x.exerciseId);
      if (!b || x.weight > b.weight || (x.weight === b.weight && x.reps > b.reps)) best.set(x.exerciseId, x);
    }
    L.push(`\nLETZTE LEISTUNGEN (Top-Satz): ${[...best.values()].map((x) => `${getEx(x.exerciseId).name} ${fmtNum(x.weight)}×${x.reps}`).join('; ')}`);
  }
  L.push(`\nTAGESZIELE: ${targetsText(nutritionTargets(p, { trainingMin: session?.budgetMin ?? t.defaultMin }))}`);
  L.push(`\nKATALOG (id | Name): ${EXERCISES.filter((e) => p.equipment.includes(e.eq)).map((e) => `${e.id} | ${e.name}`).join('; ')}`);
  return L.join('\n');
}

/** Antwort der KI prüfen; unbrauchbare Aktionen werden verworfen. */
export function cleanReply(raw) {
  if (!raw || typeof raw.antwort !== 'string') throw new AiError('invalid', 'Die KI-Antwort war unvollständig.');
  const acts = Array.isArray(raw.aktionen) ? raw.aktionen.filter((a) => !validate(CHAT_SCHEMA.properties.aktionen.items, a).length) : [];
  return { text: raw.antwort.trim(), actions: acts };
}

/**
 * Eine Chat-Nachricht beantworten.
 * @returns {{ text, actions, source: 'ai'|'local', error?: AiError }}
 */
export async function askCoach({ message, history = [], settings, session, sets, doneCount }) {
  const local = (err) => {
    const actions = parseLocalCommand(message, { hasSession: !!session, active: session?.status === 'active' });
    if (actions) return { text: 'Mache ich:', actions, source: 'local', error: err };
    const why = !settings.ai.apiKey
      ? 'Für freie Fragen (z. B. zu Supplements oder Technik) braucht der Chat deinen KI-Schlüssel – unter Einstellungen → KI.'
      : `Die KI ist gerade nicht erreichbar: ${err?.message ?? ''}`;
    return { text: `${why}\nOhne KI verstehe ich einfache Befehle wie „Pause 2 Minuten“, „heute nur 40 Minuten“, „4 Sätze“ oder „Ton aus“.`, actions: [], source: 'local', error: err };
  };
  if (!settings.ai.apiKey || !settings.ai.enabled) return local(null);
  const prompt = `${chatContext({ settings, session, sets, doneCount })}\n\nNACHRICHT DES NUTZERS:\n${message}`;
  try {
    const raw = await generateJson({ apiKey: settings.ai.apiKey, model: settings.ai.model, system: SYSTEM, prompt, schema: CHAT_SCHEMA, history: history.slice(-10) });
    return { ...cleanReply(raw), source: 'ai' };
  } catch (e) {
    return local(e instanceof AiError ? e : new AiError('server', String(e?.message ?? e)));
  }
}
