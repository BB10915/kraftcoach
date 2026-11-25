// KI-Tagesplan: Prompt bauen, Antwort prüfen, in Übungen umwandeln, ins Zeitbudget einpassen.

import { EXERCISES, EX, MUSCLES, PATTERNS, EQUIPMENT, getEx } from '../data/exercises.js';
import { muscleStatus, prevSessionsFor, workSets } from '../logic/history.js';
import { makeItem, planLocal } from '../logic/planner.js';
import { fitToBudget } from '../logic/timing.js';
import { setE1rm } from '../logic/e1rm.js';
import { validate } from './schema.js';
import { generateJson, AiError } from './gemini.js';
import { fmtNum, clamp } from '../util.js';
import { checkinText, REGIONS, readiness, LEVEL_TEXT } from '../data/goals.js';
import { profileText } from '../data/profile.js';
import { nutritionTargets, targetsText } from '../logic/daycoach.js';
import { blockState, blockText, blockTag, dayForToday } from '../logic/block.js';

const H = 3600000;

export function planSchema(allowedIds, cardioIds) {
  const int = (min, max) => ({ type: 'integer', minimum: min, maximum: max });
  return {
    type: 'object',
    required: ['titel', 'begruendung', 'aufwaermen', 'uebungen', 'finisher', 'tag'],
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
      tag: {
        type: 'object', required: ['kernaussage', 'abschnitte'],
        properties: {
          kernaussage: { type: 'string', maxLength: 200 },
          abschnitte: {
            type: 'array', maxItems: 5,
            items: {
              type: 'object', required: ['key', 'punkte'],
              properties: {
                key: { type: 'string', enum: ['morgen', 'vor', 'training', 'nach', 'abend'] },
                punkte: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 180 } },
              },
            },
          },
        },
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
- TRAININGSBLOCK (Mehrwochenplanung): Halte dich an den Split-Tag von heute (nur dessen Muskelgruppen, z. B. am Oberkörper-Tag keine Beinübungen) und an die Vorgabe der Phase (Einstieg/Aufbau/Intensiv/Deload). Der Split folgt der Studienlage (jede Muskelgruppe mind. 2× pro Woche, ca. 10–20 Arbeitssätze pro Muskel und Woche; Split und Ganzkörper sind bei gleichem Volumen gleichwertig) – keine Trend-Splits wie Bro-Split. Tagesform und Schmerzen haben Vorrang: Ist der Split-Tag heute nicht sinnvoll machbar, plane Ganzkörper nach Erholung und sag kurz warum. In der Deload-Woche bekannte Übungen wiederholen, keine neuen.
- Erwähne in der begruendung kurz, wie du Ziele, Tagesform und Blockwoche berücksichtigt hast.
- Schreibe auf Deutsch, Hinweise kurz (Technik, Tempo, Fokus).
TAGESPLAN (Feld tag): Plane zusätzlich den ganzen Tag rund um das Training – Abschnitte morgen, vor, training, nach, abend mit je 2–5 kurzen, konkreten Punkten (mit Uhrzeiten aus dem TAGESABLAUF).
- Nutze die berechneten TAGESZIELE (Kalorien, Protein, Wasser) – erfinde keine anderen Zahlen.
- Berücksichtige Ernährungsform, Unverträglichkeiten, Supplements, Essensmöglichkeiten, Arbeits-/Schulzeiten, Weg zum Gym und den Schlaf.
- Bei unter 18-Jährigen: keine Koffein-Empfehlung, kein Kaloriendefizit über 200 kcal.
- kernaussage: ein Satz, ob heute schwer trainiert, das Volumen reduziert oder regeneriert wird und warum.
- Allgemeine Empfehlungen, keine Diagnosen oder medizinischen Ratschläge.`;

/** Kompakte Zusammenfassung der Historie für den Prompt (spart Tokens). */
export function buildPrompt({ settings, sessions, sets, budgetMin, now = Date.now(), checkin = null, block = null }) {
  const p = settings.profile;
  const blk = block ?? blockState(settings, sessions, now);
  const today = dayForToday(blk, checkin);
  const bw = p.bodyweight || 80;
  // Übungen für Schmerzbereiche gar nicht erst anbieten.
  const painM = new Set((checkin?.pain ?? []).flatMap((r) => REGIONS[r]?.muscles ?? []));
  const allowed = EXERCISES.filter((e) => p.equipment.includes(e.eq) && !e.primary.some((m) => painM.has(m)));
  const status = muscleStatus(sets, now);
  const done = sessions.filter((s) => s.status === 'done');
  const ready = readiness(checkin, p);

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

PROFIL (statische Daten)
${profileText(p)}
Ausrüstung: ${p.equipment.map((e) => EQUIPMENT[e]).join(', ')}
${calib}
Einheiten in den letzten 7 Tagen: ${done.filter((s) => now - (s.startedAt ?? 0) < 7 * 24 * H).length}

TAGESFORM (Check-in, tagesaktuell)
${checkinText(checkin)}
Bewertung: ${LEVEL_TEXT[ready.level][0]}${ready.reasons.length ? ` (${ready.reasons.join(', ')})` : ''}

TRAININGSBLOCK
${blockText(blk, today)}

TAGESZIELE (berechnet)
${targetsText(nutritionTargets(p, { trainingMin: budgetMin, checkin }))}

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
    block: blk,
    today,
    allowedIds: allowed.filter((e) => !e.timed).map((e) => e.id),
    cardioIds: allowed.filter((e) => e.kind === 'cardio').map((e) => e.id),
  };
}

/** Prüft die KI-Antwort und macht daraus Plan-Einträge. Wirft bei Unbrauchbarkeit. */
export function convertPlan(raw, { settings, budgetMin, allowedIds, cardioIds, block = null }) {
  const errs = validate(planSchema(allowedIds, cardioIds), raw);
  // Unbekannte Übungen tolerieren wir (werden verworfen), alles andere ist ein harter Fehler.
  // Fehler im Tagesplan (tag) sind weich: dann nimmt die App ihren lokalen Tagesplan.
  const tagBad = errs.some((e) => e.startsWith('$.tag'));
  const hard = errs.filter((e) => !/\.id: Wert nicht erlaubt/.test(e) && !e.startsWith('$.tag'));
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
  // Deload absichern, falls die KI zu viel plant: wenig Sätze, viel Reserve, leichter.
  if (block?.deload) {
    let acc = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind !== 'strength') continue;
      if (it.role === 'accessory' && ++acc > 2) { items.splice(i, 1); continue; }
      it.sets = Math.min(it.sets, it.role === 'main' ? 3 : 2);
      it.rir = Math.max(it.rir, 3);
      it.loadPct = block.loadPct;
    }
  }
  if (items.filter((i) => i.kind === 'strength').length < 2) throw new AiError('invalid', 'Die KI hat zu wenige gültige Übungen geliefert.');

  const fin = raw.finisher;
  if (fin && fin.minuten > 0 && cardioIds.includes(fin.id)) items.push(makeItem(fin.id, settings, { role: 'finisher', minutes: fin.minuten, text: fin.inhalt }));

  const dayAi = !tagBad && raw.tag ? { kernaussage: raw.tag.kernaussage, abschnitte: raw.tag.abschnitte } : null;
  return { title: raw.titel || 'Training', rationale: raw.begruendung || '', items: fitToBudget(items, budgetMin * 60), dayAi };
}

/** Hat die KI den Split-Tag eingehalten? Sonst zählt die Einheit nicht für die Rotation. */
export function matchesDay(items, day) {
  if (!day?.regions) return true;
  const st = items.filter((i) => i.kind === 'strength');
  const inDay = st.filter((i) => day.regions.includes(PATTERNS[getEx(i.exerciseId).pattern]?.region)).length;
  return st.length > 0 && inDay / st.length >= 0.75;
}

/**
 * Plan holen: erst KI, bei Fehlern lokaler Ersatzplan.
 * @returns {{title, rationale, items, source:'ai'|'local', fallbackReason?:AiError}}
 */
export async function makePlan({ settings, sessions, sets, budgetMin, useAi = true, checkin = null, now = Date.now() }) {
  const block = blockState(settings, sessions, now);
  const regen = checkin?.wish === 'regen';
  const local = () => {
    const pl = planLocal({ settings, sets, budgetMin, checkin, block, now });
    return { ...pl, source: 'local', block: blockTag(block, { dayId: pl.dayId, dayIdx: pl.dayIdx, regen: regen || pl.dayId == null }) };
  };
  // Regenerationstag braucht keine KI-Anfrage (spart Kontingent).
  if (!useAi || !settings.ai.enabled || !settings.ai.apiKey || regen) return local();
  const ctx = buildPrompt({ settings, sessions, sets, budgetMin, checkin, block, now });
  const schema = planSchema(ctx.allowedIds, ctx.cardioIds);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateJson({ apiKey: settings.ai.apiKey, model: settings.ai.model, system: SYSTEM, prompt: ctx.prompt, schema });
      const plan = convertPlan(raw, { settings, budgetMin, ...ctx });
      return { ...plan, source: 'ai', block: blockTag(block, { dayId: ctx.today.dayId, dayIdx: ctx.today.dayIdx, regen: !matchesDay(plan.items, ctx.today.day) }) };
    } catch (e) {
      lastErr = e instanceof AiError ? e : new AiError('server', String(e?.message ?? e));
      if (lastErr.kind !== 'invalid') break; // nur ungültige Antworten einmal wiederholen
    }
  }
  return { ...local(), fallbackReason: lastErr };
}
