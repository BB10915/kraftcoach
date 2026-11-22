// Trainingsziele, Check-in-Optionen und Startwert-Übungen für die Einrichtung.

export const GOALS = [
  ['kraft', 'Stärker werden', 'Mehr Gewicht bewegen, schwere Grundübungen'],
  ['muskel', 'Muskelaufbau', 'Sichtbar mehr Muskeln, mittlere Wiederholungen'],
  ['fett', 'Fett abbauen', 'Training mit mehr Kalorienverbrauch'],
  ['fitness', 'Fitter werden', 'Mehr Kondition und Ausdauer'],
  ['athletik', 'Athletischer werden', 'Schnellkraft, Sprungkraft, Koordination'],
  ['beweglichkeit', 'Beweglicher werden', 'Mehr Mobility, weniger Steifheit'],
  ['gesundheit', 'Gesund & schmerzfrei', 'Rücken, Gelenke und Haltung stärken'],
];
export const GOAL_LABEL = Object.fromEntries(GOALS.map(([k, l]) => [k, l]));

export function goalsText(profile) {
  const g = (profile.goals ?? []).map((k) => GOAL_LABEL[k]).filter(Boolean);
  return [g.join(', '), profile.goal].filter(Boolean).join(' – ');
}

/** Übungen, nach deren Werten die Einrichtung fragt (je ein Bewegungsmuster). */
export const BASELINE_EXERCISES = [
  'lh-kniebeuge', 'lh-bankdruecken', 'lh-kreuzheben', 'lh-schulterdruecken',
  'kz-latziehen', 'kz-rudern', 'kg-klimmzug', 'ma-beinpresse',
];

// ---------- Check-in vor dem Training (tagesaktuelle Daten) ----------

export const ENERGY = [['niedrig', 'Niedrig', '😴'], ['normal', 'Normal', '🙂'], ['hoch', 'Hoch', '⚡']];
export const SLEEP = [['schlecht', 'Schlecht'], ['okay', 'Okay'], ['gut', 'Gut']];
export const SLEEP_H = [[5, '≤ 5 h'], [6, '6 h'], [7, '7 h'], [8, '8 h'], [9, '9+ h']];
export const STRESS = [['niedrig', 'Entspannt'], ['mittel', 'Etwas'], ['hoch', 'Viel Stress']];
export const LAST_MEAL = [['lt1', '< 1 h'], ['1-2', '1–2 h'], ['2-4', '2–4 h'], ['gt4', '> 4 h / nüchtern']];
export const ATE = [['wenig', 'Wenig'], ['normal', 'Normal'], ['viel', 'Viel']];
export const LOADS = [['sport', 'Heute schon Sport'], ['arbeit', 'Körperlich gearbeitet'], ['unterwegs', 'Viel auf den Beinen']];

