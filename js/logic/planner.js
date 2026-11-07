// Lokaler Planer: erstellt eine Einheit ohne KI (Ersatz, wenn die KI nicht erreichbar ist).

import { EXERCISES, PATTERNS, MUSCLES, getEx } from '../data/exercises.js';
import { muscleStatus, lastUsedMap } from './history.js';
import { itemSec, sessionSec, fitToBudget } from './timing.js';
import { uid, clamp } from '../util.js';

const WEEKLY_TARGET = 10; // Arbeitssätze pro Muskel und Woche (allgemeine Fitness)

/** Standard-Vorgaben je Rolle. */
export function makeItem(exerciseId, settings, opts = {}) {
  const ex = getEx(exerciseId);
  const t = settings.training;
  if (ex.timed) {
    return {
      uid: uid(), exerciseId, kind: 'timed', role: opts.role ?? (ex.kind === 'mobility' ? 'warmup' : 'finisher'),
      minutes: opts.minutes ?? (ex.kind === 'mobility' ? settings.profile.warmupMin || 5 : 6),
      text: opts.text ?? ex.text, status: 'open', note: opts.note ?? '',
    };
  }
  const role = opts.role ?? (ex.main ? 'main' : ex.kind === 'compound' ? 'secondary' : 'accessory');
  const preset = {
    main: { sets: 3, repsMin: 5, repsMax: 8, rir: 2, restSec: t.restCompound },
    secondary: { sets: 3, repsMin: 8, repsMax: 12, rir: 2, restSec: Math.round((t.restCompound + t.restIsolation) / 2) },
    accessory: { sets: 3, repsMin: 10, repsMax: 15, rir: 1, restSec: t.restIsolation },
  }[role] ?? { sets: 3, repsMin: 8, repsMax: 12, rir: 2, restSec: t.restIsolation };
  return {
    uid: uid(), exerciseId, kind: 'strength', role,
    ...preset,
    ...pickDefined(opts, ['sets', 'repsMin', 'repsMax', 'rir', 'restSec']),
    note: opts.note ?? '', status: 'open',
  };
}

function pickDefined(o, keys) {
  const r = {};
  for (const k of keys) if (o[k] != null) r[k] = o[k];
  return r;
}

/** Wie dringend sollte ein Bewegungsmuster heute dran sein? 0..1 */
export function patternScores(status) {
  const scores = {};
  for (const [p, def] of Object.entries(PATTERNS)) {
    if (!def.muscles.length) continue;
    const vals = def.muscles.map((m) => {
      const o = status[m];
      const need = clamp(1 - o.sets7d / WEEKLY_TARGET, 0, 1);
      return o.readiness * (0.35 + 0.65 * need);
    });
    // Das am wenigsten erholte Muskel bremst das Muster.
    scores[p] = Math.min(...vals) * 0.6 + (vals.reduce((a, b) => a + b, 0) / vals.length) * 0.4;
  }
  return scores;
}

function chooseExercise(pattern, allowed, lastUsed, { mainOnly = false, exclude = new Set(), now = Date.now() } = {}) {
  let cands = allowed.filter((e) => e.pattern === pattern && !exclude.has(e.id));
  if (mainOnly && cands.some((e) => e.main)) cands = cands.filter((e) => e.main);
  if (!cands.length) return null;
  // Rotation: am längsten nicht gemachte Variante zuerst.
  // Unbekannte Übungen zählen bei Hauptübungen wie "vor 1,5 Tagen gemacht" -> bekannte Hauptübungen
  // bleiben für den Fortschritt bevorzugt; bei Ergänzungsübungen wie "vor 4 Tagen" -> mehr Abwechslung.
  const unknownAge = (mainOnly ? 1.5 : 4) * 86400000;
  const age = (e) => (lastUsed.has(e.id) ? now - lastUsed.get(e.id) : unknownAge);
  cands.sort((a, b) => age(b) - age(a));
  return cands[0];
}

/**
 * Plan erstellen.
 * @returns {{title, rationale, items}}
 */
