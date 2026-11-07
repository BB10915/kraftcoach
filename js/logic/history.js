// Auswertung der Historie: Erholung pro Muskel, frühere Leistungen pro Übung.

import { getEx, MUSCLES, RECOVERY_H } from '../data/exercises.js';
import { setE1rm } from './e1rm.js';
import { groupBy, clamp } from '../util.js';

const H = 3600000;

/** Arbeitssätze (ohne Aufwärmsätze). */
export const workSets = (sets) => sets.filter((s) => !s.warmup);

/**
 * Status je Muskel: zuletzt trainiert, Sätze in 7 Tagen, Erholung 0..1.
 * Primärmuskel zählt 1 Satz, Sekundärmuskel 0,5.
 */
export function muscleStatus(sets, now = Date.now()) {
  const out = {};
  for (const m of Object.keys(MUSCLES)) out[m] = { last: null, hours: Infinity, sets7d: 0, load48h: 0, readiness: 1 };
  for (const s of workSets(sets)) {
    const ex = getEx(s.exerciseId);
    const age = (now - s.ts) / H;
    for (const [list, w] of [[ex.primary, 1], [ex.secondary, 0.5]]) {
      for (const m of list) {
        const o = out[m];
        if (!o) continue;
        if (!o.last || s.ts > o.last) o.last = s.ts;
        if (age <= 168) o.sets7d += w;
        if (age <= 48) o.load48h += w;
      }
    }
  }
  for (const [m, o] of Object.entries(out)) {
    if (!o.last) continue;
    o.hours = (now - o.last) / H;
    // Mehr Sätze zuletzt -> längere Erholung (max. +50 %)
    const need = RECOVERY_H[m] * (1 + clamp((o.load48h - 6) / 12, 0, 0.5));
    o.readiness = clamp(o.hours / need, 0, 1);
  }
  return out;
}

/**
 * Frühere Einheiten einer Übung, neueste zuerst.
 * -> [{ sessionId, date, sets:[...], best }]
 */
export function prevSessionsFor(exerciseId, allSets, { excludeSessionId = null, bodyweight = 80 } = {}) {
  const ex = getEx(exerciseId);
  const mine = workSets(allSets).filter((s) => s.exerciseId === exerciseId && s.sessionId !== excludeSessionId);
  const g = groupBy(mine, (s) => s.sessionId);
  const list = [...g.entries()].map(([sessionId, sets]) => {
    sets.sort((a, b) => a.ts - b.ts);
    return { sessionId, date: sets[0].ts, sets, best: Math.max(...sets.map((s) => setE1rm(ex, s, bodyweight))) };
  });
  return list.sort((a, b) => b.date - a.date);
}

/** Wann wurde eine Übung zuletzt gemacht (ts) – für Rotation. */
export function lastUsedMap(allSets) {
  const m = new Map();
  for (const s of allSets) if (!m.has(s.exerciseId) || m.get(s.exerciseId) < s.ts) m.set(s.exerciseId, s.ts);
  return m;
}