/** Körperbereiche für Muskelkater/Schmerzen -> Muskeln */
export const REGIONS = {
  beine: { label: 'Beine', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  ruecken: { label: 'Rücken', muscles: ['lats', 'upperback', 'lowerback'] },
  brust: { label: 'Brust', muscles: ['chest'] },
  schultern: { label: 'Schultern', muscles: ['shoulders'] },
  arme: { label: 'Arme', muscles: ['biceps', 'triceps'] },
  rumpf: { label: 'Rumpf', muscles: ['core'] },
};

export const WISHES = [
  ['', 'Kein Wunsch'],
  ['oberkoerper', 'Fokus Oberkörper'],
  ['unterkoerper', 'Fokus Beine'],
  ['locker', 'Eher locker'],
  ['hart', 'Richtig fordern'],
  ['regen', 'Nur Regeneration'],
];

export const DEFAULT_CHECKIN = {
  energy: 'normal', sleep: 'okay', sore: [], pain: [], wish: '',
  // optional ("Mehr Angaben")
  sleepH: null, stress: '', hr: null, hrv: null, lastMeal: '', ate: '', trainTime: '', loads: [],
};

const label = (list, k) => list.find(([v]) => v === k)?.[1];

/** Kurzbeschreibung für Prompt und Anzeige. */
export function checkinText(c) {
  if (!c) return 'kein Check-in';
  const parts = [`Energie ${c.energy}`, `Schlaf ${c.sleep}${c.sleepH ? ` (${label(SLEEP_H, c.sleepH)})` : ''}`];
  if (c.stress) parts.push(`Stress ${c.stress}`);
  if (c.hr) parts.push(`Ruhepuls ${c.hr}`);
  if (c.hrv) parts.push(`HRV ${c.hrv} ms`);
  if (c.sore?.length) parts.push(`Muskelkater: ${c.sore.map((r) => REGIONS[r]?.label).join(', ')}`);
  if (c.pain?.length) parts.push(`SCHMERZEN (meiden!): ${c.pain.map((r) => REGIONS[r]?.label).join(', ')}`);
  if (c.lastMeal) parts.push(`letzte Mahlzeit vor ${label(LAST_MEAL, c.lastMeal)}`);
  if (c.ate) parts.push(`heute bisher ${label(ATE, c.ate).toLowerCase()} gegessen`);
  if (c.health?.steps != null) parts.push(`${c.health.steps} Schritte heute`);
  if (c.health?.activeKcal) parts.push(`${c.health.activeKcal} kcal Aktivenergie`);
  if (c.health?.sleepH) parts.push(`Schlaf laut Uhr ${c.health.sleepH} h`);
  if (c.loads?.length) parts.push(`Belastung heute: ${c.loads.map((k) => label(LOADS, k)).join(', ')}`);
  if (c.trainTime) parts.push(`Training um ${c.trainTime}`);
  if (c.wish) parts.push(`Wunsch: ${label(WISHES, c.wish)}`);
  return parts.join(' · ');
}

/**
 * Tagesform bewerten (statische Werte aus dem Profil als Vergleich, z. B. normaler Ruhepuls).
 * @returns {{points:number, level:'voll'|'normal'|'reduziert'|'regeneration', reasons:string[]}}
 */
export function readiness(c, profile = {}) {
  if (!c) return { points: 0, level: 'normal', reasons: [] };
  const reasons = [];
  let pts = 0;
  const add = (n, why) => { pts += n; reasons.push(why); };
  if (c.energy === 'niedrig') add(1, 'wenig Energie');
  // Schlaf: Qualität und Dauer zählen zusammen höchstens 2 Punkte
  let sl = 0;
  if (c.sleep === 'schlecht') sl++;
  if (c.sleepH && c.sleepH <= 5) sl++;
  else if (c.sleepH === 6 && c.sleep !== 'gut') sl = Math.max(sl, 1);
  if (sl) add(Math.min(2, sl), c.sleepH && c.sleepH <= 6 ? `nur ${c.sleepH} h Schlaf` : 'schlecht geschlafen');
  if (c.stress === 'hoch') add(1, 'viel Stress');
  const baseHr = +profile.body?.restingHr || 0;
  if (c.hr && baseHr && c.hr >= baseHr + 7) add(1, `Ruhepuls erhöht (${c.hr} statt ~${baseHr})`);
  const baseHrv = +profile.body?.hrv || 0;
  if (c.hrv && baseHrv && c.hrv <= baseHrv * 0.8) add(1, `HRV niedrig (${c.hrv} statt ~${baseHrv} ms)`);
  if (c.loads?.includes('sport') || c.loads?.includes('arbeit')) add(1, 'heute schon körperlich belastet');
  if (c.ate === 'wenig') add(0.5, 'bisher wenig gegessen');
  if (c.wish === 'locker') add(1, 'Wunsch: locker');
  if (c.pain?.length >= 2) add(1, 'Schmerzen an mehreren Stellen');

  const fresh = c.energy === 'hoch' && c.sleep === 'gut' && pts === 0;
  let level = pts >= 4 ? 'regeneration' : pts >= 1 ? 'reduziert' : fresh || (c.wish === 'hart' && pts === 0) ? 'voll' : 'normal';
  if (c.wish === 'regen') level = 'regeneration';
  return { points: pts, level, reasons };
}

export const LEVEL_TEXT = {
  voll: ['Volle Leistung', 'Du bist fit – heute darf es schwer werden.'],
  normal: ['Normal trainieren', 'Alles im grünen Bereich.'],
  reduziert: ['Volumen reduzieren', 'Weniger Sätze, mehr Reserve – Qualität vor Menge.'],
  regeneration: ['Lieber regenerieren', 'Heute Erholung: lockere Bewegung und Mobility statt schwerer Sätze.'],
};

/** Wie stark heute reduzieren? −1 = richtig fit, 0 = normal, 1 = etwas weniger, 2 = deutlich weniger */
export function fatigueLevel(c, profile = {}) {
  if (!c) return 0;
  const r = readiness(c, profile);
  if (r.level === 'voll') return -1;
  return Math.min(2, Math.ceil(r.points));
}
