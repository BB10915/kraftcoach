// Persönlicher Normalwert: gleitender Schnitt der gespeicherten Tageswerte statt fester Profilangabe.
// Eingabe: Tageseinträge aus S.body { day: 'YYYY-MM-DD', hr, hrv, sleepH, steps } (auch 'date' geht) (ein Eintrag pro Tag, Werte optional).
// Der heutige Tag zählt nie mit, damit ein schlechter Morgen den eigenen Vergleichswert nicht verschiebt.

export const WINDOW_DAYS = 14; // höchstens so viele Tage zurück
export const MIN_VALUES = 4; // so viele Messungen braucht ein Schnitt, sonst gilt der Profilwert

const DAY = 86400000;
const toDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null;
};
const val = (v) => (v == null || v === '' || !Number.isFinite(+v) || +v <= 0 ? null : +v);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Lokales Datum als 'YYYY-MM-DD'. */
export function isoDay(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/**
 * Schnitt je Messwert über die letzten Tage vor heute.
 * @returns {{hr, hrv, sleepH, steps, n:{hr,hrv,sleepH,steps}, days:number, yesterday:{sleepH, steps}|null}}
 *   Werte sind null, wenn es weniger als MIN_VALUES Messungen gibt.
 */
export function personalBaseline(entries = [], today = isoDay(), { windowDays = WINDOW_DAYS, minValues = MIN_VALUES } = {}) {
  const t = toDay(today);
  const byDay = new Map();
  for (const e of entries ?? []) {
    const d = toDay(e?.day ?? e?.date);
    if (d == null || t == null || d >= t || d < t - windowDays) continue;
    byDay.set(d, { ...byDay.get(d), ...e }); // doppelte Tage: späterer Eintrag gewinnt
  }
  const rows = [...byDay.values()];
  const out = { n: {}, days: rows.length, yesterday: null };
  for (const k of ['hr', 'hrv', 'sleepH', 'steps']) {
    const xs = rows.map((r) => val(r[k])).filter((x) => x != null);
    out.n[k] = xs.length;
    const r = k === 'sleepH' ? 10 : 1;
    out[k] = xs.length >= minValues ? Math.round(mean(xs) * r) / r : null;
  }
  const y = byDay.get(t - 1);
  if (y) out.yesterday = { sleepH: val(y.sleepH), steps: y.steps == null || y.steps === '' ? null : Math.max(0, +y.steps || 0) };
  return out;
}

/**
 * Vergleichswerte für die Tagesform: Schnitt, sonst Profilangabe.
 * @returns {{hr, hrv, hrSrc, hrvSrc, sleepH, steps, yesterday, n}} Src = 'schnitt' | 'profil' | null
 */
export function readinessBase(entries, profile = {}, today = isoDay()) {
  const b = personalBaseline(entries, today);
  const pHr = val(profile.body?.restingHr), pHrv = val(profile.body?.hrv);
  return {
    hr: b.hr ?? pHr, hrSrc: b.hr ? 'schnitt' : pHr ? 'profil' : null,
    hrv: b.hrv ?? pHrv, hrvSrc: b.hrv ? 'schnitt' : pHrv ? 'profil' : null,
    sleepH: b.sleepH, steps: b.steps, yesterday: b.yesterday, n: b.n,
  };
}
