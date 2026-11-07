// KI-Tagesplan: Prompt bauen, Antwort prüfen, in Übungen umwandeln, ins Zeitbudget einpassen.

import { EXERCISES, EX, MUSCLES, PATTERNS, EQUIPMENT, getEx } from '../data/exercises.js';
import { muscleStatus, prevSessionsFor, workSets } from '../logic/history.js';
import { makeItem, planLocal } from '../logic/planner.js';
import { fitToBudget } from '../logic/timing.js';
import { setE1rm } from '../logic/e1rm.js';
import { validate } from './schema.js';
import { generateJson, AiError } from './gemini.js';
import { fmtNum, clamp } from '../util.js';
import { goalsText, checkinText, REGIONS } from '../data/goals.js';

const H = 3600000;

export function planSchema(allowedIds, cardioIds) {
  const int = (min, max) => ({ type: 'integer', minimum: min, maximum: max });
  return {
    type: 'object',
    required: ['titel', 'begruendung', 'aufwaermen', 'uebungen', 'finisher'],
    properties: {
      titel: { type: 'string', maxLength: 60 },
      begruendung: { type: 'string', maxLength: 400 },
      aufwaermen: {
        type: 'object', required: ['minuten', 'inhalt'],
        properties: { minuten: int(0, 10), inhalt: { type: 'string', maxLength: 200 } },
      },
      uebungen: {
        type: 'array', minItems: 2, maxItems: 9,
        items: {
          type: 'object',
          required: ['id', 'saetze', 'wdhMin', 'wdhMax', 'zielRir', 'pauseSek'],
          properties: {
            id: { type: 'string', enum: allowedIds },
            saetze: int(1, 6),
            wdhMin: int(1, 30),
            wdhMax: int(1, 30),
            zielRir: int(0, 4),
            pauseSek: int(30, 300),
            hinweis: { type: 'string', maxLength: 140 },
          },
        },
      },
      finisher: {
        type: 'object', required: ['id', 'minuten', 'inhalt'],
        properties: { id: { type: 'string', enum: cardioIds }, minuten: int(0, 12), inhalt: { type: 'string', maxLength: 160 } },
      },
    },
  };
}

const SYSTEM = `Du bist ein erfahrener Krafttrainer und planst EINE Trainingseinheit im Fitnessstudio.
Regeln:
- Wähle Übungen NUR über ihre id aus dem Katalog.
- Muskeln mit niedriger Erholung (< 60 %) heute schonen; gut erholte und in dieser Woche wenig trainierte Muskeln bevorzugen.
- Reihenfolge: schwere Grundübungen zuerst, dann ergänzende Grundübungen, dann Isolationsübungen.
- Grundübungen meist 3–4 Sätze, 5–10 Wdh., Ziel-RIR 2, Pause 120–180 s. Isolation 2–3 Sätze, 10–15 Wdh., RIR 1–2, Pause 60–90 s.
- Die Einheit muss ins Zeitbudget passen. Faustregel inkl. Aufbau und Aufwärmsätzen: Grundübung mit 3 Sätzen ≈ 10–12 Min, Isolationsübung mit 3 Sätzen ≈ 6 Min.
- Aufwärmen (Beweglichkeit) ca. 5 Min passend zu den Übungen. Finisher = kurzer Konditionsblock (5–8 Min); bei weniger als 40 Min Budget minuten = 0.
- Bewegungsmuster bei Hauptübungen gelegentlich variieren, aber bekannte Übungen für den Fortschritt öfter wiederholen.
- Richte Wiederholungsbereiche, Volumen und Finisher an den ZIELEN aus (z. B. Stärker werden: Hauptübungen 4–6 Wdh.; Muskelaufbau: 6–12 Wdh.; Fitter werden/Fett abbauen: längerer Finisher; Beweglicher/Gesund: längeres Mobility-Aufwärmen).
- TAGESFORM beachten: Bei niedriger Energie oder schlechtem Schlaf weniger Sätze und Ziel-RIR +1. Muskelkater-Bereiche nur leicht belasten. SCHMERZ-Bereiche komplett meiden. Bei guter Form darf es etwas mehr sein. Einen Wunsch (z. B. Fokus Oberkörper) umsetzen, wenn die Erholung es erlaubt.
- Erwähne in der begruendung kurz, wie du Ziele und Tagesform berücksichtigt hast.
- Schreibe auf Deutsch, Hinweise kurz (Technik, Tempo, Fokus).`;

