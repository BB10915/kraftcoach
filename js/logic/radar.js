// Fortschritts-Netzdiagramm: Werte 0–100 je Achse, heute und vor 8 Wochen.
// Übersicht „Fitness-Profil“ (6 Achsen) und Detail „Kraftprofil“ (6 Grundübungen).

import { getEx, MUSCLES } from '../data/exercises.js';
import { setE1rm } from './e1rm.js';
import { workSets } from './history.js';
import { clamp, DAY } from '../util.js';

export const COMPARE_DAYS = 56; // Vergleich mit dem Stand vor 8 Wochen
const STRENGTH_WINDOW = 42; // bestes e1RM der letzten 6 Wochen zählt
const WINDOW = 28; // Volumen, Konstanz, Kondition, Beweglichkeit, Erholung: letzte 4 Wochen

/**
 * Kraftachsen. target = e1RM ÷ Körpergewicht, das 100 Punkte gibt (solides Fortgeschrittenen-Niveau).
 * eq = verwandte Übungen und Faktor, mit dem ihr e1RM in die Leitübung umgerechnet wird
 * (grobe Erfahrungswerte; bei Kurzhanteln ist das e1RM pro Hand gespeichert).
 */
export const STRENGTH_AXES = [
  { key: 'vpush', label: 'Schulterdrücken', target: 0.75, eq: { 'lh-schulterdruecken': 1, 'kh-schulterdruecken': 2.2, 'ma-schulterpresse': 0.9 } },
  { key: 'hpush', label: 'Bankdrücken', target: 1.25, eq: { 'lh-bankdruecken': 1, 'kh-bankdruecken': 2.4, 'lh-schraegbank': 1.15, 'kh-schraegbank': 2.7, 'ma-brustpresse': 0.9 } },
  { key: 'squat', label: 'Kniebeuge', target: 1.5, eq: { 'lh-kniebeuge': 1, 'lh-frontkniebeuge': 1.2, 'ma-hackenschmidt': 0.8, 'ma-beinpresse': 0.5 } },
  { key: 'hinge', label: 'Kreuzheben', target: 2.0, eq: { 'lh-kreuzheben': 1, 'lh-rdl': 1.3, 'kh-rdl': 2.6 } },
  { key: 'hpull', label: 'Rudern', target: 1.0, eq: { 'lh-rudern': 1, 'kh-rudern': 2.2, 'kz-rudern': 1, 'ma-rudern': 1 } },
  { key: 'vpull', label: 'Klimmzug', target: 1.3, eq: { 'kg-klimmzug': 1, 'kz-latziehen': 1, 'kz-latziehen-eng': 1 } },
];

export const FITNESS_AXES = [
  { key: 'mobility', label: 'Beweglichkeit', hint: 'Mobility-Minuten pro Woche, Ziel 30' },
  { key: 'strength', label: 'Kraft', hint: 'Mittel aus dem Kraftprofil' },
  { key: 'consistency', label: 'Konstanz', hint: 'Einheiten pro Woche im Vergleich zu deinem Ziel' },
  { key: 'volume', label: 'Muskelaufbau', hint: 'Wochensätze je Muskel, voll ab 6' },
  { key: 'recovery', label: 'Erholung', hint: 'HRV, Ruhepuls und Schlaf im Vergleich zu deinem Normalwert' },
  { key: 'conditioning', label: 'Kondition', hint: 'Cardio-Minuten pro Woche (Ziel 60), dazu Schritte' },
];

