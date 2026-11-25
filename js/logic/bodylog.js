// Körperwerte-Tagebuch: ein Eintrag pro Tag (Ruhepuls, HRV, Schlaf, Schritte, Aktivkalorien, Gewicht
// und die Selbsteinschätzung aus dem Check-in). Reine Logik ohne DOM, damit sie testbar bleibt.

import { dayKey, DAY } from '../util.js';

/** Messwerte, die als Verlauf angezeigt werden. digits = Nachkommastellen, better = welche Richtung gut ist. */
export const METRICS = {
  hr: { label: 'Ruhepuls', unit: 'bpm', digits: 0, better: 'down', range: [30, 130] },
  hrv: { label: 'HRV', unit: 'ms', digits: 0, better: 'up', range: [5, 300] },
  sleepH: { label: 'Schlaf', unit: 'h', digits: 1, better: 'up', range: [0.5, 16] },
  steps: { label: 'Schritte', unit: '', digits: 0, better: 'up', range: [0, 100000] },
  activeKcal: { label: 'Aktivkalorien', unit: 'kcal', digits: 0, better: 'up', range: [0, 8000] },
  weight: { label: 'Gewicht', unit: 'kg', digits: 1, better: null, range: [30, 250] },
};
export const METRIC_KEYS = Object.keys(METRICS);
const SELF_KEYS = ['energy', 'sleep', 'stress'];

const valid = (k, v) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  if (n == null || !Number.isFinite(n)) return null;
  const [lo, hi] = METRICS[k].range;
  if (n < lo || n > hi) return null;
  const p = 10 ** METRICS[k].digits;
  return Math.round(n * p) / p;
};

/**
 * Tageseintrag aus einem Check-in (inkl. Health-Werten) bauen.
 * Gemessene Health-Werte haben Vorrang vor den gerundeten Chip-Angaben (z. B. Schlaf 7,2 h statt „7 h“).
 * @returns {{day:string, at:number, ...}|null} null, wenn nichts Brauchbares drinsteht
 */
export function entryFromCheckin(c, { now = Date.now(), weight = null } = {}) {
  if (!c) return null;
  const h = c.health ?? {};
  const e = {
    hr: valid('hr', h.hr ?? c.hr),
    hrv: valid('hrv', h.hrv ?? c.hrv),
    sleepH: valid('sleepH', h.sleepH ?? c.sleepH),
    steps: valid('steps', h.steps),
    activeKcal: valid('activeKcal', h.activeKcal),
    weight: valid('weight', h.weight ?? weight),
  };
  for (const k of SELF_KEYS) if (c[k]) e[k] = c[k];
  return cleanEntry({ day: dayKey(now), at: now, ...e });
}

/** Leere Felder entfernen; null, wenn außer Tag/Zeit nichts übrig bleibt. */
export function cleanEntry(e) {
  if (!e?.day) return null;
  const out = { day: e.day, at: e.at ?? Date.now() };
  for (const k of METRIC_KEYS) {
    const v = valid(k, e[k]);
    if (v != null) out[k] = v;
  }
  for (const k of SELF_KEYS) if (e[k]) out[k] = e[k];
  return Object.keys(out).length > 2 ? out : null;
}

/** Neuen Eintrag in den bestehenden Tag einmischen: neue Werte gewinnen, fehlende bleiben erhalten. */
export function mergeEntry(old, next) {
  if (!old) return next ? { ...next } : null;
  if (!next) return { ...old };
  const out = { ...old, at: Math.max(old.at ?? 0, next.at ?? 0) };
  for (const [k, v] of Object.entries(next)) if (v != null && v !== '' && k !== 'at') out[k] = v;
  return out;
}

/** Einträge (beliebige Reihenfolge) → Liste nach Tag aufsteigend, je Tag ein Eintrag. */
export function normalizeLog(entries) {
  const byDay = new Map();
  for (const e of entries ?? []) {
    const c = cleanEntry(e);
    if (c) byDay.set(c.day, mergeEntry(byDay.get(c.day), c));
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** Mittag des Tages als Zeitstempel (stabil gegen Zeitumstellung). */
export const dayTs = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

/** Punkte für das Liniendiagramm: [{x, y, day}] der letzten `days` Tage (inkl. heute). */
export function seriesOf(log, key, { days = 30, now = Date.now() } = {}) {
  const from = dayKey(now - (days - 1) * DAY);
  return log.filter((e) => e.day >= from && e.day <= dayKey(now) && e[key] != null).map((e) => ({ x: dayTs(e.day), y: e[key], day: e.day }));
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Kennzahlen eines Werts: letzter Wert, Ø 7 Tage, Ø 28 Tage und die Änderung Ø7 gegenüber Ø der 3 Wochen davor.
 * trend: 'gut' | 'schlecht' | 'gleich' | null (zu wenig Daten). Gewicht hat keine Wertung ('auf'/'ab'/'gleich').
 */
export function summaryOf(log, key, { now = Date.now() } = {}) {
  const pts = seriesOf(log, key, { days: 28, now });
  const recent = pts.filter((p) => p.day >= dayKey(now - 6 * DAY)).map((p) => p.y);
  const before = pts.filter((p) => p.day < dayKey(now - 6 * DAY)).map((p) => p.y);
  const last = [...log].reverse().find((e) => e[key] != null) ?? null;
  const avg7 = avg(recent), avg28 = avg(pts.map((p) => p.y));
  let delta = null, trend = null;
  if (recent.length >= 2 && before.length >= 3) {
    delta = avg7 - avg(before);
    const m = METRICS[key];
    // Unter dieser Schwelle gilt es als gleich (Messrauschen)
    const thr = { hr: 2, hrv: 4, sleepH: 0.3, steps: 1000, activeKcal: 60, weight: 0.4 }[key];
    if (Math.abs(delta) < thr) trend = 'gleich';
    else if (!m.better) trend = delta > 0 ? 'auf' : 'ab';
    else trend = (delta > 0) === (m.better === 'up') ? 'gut' : 'schlecht';
  }
  return { last: last ? { day: last.day, value: last[key] } : null, avg7, avg28, delta, trend, count: pts.length };
}