/** Kompakte Zusammenfassung der Historie für den Prompt (spart Tokens). */
export function buildPrompt({ settings, sessions, sets, budgetMin, now = Date.now(), checkin = null }) {
  const p = settings.profile;
  const bw = p.bodyweight || 80;
  // Übungen für Schmerzbereiche gar nicht erst anbieten.
  const painM = new Set((checkin?.pain ?? []).flatMap((r) => REGIONS[r]?.muscles ?? []));
  const allowed = EXERCISES.filter((e) => p.equipment.includes(e.eq) && !e.primary.some((m) => painM.has(m)));
  const status = muscleStatus(sets, now);
  const done = sessions.filter((s) => s.status === 'done');

  const recovery = Object.entries(status)
    .map(([m, o]) => `${MUSCLES[m]}: ${o.last ? `zuletzt vor ${Math.round(o.hours)} h` : 'noch nie'}, 7 Tage ${fmtNum(o.sets7d)} Sätze, Erholung ${Math.round(o.readiness * 100)} %`)
    .join('\n');

  const last3 = done.slice(-3).reverse().map((s) => {
    const ids = [...new Set(sets.filter((x) => x.sessionId === s.id).map((x) => x.exerciseId))];
    const days = Math.round((now - (s.startedAt ?? new Date(s.date).getTime())) / (24 * H));
    return `vor ${days} Tagen: ${ids.map((i) => getEx(i).name).join(', ') || '–'}`;
  }).join('\n') || 'keine';

  const since = now - 42 * 24 * H;
  const recentIds = [...new Set(workSets(sets).filter((s) => s.ts >= since).map((s) => s.exerciseId))];
  const perf = recentIds.map((id) => {
    const ex = getEx(id);
    if (ex.timed) return null;
    const ps = prevSessionsFor(id, sets, { bodyweight: bw })[0];
    if (!ps) return null;
    const top = ps.sets.reduce((a, s) => (setE1rm(ex, s, bw) > setE1rm(ex, a, bw) ? s : a));
    const days = Math.round((now - ps.date) / (24 * H));
    return `${id}: ${fmtNum(top.weight)} kg × ${top.reps} @RIR ${top.rir >= 4 ? '4+' : top.rir} (vor ${days} T.)`;
  }).filter(Boolean).join('\n') || 'noch keine';

  const baselines = Object.entries(p.baselines ?? {})
    .map(([id, b]) => `${id}: ${fmtNum(b.weight)} kg × ${b.reps} (selbst angegeben, sauber geschafft)`)
    .join('\n') || 'keine';

  const calib = done.length < 3 && !Object.keys(p.baselines ?? {}).length
    ? `Kalibrierungsphase (${done.length} von 3 Einheiten): Startgewichte werden noch ermittelt. Bevorzuge gut dosierbare Grundübungen, Wdh. eher 8–12, Ziel-RIR 2–3.`
    : 'Kalibrierung abgeschlossen.';

  const catalog = allowed.map((e) => `${e.id} | ${e.name} | ${PATTERNS[e.pattern]?.label ?? e.pattern} | ${e.primary.map((m) => MUSCLES[m]).join('/') || e.kind}`).join('\n');

  const prompt = `ZEITBUDGET: ${budgetMin} Minuten (gesamt, inkl. Aufwärmen und Finisher)

PROFIL
Ziele: ${goalsText(p)}
Erfahrung: ${p.experience}
Training: ${p.daysPerWeek}× pro Woche
Ausrüstung: ${p.equipment.map((e) => EQUIPMENT[e]).join(', ')}
Hinweise/Einschränkungen: ${p.notes || 'keine'}
${calib}
Einheiten in den letzten 7 Tagen: ${done.filter((s) => now - (s.startedAt ?? 0) < 7 * 24 * H).length}

TAGESFORM (Check-in vor dem Training)
${checkinText(checkin)}

ERHOLUNG JE MUSKEL
${recovery}

LETZTE EINHEITEN
${last3}

LETZTE LEISTUNGEN (Top-Satz)
${perf}

STARTWERTE AUS DER EINRICHTUNG
${baselines}

KATALOG (id | Name | Muster | Hauptmuskeln)
${catalog}`;

  return {
    prompt,
    allowedIds: allowed.filter((e) => !e.timed).map((e) => e.id),
    cardioIds: allowed.filter((e) => e.kind === 'cardio').map((e) => e.id),
  };
}

