// Live-Anpassung: Vorschlag für den nächsten Satz aus dem letzten Satz (Gewicht, Wdh., RIR).
// Läuft komplett lokal – sofort, offline und ohne KI-Anfrage.

import { e1rm, loadFor, repsFor, effLoad, RIR_PLUS } from './e1rm.js';
import { roundTo, clamp, fmtNum } from '../util.js';

/** Leistung sinkt von Satz zu Satz leicht (Ermüdung). */
export const FATIGUE = 0.98;
const MAX_UP = 1.25; // max. +25 % pro Satz
const MAX_DOWN = 0.8; // max. −20 % pro Satz
const CALIB_JUMP = 1.25; // Kalibrierung: bei RIR 4+ direkt +25 %

const EXP_FACTOR = { anfaenger: 0.6, wiedereinsteiger: 0.8, fortgeschritten: 1 };

function ctxOf(ex, item, bodyweight) {
  return {
    min: item.repsMin,
    max: item.repsMax,
    rir: item.rir ?? 2,
    step: ex.step || 2.5,
    bwLoad: ex.bw ? ex.bw * bodyweight : 0,
    isBw: !!ex.bw,
  };
}

function minWeight(c) {
  return c.isBw ? 0 : c.step;
}

/**
 * Wählt Gewicht + Wdh. für eine geschätzte Maximalkraft `est`.
 * Bevorzugt: Gewicht halten und Wdh. anpassen (doppelte Progression),
 * sonst Gewicht so ändern, dass die Wdh. wieder im Zielbereich landen.
 */
export function pick(est, c, prevWeight = null, { progress = false } = {}) {
  // progress: Zum Start einer Übung gilt "oberes Ende erreicht" schon als Signal zum Steigern.
  const top = progress ? c.max - 1 : c.max;
  if (prevWeight != null) {
    const r = repsFor(est, prevWeight + c.bwLoad, c.rir);
    if (r >= c.min && r <= top) return { weight: prevWeight, reps: r };
    if (c.isBw && prevWeight === 0 && r < c.min) return { weight: 0, reps: Math.max(1, r) };
  }
  const tooMany = prevWeight != null && repsFor(est, prevWeight + c.bwLoad, c.rir) > top;
  // Bei Steigerung im unteren Drittel des Bereichs landen (Luft nach oben), sonst Mitte.
  const goal = tooMany ? Math.round(c.min + (c.max - c.min) * 0.34) : Math.round((c.min + c.max) / 2);
  // Beim Steigern normal runden, sonst lieber abrunden (sicherer).
  let w = roundTo(loadFor(est, goal, c.rir) - c.bwLoad, c.step, tooMany ? 'round' : 'floor');
  if (prevWeight != null) {
    if (w === prevWeight) w = prevWeight + (tooMany ? c.step : -c.step);
    if (prevWeight > 0) {
      w = clamp(w, roundTo(prevWeight * MAX_DOWN, c.step, 'ceil'), roundTo(prevWeight * MAX_UP, c.step, 'floor'));
      if (tooMany && w <= prevWeight) w = prevWeight + c.step;
    }
  }
  w = Math.max(minWeight(c), w);
  let reps = repsFor(est, w + c.bwLoad, c.rir);
  // Nächste Gewichtsstufe zu groß (z. B. 5-kg-Schritte an Maschinen)? Dann Gewicht halten, mehr Wdh.
  if (tooMany && reps < c.min) return { weight: prevWeight, reps: Math.min(c.max, repsFor(est, prevWeight + c.bwLoad, c.rir)) };
  // Beim Reduzieren notfalls noch eine Stufe leichter, bis der Zielbereich erreichbar ist.
  while (!tooMany && reps < c.min && w - c.step >= minWeight(c) && (prevWeight == null || w - c.step >= prevWeight * MAX_DOWN)) {
    w = roundTo(w - c.step, c.step);
    reps = repsFor(est, w + c.bwLoad, c.rir);
  }
  return { weight: w, reps: clamp(reps, 1, c.max) };
}

/**
 * Nächster Satz innerhalb einer Übung.
 * lastSet = { weight, reps, rir }
 */