export function planLocal({ settings, sets, budgetMin, now = Date.now() }) {
  const profile = settings.profile;
  const allowed = EXERCISES.filter((e) => profile.equipment.includes(e.eq));
  const status = muscleStatus(sets, now);
  const sc = patternScores(status);
  const lastUsed = lastUsedMap(sets);
  const budgetSec = budgetMin * 60;
  const used = new Set();
  const items = [];

  // 1) Aufwärmen / Beweglichkeit
  const warm = makeItem('m-aufwaermen', settings, { role: 'warmup', minutes: profile.warmupMin || 5 });
  if ((profile.warmupMin ?? 5) > 0) items.push(warm);

  // 2) Hauptübungen: je ein Muster für Beine, Drücken, Ziehen
  const best = (ps) => ps.filter((p) => sc[p] != null).sort((a, b) => sc[b] - sc[a])[0];
  const lower = best(['squat', 'hinge']);
  const push = best(['hpush', 'vpush']);
  const pull = best(['hpull', 'vpull']);
  let mains = [lower, push, pull].filter(Boolean).sort((a, b) => sc[b] - sc[a]);
  // Kaum erholte Bereiche heute nicht als Hauptübung (aber mindestens zwei Hauptübungen).
  const rested = mains.filter((p) => sc[p] >= 0.3);
  mains = rested.length >= 2 ? rested : mains.slice(0, 2);
  const queue = [];
  for (const p of mains) queue.push({ p, role: 'main' });

  // 3) Ergänzende Grundübungen (die jeweils anderen Muster)
  const partner = { squat: 'hinge', hinge: 'squat', hpush: 'vpush', vpush: 'hpush', hpull: 'vpull', vpull: 'hpull' };
  const seconds = mains.map((p) => partner[p]).concat(['lunge']).filter((p) => sc[p] > 0.5).sort((a, b) => sc[b] - sc[a]);
  for (const p of seconds) queue.push({ p, role: 'secondary' });

  // 4) Isolationsübungen nach Bedarf
  const acc = ['kneeflex', 'lateral', 'reardelt', 'biceps', 'triceps', 'calf', 'core', 'kneeext', 'fly', 'glute']
    .filter((p) => sc[p] > 0.35)
    .sort((a, b) => sc[b] - sc[a]);
  for (const p of acc) queue.push({ p, role: 'accessory' });

  // 5) Finisher (Kondition) reservieren
  let finisher = null;
  if (profile.finisher && budgetMin >= 40) {
    const cardio = allowed.filter((e) => e.kind === 'cardio').sort((a, b) => (lastUsed.get(a.id) ?? 0) - (lastUsed.get(b.id) ?? 0))[0];
    if (cardio) finisher = makeItem(cardio.id, settings, { role: 'finisher', minutes: budgetMin >= 55 ? 8 : 6 });
  }
  const reserve = finisher ? itemSec(finisher) : 0;

  const lowReady = Object.entries(status).filter(([, o]) => o.readiness < 0.6).map(([m]) => MUSCLES[m]);

  for (const { p, role } of queue) {
    const ex = chooseExercise(p, allowed, lastUsed, { mainOnly: role === 'main', exclude: used, now });
    if (!ex) continue;
    const it = makeItem(ex.id, settings, { role, sets: role === 'main' && budgetMin >= 60 ? 4 : 3 });
    if (sessionSec([...items, it]) + reserve > budgetSec + 60) continue; // passt nicht mehr – nächstes probieren
    items.push(it);
    used.add(ex.id);
  }
  if (finisher) items.push(finisher);

  const fitted = fitToBudget(items, budgetSec);
  const mainNames = fitted.filter((i) => i.role === 'main').map((i) => PATTERNS[getEx(i.exerciseId).pattern].label);
  return {
    title: titleFor(fitted),
    rationale:
      (mainNames.length ? `Schwerpunkt: ${mainNames.join(', ')}. ` : '') +
      (lowReady.length ? `Noch in Erholung: ${lowReady.join(', ')} – heute weniger Volumen dort.` : 'Alle Muskeln gut erholt.'),
    items: fitted,
  };
}

export function titleFor(items) {
  const regions = new Set(items.filter((i) => i.kind === 'strength').map((i) => PATTERNS[getEx(i.exerciseId).pattern]?.region));
  const hasLower = regions.has('lower');
  const hasUpper = regions.has('push') || regions.has('pull');
  if (hasLower && hasUpper) return 'Ganzkörper';
  if (hasLower) return 'Unterkörper';
  if (regions.has('push') && regions.has('pull')) return 'Oberkörper';
  if (regions.has('push')) return 'Drücken';
  if (regions.has('pull')) return 'Ziehen';
  return 'Training';
}