const round = (x) => (x == null ? null : Math.round(clamp(x, 0, 100)));
const mean = (xs) => {
  const v = xs.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const doneIn = (sessions, from, to) =>
  sessions.filter((s) => s.status === 'done' && (s.startedAt ?? new Date(s.date).getTime()) >= from && (s.startedAt ?? new Date(s.date).getTime()) < to);

/** Kraftwerte 0–100 je Achse zum Zeitpunkt `at` (null = keine passende Übung im Zeitraum). */
export function strengthScores(sets, bodyweight = 80, at = Date.now()) {
  const from = at - STRENGTH_WINDOW * DAY;
  const best = {};
  for (const s of workSets(sets)) {
    if (s.ts < from || s.ts >= at) continue;
    for (const ax of STRENGTH_AXES) {
      const f = ax.eq[s.exerciseId];
      if (!f) continue;
      const v = setE1rm(getEx(s.exerciseId), s, bodyweight) * f;
      if (v > (best[ax.key] ?? 0)) best[ax.key] = v;
    }
  }
  return Object.fromEntries(STRENGTH_AXES.map((ax) => [ax.key, best[ax.key] ? round((best[ax.key] / bodyweight / ax.target) * 100) : null]));
}

/** Minuten zeitbasierter Übungen (cardio | mobility) in erledigten Einheiten. */
function timedMinutes(sessions, kind) {
  let m = 0;
  for (const s of sessions) for (const it of s.items ?? []) {
    if (it.kind === 'timed' && it.status === 'done' && getEx(it.exerciseId).kind === kind) m += it.minutes || 0;
  }
  return m;
}

/**
 * Gesundheitswerte aus den Check-ins der Einheiten (bis es eine tägliche Speicherung gibt).
 * -> [{ ts, hr?, hrv?, sleepH?, steps? }]
 */
export function healthFromSessions(sessions) {
  const out = [];
  for (const s of sessions) {
    const c = s.checkin;
    if (!c) continue;
    const h = c.health ?? {};
    const r = { ts: s.startedAt ?? new Date(s.date).getTime(), hr: c.hr ?? h.hr, hrv: c.hrv ?? h.hrv, sleepH: h.sleepH ?? c.sleepH, steps: h.steps };
    if (r.hr || r.hrv || r.sleepH || r.steps != null) out.push(r);
  }
  return out;
}

/** Erholung 0–100: HRV und Ruhepuls gegen Normalwert (Profil oder eigener Schnitt), Schlaf 8 h = 100. */
export function recoveryScore(health, profile = {}, from, to) {
  const recent = health.filter((h) => h.ts >= from && h.ts < to);
  if (recent.length < 3) return null;
  const all = health.filter((h) => h.ts < to);
  const avg = (list, k) => mean(list.map((h) => h[k] ?? null));
  const baseHrv = profile.body?.hrv || avg(all, 'hrv');
  const baseHr = profile.body?.restingHr || avg(all, 'hr');
  const hrv = avg(recent, 'hrv'), hr = avg(recent, 'hr'), sleep = avg(recent, 'sleepH');
  return round(mean([
    hrv && baseHrv ? 50 + (hrv / baseHrv - 1) * 250 : null, // +20 % über Normal = 100
    hr && baseHr ? 50 + (1 - hr / baseHr) * 500 : null, // −10 % unter Normal = 100
    sleep ? ((sleep - 5) / 3) * 100 : null, // 5 h = 0, 8 h = 100
  ]));
}

/** Fitness-Profil 0–100 je Achse zum Zeitpunkt `at`. */
export function fitnessScores({ sessions = [], sets = [], profile = {}, health = null }, at = Date.now()) {
  const bw = profile.bodyweight || 80;
  const from = at - WINDOW * DAY;
  const weeks = WINDOW / 7;
  const done = doneIn(sessions, from, at);
  const hlth = health ?? healthFromSessions(sessions);

  // Muskelaufbau: Ø Wochensätze je Muskel, voll ab 6 (Primär 1, Sekundär 0,5)
  const vol = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, 0]));
  let any = false;
  for (const s of workSets(sets)) {
    if (s.ts < from || s.ts >= at) continue;
    const ex = getEx(s.exerciseId);
    for (const m of ex.primary) if (m in vol) { vol[m] += 1; any = true; }
    for (const m of ex.secondary) if (m in vol) vol[m] += 0.5;
  }
  const volume = any ? mean(Object.values(vol).map((v) => Math.min(v / weeks / 6, 1) * 100)) : null;

  const perWeek = parseInt(String(profile.daysPerWeek), 10) || 3;
  const hadAny = sessions.some((s) => s.status === 'done' && (s.startedAt ?? new Date(s.date).getTime()) < at);
  const consistency = hadAny ? (done.length / weeks / perWeek) * 100 : null;

  const steps = mean(hlth.filter((h) => h.ts >= from && h.ts < at && h.steps != null).map((h) => h.steps));
  const cardio = timedMinutes(done, 'cardio') / weeks;
  const conditioning = hadAny ? mean([Math.min(cardio / 60, 1) * 100, steps != null ? Math.min(steps / 10000, 1) * 100 : null]) : null;
  const mobility = hadAny ? Math.min(timedMinutes(done, 'mobility') / weeks / 30, 1) * 100 : null;

  return {
    mobility: round(mobility),
    strength: round(mean(Object.values(strengthScores(sets, bw, at)))),
    consistency: round(consistency),
    volume: round(volume),
    recovery: recoveryScore(hlth, profile, from, at),
    conditioning: round(conditioning),
  };
}

/** Beide Profile, heute und vor 8 Wochen. */
export function progressRadar(data, now = Date.now()) {
  const bw = data.profile?.bodyweight || 80;
  const before = now - COMPARE_DAYS * DAY;
  return {
    fitness: { now: fitnessScores(data, now), before: fitnessScores(data, before) },
    strength: { now: strengthScores(data.sets ?? [], bw, now), before: strengthScores(data.sets ?? [], bw, before) },
  };
}