export function suggestNext({ ex, item, lastSet, bodyweight = 80, calibrating = false }) {
  const c = ctxOf(ex, item, bodyweight);
  const rirVal = lastSet.rir ?? c.rir;
  const diff = rirVal - c.rir;

  // Kalibrierung: viel zu leicht -> großer, aber gedeckelter Sprung
  if (calibrating && rirVal >= 4 && !c.isBw) {
    const w = Math.max(lastSet.weight + c.step, roundTo(lastSet.weight * CALIB_JUMP, c.step));
    return {
      weight: w,
      reps: clamp(lastSet.reps, c.min, c.max),
      reason: `Kalibrierung: noch viel Luft (RIR ${rirLabel(rirVal)}) → +${fmtNum(w - lastSet.weight)} kg`,
    };
  }

  const est = e1rm(effLoad(ex, lastSet.weight, bodyweight), lastSet.reps, rirVal) * FATIGUE;
  const next = pick(est, c, lastSet.weight);
  return { ...next, reason: reasonText(diff, lastSet, next, c.rir) };
}

/**
 * Erster Satz einer Übung in dieser Einheit – aus der Historie (vorige Einheiten).
 * prevSessions = [{ sets:[{weight,reps,rir}], date }] neueste zuerst
 */
export function suggestFirst({ ex, item, prevSessions = [], bodyweight = 80, experience = 'fortgeschritten', now = Date.now(), baseline = null }) {
  const c = ctxOf(ex, item, bodyweight);
  const last = prevSessions.find((p) => p.sets.length);
  if (!last && baseline?.reps > 0 && (baseline.weight > 0 || c.isBw)) {
    // Selbst angegebener Startwert ("schaffe ich sauber" ≈ RIR 1), zur Sicherheit 8 % Abschlag.
    const est = e1rm(effLoad(ex, baseline.weight, bodyweight), baseline.reps, 1) * 0.92;
    const next = pick(est, c, null);
    return {
      ...next,
      calibrating: false,
      reason: `Aus deinem Startwert (${fmtNum(baseline.weight)} kg × ${baseline.reps}) – zum Einstieg etwas leichter`,
    };
  }
  if (!last) {
    const w = c.isBw ? 0 : Math.max(c.step, roundTo((ex.start || 10) * (EXP_FACTOR[experience] ?? 1), c.step));
    return {
      weight: w,
      reps: c.max,
      calibrating: true,
      reason: 'Kalibrierung: Bewusst leicht starten und ehrlich den RIR angeben – die App steigert dann Satz für Satz.',
    };
  }
  const best = Math.max(...last.sets.map((s) => e1rm(effLoad(ex, s.weight, bodyweight), s.reps, s.rir ?? c.rir)));
  const days = (now - new Date(last.date).getTime()) / 86400000;
  const detrain = days > 28 ? 0.9 : days > 14 ? 0.95 : 1;
  const calibrating = !prevSessions.some((p) => p.sets.some((s) => (s.rir ?? 0) <= 3));
  const firstW = last.sets[0].weight;
  const next = pick(best * detrain, c, firstW, { progress: detrain === 1 });
  let reason;
  if (detrain < 1) reason = `Letztes Training vor ${Math.round(days)} Tagen → etwas vorsichtiger`;
  else if (next.weight > firstW) reason = `Letztes Mal stark (bis ${fmtNum(best, 0)} kg e1RM) → mehr Gewicht`;
  else if (next.weight < firstW) reason = 'Letztes Mal war es schwer → etwas weniger Gewicht';
  else reason = `Wie letztes Mal: ${fmtNum(firstW)} kg – Ziel ${next.reps} Wdh.`;
  return { ...next, calibrating, reason };
}

export function rirLabel(r) {
  return r >= 4 ? '4+' : String(r);
}

function reasonText(diff, last, next, target) {
  const dw = next.weight - last.weight;
  const wTxt = dw > 0 ? `+${fmtNum(dw)} kg` : dw < 0 ? `−${fmtNum(-dw)} kg` : 'Gewicht halten';
  if (diff === 0) return `Passt genau (RIR ${target}) → ${wTxt}${dw === 0 ? `, ${next.reps} Wdh.` : ''}`;
  if (diff > 0) return `Leichter als geplant (RIR ${rirLabel(last.rir)} statt ${target}) → ${wTxt}`;
  return `Schwerer als geplant (RIR ${rirLabel(last.rir)} statt ${target}) → ${wTxt}`;
}

export { RIR_PLUS };
