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
  const b = c.base;
  if (c.hr) parts.push(`Ruhepuls ${c.hr}${b?.hr ? ` (normal ~${b.hr}${b.hrSrc === 'schnitt' ? `, Schnitt ${b.n?.hr} Tage` : ''})` : ''}`);
  if (c.hrv) parts.push(`HRV ${c.hrv} ms${b?.hrv ? ` (normal ~${b.hrv} ms${b.hrvSrc === 'schnitt' ? `, Schnitt ${b.n?.hrv} Tage` : ''})` : ''}`);
  if (b?.yesterday?.steps != null) parts.push(`gestern ${b.yesterday.steps} Schritte`);
  if (b?.yesterday?.sleepH) parts.push(`Nacht davor ${b.yesterday.sleepH} h Schlaf`);
  if (c.sore?.length) parts.push(`Muskelkater: ${c.sore.map((r) => REGIONS[r]?.label).join(', ')}`);
  if (c.pain?.length) parts.push(`SCHMERZEN (meiden!): ${c.pain.map((r) => REGIONS[r]?.label).join(', ')}`);
  if (c.lastMeal) parts.push(`letzte Mahlzeit vor ${label(LAST_MEAL, c.lastMeal)}`);
  if (c.ate) parts.push(`heute bisher ${label(ATE, c.ate).toLowerCase()} gegessen`);
  if (c.health?.steps != null) parts.push(`${c.health.steps} Schritte heute`);
  if (c.health?.activeKcal) parts.push(`${c.health.activeKcal} kcal Aktivenergie`);
  if (c.health?.sleepH) parts.push(`Schlaf laut Uhr ${c.health.sleepH} h`);
  if (b?.lastHard) parts.push(`letzte Einheit sehr hart (RPE ${b.lastHard.rpe}, vor ${b.lastHard.hours} h)`);
  if (c.loads?.length) parts.push(`Belastung heute: ${c.loads.map((k) => label(LOADS, k)).join(', ')}`);
  if (c.trainTime) parts.push(`Training um ${c.trainTime}`);
  if (c.wish) parts.push(`Wunsch: ${label(WISHES, c.wish)}`);
  return parts.join(' · ');
}

/**
 * Tagesform bewerten. Vergleichswerte: c.base (gleitender Schnitt der letzten Tage, siehe
 * js/logic/baseline.js → readinessBase) oder, falls nicht vorhanden, die festen Profilwerte.
 * @returns {{points:number, level:'voll'|'normal'|'reduziert'|'regeneration', reasons:string[]}}
 */
export function readiness(c, profile = {}) {
  if (!c) return { points: 0, level: 'normal', reasons: [] };
  const reasons = [];
  let pts = 0;
  const add = (n, why) => { pts += n; reasons.push(why); };
  const base = c.base ?? {};
  const f1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  if (c.energy === 'niedrig') add(1, 'wenig Energie');
  // Schlaf: Qualität, Dauer und die Nacht davor zählen zusammen höchstens 2 Punkte
  let sl = 0;
  const why = [];
  if (c.sleep === 'schlecht') sl++;
  if (c.sleepH && c.sleepH <= 5) sl++;
  else if (c.sleepH === 6 && c.sleep !== 'gut') sl = Math.max(sl, 1);
  if (sl) why.push(c.sleepH && c.sleepH <= 6 ? `nur ${c.sleepH} h Schlaf` : 'schlecht geschlafen');
  else if (c.sleepH && base.sleepH && c.sleepH <= base.sleepH - 1.5) {
    sl = 0.5;
    why.push(`${c.sleepH} h Schlaf statt ~${f1(base.sleepH)} h wie sonst`);
  }
  const ySleep = base.yesterday?.sleepH;
  const shortNow = sl >= 1 || (c.sleepH && c.sleepH <= 6);
  if (ySleep && ySleep <= 6 && shortNow) {
    sl += 0.5;
    why.push(`schon die Nacht davor nur ${f1(ySleep)} h`);
  } else if (ySleep && ySleep <= 5) {
    sl += 0.5;
    why.push(`Schlafdefizit von vorletzter Nacht (${f1(ySleep)} h)`);
  }
  if (sl) add(Math.min(2, sl), why.join(', '));
  if (c.stress === 'hoch') add(1, 'viel Stress');
  const baseHr = +(base.hr ?? profile.body?.restingHr) || 0;
  const hrWord = c.base?.hrSrc === 'schnitt' ? 'Schnitt' : '';
  if (c.hr && baseHr && c.hr >= baseHr + 7) add(1, `Ruhepuls erhöht (${c.hr} statt ~${baseHr}${hrWord ? ` im ${hrWord}` : ''})`);
  else if (c.hr && baseHr && c.hr >= baseHr + 5) add(0.5, `Ruhepuls leicht erhöht (${c.hr} statt ~${baseHr}${hrWord ? ` im ${hrWord}` : ''})`);
  const baseHrv = +(base.hrv ?? profile.body?.hrv) || 0;
  const hrvWord = c.base?.hrvSrc === 'schnitt' ? ' im Schnitt' : '';
  if (c.hrv && baseHrv && c.hrv <= baseHrv * 0.8) add(1, `HRV niedrig (${c.hrv} statt ~${baseHrv} ms${hrvWord})`);
  else if (c.hrv && baseHrv && c.hrv <= baseHrv * 0.88) add(0.5, `HRV etwas niedriger (${c.hrv} statt ~${baseHrv} ms${hrvWord})`);
  // Schritte von gestern: viel auf den Beinen → Beine und Gesamtvolumen etwas schonen
  const ySteps = base.yesterday?.steps;
  if (ySteps != null) {
    const fmt = ySteps.toLocaleString('de-DE');
    if (ySteps >= 20000) add(1, `gestern sehr viel auf den Beinen (${fmt} Schritte)`);
    else if (ySteps >= 15000 || (ySteps >= 12000 && base.steps && ySteps >= base.steps * 1.8)) add(0.5, `gestern viel unterwegs (${fmt} Schritte)`);
  }
  // Letzte Einheit sehr hart (Session-RPE ≥ 9, < 48 h her, siehe js/logic/checkout.js) → etwas mehr Reserve
  if (base.lastHard) add(0.5, `letzte Einheit sehr hart (RPE ${base.lastHard.rpe}, vor ${base.lastHard.hours} h)`);
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