/** Prüft die KI-Antwort und macht daraus Plan-Einträge. Wirft bei Unbrauchbarkeit. */
export function convertPlan(raw, { settings, budgetMin, allowedIds, cardioIds }) {
  const errs = validate(planSchema(allowedIds, cardioIds), raw);
  // Unbekannte Übungen tolerieren wir (werden verworfen), alles andere ist ein harter Fehler.
  const hard = errs.filter((e) => !/\.id: Wert nicht erlaubt/.test(e));
  if (hard.length) throw new AiError('invalid', 'Die KI-Antwort passt nicht zum Schema.', { detail: hard.slice(0, 5).join('; ') });

  const items = [];
  const wu = raw.aufwaermen;
  if (wu && wu.minuten > 0) items.push(makeItem('m-aufwaermen', settings, { role: 'warmup', minutes: wu.minuten, text: wu.inhalt }));

  const seen = new Set();
  for (const u of raw.uebungen) {
    if (!allowedIds.includes(u.id) || seen.has(u.id)) continue;
    seen.add(u.id);
    const ex = EX[u.id];
    const lo = clamp(Math.min(u.wdhMin, u.wdhMax), 1, 30);
    const hi = clamp(Math.max(u.wdhMin, u.wdhMax), lo, 30);
    items.push(makeItem(u.id, settings, {
      role: ex.main && items.filter((i) => i.role === 'main').length < 3 && ex.kind === 'compound' ? 'main' : ex.kind === 'compound' ? 'secondary' : 'accessory',
      sets: u.saetze, repsMin: lo, repsMax: hi === lo ? lo + 2 : hi, rir: clamp(u.zielRir, 0, 3), restSec: u.pauseSek, note: u.hinweis ?? '',
    }));
  }
  if (items.filter((i) => i.kind === 'strength').length < 2) throw new AiError('invalid', 'Die KI hat zu wenige gültige Übungen geliefert.');

  const fin = raw.finisher;
  if (fin && fin.minuten > 0 && cardioIds.includes(fin.id)) items.push(makeItem(fin.id, settings, { role: 'finisher', minutes: fin.minuten, text: fin.inhalt }));

  return { title: raw.titel || 'Training', rationale: raw.begruendung || '', items: fitToBudget(items, budgetMin * 60) };
}

/**
 * Plan holen: erst KI, bei Fehlern lokaler Ersatzplan.
 * @returns {{title, rationale, items, source:'ai'|'local', fallbackReason?:AiError}}
 */
export async function makePlan({ settings, sessions, sets, budgetMin, useAi = true, checkin = null }) {
  const local = () => ({ ...planLocal({ settings, sets, budgetMin, checkin }), source: 'local' });
  if (!useAi || !settings.ai.enabled || !settings.ai.apiKey) return local();
  const ctx = buildPrompt({ settings, sessions, sets, budgetMin, checkin });
  const schema = planSchema(ctx.allowedIds, ctx.cardioIds);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateJson({ apiKey: settings.ai.apiKey, model: settings.ai.model, system: SYSTEM, prompt: ctx.prompt, schema });
      return { ...convertPlan(raw, { settings, budgetMin, ...ctx }), source: 'ai' };
    } catch (e) {
      lastErr = e instanceof AiError ? e : new AiError('server', String(e?.message ?? e));
      if (lastErr.kind !== 'invalid') break; // nur ungültige Antworten einmal wiederholen
    }
  }
  return { ...local(), fallbackReason: lastErr };
}
