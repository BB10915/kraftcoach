// Abschluss nach dem Training ("Check-out"): Titel, Anstrengung (Session-RPE), Gefühl, Schmerzen, Notiz, Foto.
// Gespeichert als session.checkout. Reine Logik ohne DOM, damit sie in den Tests läuft.
//
// Grundlagen:
// - Session-RPE (Foster et al. 2001; für Krafttraining validiert u. a. Day et al. 2004, Sweet et al. 2004):
//   Anstrengung der ganzen Einheit auf der CR-10-Skala. RPE × Minuten = Trainingslast (in "AU").
// - Gefühl: Feeling Scale (Hardy & Rejeski 1989), hier auf 5 Stufen verkürzt. Misst, wie angenehm es war –
//   unabhängig davon, wie hart.

import { REGIONS } from '../data/goals.js';

const H = 3600000;
const DAY = 24 * H;

/** CR-10-Skala (Borg/Foster), deutsche Kurzlabels. */
export const RPE = [
  [0, 'Ruhe'], [1, 'Sehr, sehr leicht'], [2, 'Leicht'], [3, 'Moderat'], [4, 'Etwas schwer'],
  [5, 'Schwer'], [6, 'Schwer'], [7, 'Sehr schwer'], [8, 'Sehr schwer'], [9, 'Sehr, sehr schwer'], [10, 'Maximal'],
];
export const rpeLabel = (v) => RPE.find(([k]) => k === v)?.[1] ?? '';

/** Gefühl nach der Einheit: -2 … +2 */
export const FEEL = [[-2, 'Mies', '😫'], [-1, 'Zäh', '😕'], [0, 'Okay', '😐'], [1, 'Gut', '🙂'], [2, 'Super', '🤩']];
export const feelOf = (v) => FEEL.find(([k]) => k === v) ?? null;

/** So hart gilt als "sehr hart" (CR-10 ≥ 9 = sehr, sehr schwer bis maximal). */
export const HARD_RPE = 9;
/** So lange wirkt eine sehr harte Einheit in der Tagesform nach (Faustregel, kein fester Studienwert). */
export const HARD_HOURS = 48;
/** So lange werden gemeldete Schmerzen in den nächsten Check-in übernommen. */
export const PAIN_CARRY_HOURS = 72;

export const MAX_TITLE = 60;
export const MAX_NOTE = 1000;

const int = (v, lo, hi) => (v == null || v === '' || !Number.isFinite(+v) ? null : Math.min(hi, Math.max(lo, Math.round(+v))));

/** Eingaben prüfen und aufräumen. Gibt immer ein vollständiges Objekt zurück. */
export function cleanCheckout(c = {}, now = Date.now()) {
  const pain = [...new Set((c.pain ?? []).filter((r) => REGIONS[r]))];
  const photo = typeof c.photo === 'string' && c.photo.startsWith('data:image/') ? c.photo : null;
  return {
    title: String(c.title ?? '').trim().slice(0, MAX_TITLE),
    rpe: int(c.rpe, 0, 10),
    feel: int(c.feel, -2, 2),
    pain,
    note: String(c.note ?? '').trim().slice(0, MAX_NOTE),
    photo,
    at: c.at ?? now,
  };
}

/** Angezeigter Titel: eigener Titel aus dem Abschluss, sonst der Plan-Titel. */
export const titleOf = (s) => s?.checkout?.title || s?.title || 'Training';

export const sessionTs = (s) => s?.startedAt ?? (s?.date ? new Date(s.date).getTime() : 0);
export const sessionEnd = (s) => s?.endedAt ?? sessionTs(s);

/** Trainingsdauer in Minuten (ohne Abschluss-Bildschirm), null wenn unbekannt. */
export function durationMin(s) {
  if (!s?.startedAt || !s?.endedAt || s.endedAt <= s.startedAt) return null;
  return Math.round((s.endedAt - s.startedAt) / 60000);
}

