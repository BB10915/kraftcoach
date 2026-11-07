// Trainingsziele, Check-in-Optionen und Startwert-Übungen für die Einrichtung.

export const GOALS = [
  ['kraft', 'Stärker werden', 'Mehr Gewicht bewegen, schwere Grundübungen'],
  ['muskel', 'Muskelaufbau', 'Sichtbar mehr Muskeln, mittlere Wiederholungen'],
  ['fett', 'Fett abbauen', 'Training mit mehr Kalorienverbrauch'],
  ['fitness', 'Fitter werden', 'Mehr Kondition und Ausdauer'],
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

// ---------- Check-in vor dem Training ----------

export const ENERGY = [['niedrig', 'Niedrig', '😴'], ['normal', 'Normal', '🙂'], ['hoch', 'Hoch', '⚡']];
export const SLEEP = [['schlecht', 'Schlecht'], ['okay', 'Okay'], ['gut', 'Gut']];

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
];

export const DEFAULT_CHECKIN = { energy: 'normal', sleep: 'okay', sore: [], pain: [], wish: '' };

/** Kurzbeschreibung für Prompt und Anzeige. */
export function checkinText(c) {
  if (!c) return 'kein Check-in';
  const parts = [`Energie ${c.energy}`, `Schlaf ${c.sleep}`];
  if (c.sore?.length) parts.push(`Muskelkater: ${c.sore.map((r) => REGIONS[r]?.label).join(', ')}`);
  if (c.pain?.length) parts.push(`SCHMERZEN (meiden!): ${c.pain.map((r) => REGIONS[r]?.label).join(', ')}`);
  const wish = WISHES.find(([k]) => k === c.wish)?.[1];
  if (c.wish) parts.push(`Wunsch: ${wish}`);
  return parts.join(' · ');
}

/** Wie stark heute reduzieren? 0 = normal, 1 = etwas weniger, 2 = deutlich weniger */
export function fatigueLevel(c) {
  if (!c) return 0;
  let n = 0;
  if (c.energy === 'niedrig') n++;
  if (c.sleep === 'schlecht') n++;
  if (c.wish === 'locker') n++;
  if (c.energy === 'hoch' && c.sleep === 'gut' && n === 0) return -1; // richtig fit
  if (c.wish === 'hart' && n === 0) return -1;
  return Math.min(2, n);
}
