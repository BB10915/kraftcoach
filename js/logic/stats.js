// Statistiken: Rekorde, Wochenvolumen, Kalender/Serie, Verlauf pro Übung.

import { getEx, MUSCLES } from '../data/exercises.js';
import { setE1rm, effLoad } from './e1rm.js';
import { workSets } from './history.js';
import { dayKey, startOfWeek, groupBy, DAY } from '../util.js';

/**
 * Rekorde markieren. Ein Satz ist ein Rekord, wenn er das bisher beste e1RM
 * oder das bisher höchste Gewicht (bei ≥ gleich vielen Wdh.) übertrifft.
 * Die allererste Einheit einer Übung zählt nicht (sonst wäre alles ein Rekord).
 * -> Map setId -> ['e1rm' | 'gewicht']
 */
export function computePRs(sets, bodyweight = 80) {
  const prs = new Map();
  const best = new Map(); // exId -> { e1, w, firstSession }
  for (const s of workSets(sets).sort((a, b) => a.ts - b.ts)) {
    const ex = getEx(s.exerciseId);
    if (ex.timed) continue;
    const e1 = setE1rm(ex, s, bodyweight);
    const b = best.get(s.exerciseId);
    if (!b) {
      best.set(s.exerciseId, { e1, w: s.weight, firstSession: s.sessionId });
      continue;
    }
    const kinds = [];
    if (s.sessionId !== b.firstSession) {
      if (e1 > b.e1 + 0.01) kinds.push('e1rm');
      if (s.weight > b.w && !ex.bw) kinds.push('gewicht');
    }
    if (kinds.length) prs.set(s.id, kinds);
    b.e1 = Math.max(b.e1, e1);
    b.w = Math.max(b.w, s.weight);
  }
  return prs;
}

/** Bestwerte pro Übung. */
export function bestsFor(exerciseId, sets, bodyweight = 80) {
  const ex = getEx(exerciseId);
  let e1 = 0, e1Set = null, heavy = null;
  for (const s of workSets(sets)) {
    if (s.exerciseId !== exerciseId) continue;
    const v = setE1rm(ex, s, bodyweight);
    if (v > e1) { e1 = v; e1Set = s; }
    if (!heavy || s.weight > heavy.weight || (s.weight === heavy.weight && s.reps > heavy.reps)) heavy = s;
  }
  return { e1, e1Set, heavy };
}

/** Verlauf: bestes e1RM und schwerster Satz pro Einheit. */
export function seriesFor(exerciseId, sets, bodyweight = 80) {
  const ex = getEx(exerciseId);
  const mine = workSets(sets).filter((s) => s.exerciseId === exerciseId);
  const g = groupBy(mine, (s) => s.sessionId);
  return [...g.values()]
    .map((ss) => {
      const top = ss.reduce((a, s) => (setE1rm(ex, s, bodyweight) > setE1rm(ex, a, bodyweight) ? s : a));
      return {
        ts: ss[0].ts,
        e1: setE1rm(ex, top, bodyweight),
        top,
        sets: ss.length,
        tonnage: ss.reduce((a, s) => a + effLoad(ex, s.weight, bodyweight) * s.reps * (ex.perHand ? 2 : 1), 0),
      };
    })
    .sort((a, b) => a.ts - b.ts);
}

/** Arbeitssätze pro Muskelgruppe in der Woche von `weekStart` (Primär 1, Sekundär 0,5). */
export function weeklyVolume(sets, weekStart = startOfWeek(Date.now())) {
  const from = new Date(weekStart).getTime();
  const to = from + 7 * DAY;
  const vol = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, 0]));
  for (const s of workSets(sets)) {
    if (s.ts < from || s.ts >= to) continue;
    const ex = getEx(s.exerciseId);
    for (const m of ex.primary) vol[m] += 1;
    for (const m of ex.secondary) vol[m] += 0.5;
  }
  return vol;
}

/** Trainingstage (YYYY-MM-DD) aus abgeschlossenen Einheiten. */
export function trainingDays(sessions) {
  return new Set(sessions.filter((s) => s.status === 'done').map((s) => dayKey(s.startedAt ?? s.date)));
}

/**
 * Serie in Wochen: aufeinanderfolgende Wochen mit mindestens `minPerWeek` Einheiten.
 * Die laufende Woche zählt mit, sobald das Ziel erreicht ist – sonst bricht sie die Serie nicht.
 */
export function weekStreak(sessions, minPerWeek = 3, now = Date.now()) {
  const done = sessions.filter((s) => s.status === 'done');
  const perWeek = groupBy(done, (s) => startOfWeek(s.startedAt ?? s.date).getTime());
  let wk = startOfWeek(now).getTime();
  const thisWeek = perWeek.get(wk)?.length ?? 0;
  let streak = thisWeek >= minPerWeek ? 1 : 0;
  for (;;) {
    wk = startOfWeek(wk - 3 * DAY).getTime();
    if ((perWeek.get(wk)?.length ?? 0) >= minPerWeek) streak++;
    else break;
  }
  return { streak, thisWeek };
}