/** Session-RPE-Last = RPE × Minuten (Foster). null ohne RPE oder Dauer. */
export function sessionLoad(s) {
  const rpe = s?.checkout?.rpe;
  const min = durationMin(s);
  return rpe == null || min == null ? null : rpe * min;
}

const mondayOf = (ts) => {
  const x = new Date(ts);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
};

/**
 * Trainingslast je Woche (Mo–So) für die letzten `weeks` Wochen, älteste zuerst.
 * @returns {{start:number, load:number, n:number, rated:number, deload:boolean}[]}
 *   n = Einheiten, rated = davon mit RPE, deload = Woche enthält eine Einheit aus einer Deload-Woche
 */
export function weeklyLoad(sessions = [], { weeks = 8, now = Date.now() } = {}) {
  const thisMon = mondayOf(now);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    // Wochenstart über das Datum bestimmen (Zeitumstellung!), nicht über 7 × 24 h.
    const d = new Date(thisMon);
    d.setDate(d.getDate() - 7 * i);
    out.push({ start: d.getTime(), load: 0, n: 0, rated: 0, deload: false });
  }
  for (const s of sessions) {
    if (s.status !== 'done') continue;
    const w = out.find((x) => x.start === mondayOf(sessionTs(s)));
    if (!w) continue;
    w.n++;
    if (s.block?.deload) w.deload = true;
    const l = sessionLoad(s);
    if (l != null) { w.load += l; w.rated++; }
  }
  return out;
}

const doneBefore = (sessions, now) => sessions
  .filter((s) => s.status === 'done' && sessionEnd(s) <= now)
  .sort((a, b) => sessionEnd(a) - sessionEnd(b));

/** Letzte Einheit, wenn sie sehr hart war und weniger als HARD_HOURS her ist: { rpe, hours, title } */
export function lastHard(sessions = [], now = Date.now()) {
  const last = doneBefore(sessions, now).pop();
  const rpe = last?.checkout?.rpe;
  if (rpe == null || rpe < HARD_RPE) return null;
  const hours = (now - sessionEnd(last)) / H;
  return hours < HARD_HOURS ? { rpe, hours: Math.round(hours), title: titleOf(last) } : null;
}

/** Schmerzbereiche aus der letzten Einheit (wenn < PAIN_CARRY_HOURS her) – für den nächsten Check-in. */
export function carriedPain(sessions = [], now = Date.now()) {
  const last = doneBefore(sessions, now).pop();
  if (!last?.checkout?.pain?.length) return [];
  return now - sessionEnd(last) < PAIN_CARRY_HOURS * H ? last.checkout.pain.filter((r) => REGIONS[r]) : [];
}

/** Kurzzeile für Verlauf und KI, z. B. "RPE 8 (Sehr schwer) · Gefühl: Gut · Schmerzen: Schultern · „Griff war das Limit“" */
export function checkoutLine(c, { note = true } = {}) {
  if (!c) return '';
  const parts = [];
  if (c.rpe != null) parts.push(`RPE ${c.rpe} (${rpeLabel(c.rpe)})`);
  const f = feelOf(c.feel);
  if (f) parts.push(`Gefühl: ${f[1]}`);
  if (c.pain?.length) parts.push(`Schmerzen: ${c.pain.map((r) => REGIONS[r]?.label).filter(Boolean).join(', ')}`);
  if (note && c.note) parts.push(`„${c.note.length > 140 ? c.note.slice(0, 137) + '…' : c.note}“`);
  return parts.join(' · ');
}

/** Letzte Abschlüsse als Text für die KI (Plan und Chat). */
export function checkoutsText(sessions = [], { n = 3, now = Date.now() } = {}) {
  const rows = doneBefore(sessions, now).filter((s) => s.checkout).slice(-n).reverse().map((s) => {
    const days = Math.round((now - sessionEnd(s)) / DAY);
    const min = durationMin(s);
    return `vor ${days} T.: ${titleOf(s)}${min ? `, ${min} Min` : ''} – ${checkoutLine(s.checkout) || 'ohne Angaben'}`;
  });
  return rows.join('\n') || 'keine';
}
