// Zeitschätzung für Übungen/Einheiten und Kürzungsvorschläge, damit das Zeitbudget hält.

import { getEx } from '../data/exercises.js';
import { clamp } from '../util.js';

export const TRANSITION_SEC = 60; // Wechsel zur nächsten Übung

/** Aufwärmsätze vor schweren Grundübungen. */
export function warmupSec(ex) {
  if (ex.kind !== 'compound' || ex.bw) return 0;
  return ex.eq === 'lh' ? 180 : 90;
}

export function setWorkSec(ex, reps) {
  return Math.max(15, reps * (ex.secPerRep || 3));
}

const avgReps = (item) => Math.round(((item.repsMin || 8) + (item.repsMax || 12)) / 2);

/** Geschätzte Dauer einer Übung in Sekunden (inkl. Aufbau, Aufwärmen, Pausen, Wechsel). */
export function itemSec(item) {
  if (item.kind === 'timed') return (item.minutes || 5) * 60;
  const ex = getEx(item.exerciseId);
  const n = Math.max(0, item.sets);
  if (!n) return 0;
  return (ex.setup || 40) + warmupSec(ex) + n * setWorkSec(ex, avgReps(item)) + (n - 1) * item.restSec + TRANSITION_SEC;
}

export function sessionSec(items) {
  return items.filter((i) => i.status !== 'skipped').reduce((a, i) => a + itemSec(i), 0);
}

/** Restdauer einer Übung, wenn `done` Sätze bereits erledigt sind. */
export function itemRemainingSec(item, done) {
  if (item.status === 'skipped' || item.status === 'done') return 0;
  if (item.kind === 'timed') return itemSec(item);
  if (done <= 0) return itemSec(item);
  const ex = getEx(item.exerciseId);
  const left = Math.max(0, item.sets - done);
  if (!left) return 0;
  return left * (setWorkSec(ex, avgReps(item)) + item.restSec) + TRANSITION_SEC;
}

/**
 * Hochrechnung während des Trainings.
 * doneCount: Map itemUid -> Anzahl erledigter Arbeitssätze
 */
export function projection(session, doneCount, now = Date.now()) {
  const elapsed = session.startedAt ? (now - session.startedAt) / 1000 : 0;
  const items = session.items;
  let plannedDone = 0;
  let remaining = 0;
  for (const it of items) {
    const done = doneCount.get(it.uid) || 0;
    const full = it.status === 'skipped' ? 0 : itemSec(it);
    const rem = itemRemainingSec(it, done);
    remaining += rem;
    if (it.status === 'done' || done > 0) plannedDone += Math.max(0, full - rem);
  }
  // Tempo: Wie schnell bin ich im Vergleich zur Planung? (erst nach ~8 Min aussagekräftig)
  let pace = 1;
  if (elapsed > 480 && plannedDone > 240) pace = clamp(elapsed / plannedDone, 0.8, 1.6);
  const projected = elapsed + remaining * pace;
  const budget = (session.budgetMin || 50) * 60;
  return { elapsed, remaining: remaining * pace, projected, budget, over: projected - budget, pace };
}

/**
 * Kandidaten zum Kürzen, in sinnvoller Reihenfolge:
 * 1) Finisher, 2) Sätze von Isolationsübungen, 3) ganze Isolationsübungen (von hinten),
 * 4) Sätze von Grundübungen (nicht unter 2), 5) ganze Übungen von hinten.
 * Begonnene Übungen werden nicht komplett gestrichen.
 */
export function cutCandidates(items, doneCount = new Map()) {
  const open = items.filter((i) => i.status === 'open' || i.status === undefined);
  const out = [];
  const exOf = (i) => getEx(i.exerciseId);
  const name = (i) => exOf(i).name;
  const done = (i) => doneCount.get(i.uid) || 0;
  const rev = [...open].reverse();

  for (const i of rev) if (i.kind === 'timed' && i.role === 'finisher' && !done(i))
    out.push({ type: 'dropItem', uid: i.uid, label: `${name(i)} streichen`, saves: itemSec(i) });

  for (const i of rev)
    if (i.kind !== 'timed' && exOf(i).kind === 'isolation' && i.sets > 2 && i.sets - done(i) >= 1)
      out.push({ type: 'dropSet', uid: i.uid, label: `1 Satz ${name(i)} streichen`, saves: setSaves(i) });

  for (const i of rev)
    if (i.kind !== 'timed' && exOf(i).kind === 'isolation' && done(i) === 0)
      out.push({ type: 'dropItem', uid: i.uid, label: `${name(i)} streichen`, saves: itemSec(i) });

  for (const i of rev)
    if (i.kind !== 'timed' && exOf(i).kind === 'compound' && i.sets > 2 && i.sets - done(i) >= 1)
      out.push({ type: 'dropSet', uid: i.uid, label: `1 Satz ${name(i)} streichen`, saves: setSaves(i) });

  for (const i of rev)
    if (done(i) === 0 && i.role !== 'warmup' && !out.some((c) => c.type === 'dropItem' && c.uid === i.uid))
      out.push({ type: 'dropItem', uid: i.uid, label: `${name(i)} streichen`, saves: itemSec(i) });

  return out;
}

function setSaves(item) {
  const ex = getEx(item.exerciseId);
  return setWorkSec(ex, avgReps(item)) + item.restSec;
}

export function applyCut(items, cut) {
  return items.map((i) => {
    if (i.uid !== cut.uid) return i;
    if (cut.type === 'dropSet') return { ...i, sets: Math.max(1, i.sets - 1) };
    return { ...i, status: 'skipped' };
  });
}

/** Plan so lange kürzen, bis er ins Budget passt (Toleranz 1 Min). */
export function fitToBudget(items, budgetSec) {
  let cur = items.map((i) => ({ ...i }));
  for (let guard = 0; guard < 60 && sessionSec(cur) > budgetSec + 60; guard++) {
    const cand = cutCandidates(cur)[0];
    if (!cand) break;
    cur = applyCut(cur, cand);
  }
  return cur.filter((i) => i.status !== 'skipped');
}

/** Bester Kürzungsvorschlag für eine Überschreitung von overSec. */
export function proposeCut(items, doneCount, overSec) {
  const c = cutCandidates(items, doneCount);
  if (!c.length) return null;
  // Erster Kandidat, der allein reicht (kleinster Eingriff zuerst) …
  const enough = c.find((x) => x.saves >= overSec);
  if (enough) return enough;
  // … sonst der Vorschlag mit der größten Ersparnis (z. B. ganze Übung bei großem Rückstand).
  if (overSec > 300) return c.reduce((a, b) => (b.saves > a.saves ? b : a));
  return c[0];
}
