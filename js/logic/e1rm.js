// Geschätztes 1RM nach Epley, erweitert um RIR ("Wiederholungen im Tank").
// Idee: Ein Satz mit 8 Wdh. bei RIR 2 entspricht ~10 Wdh. bis zum Versagen.

/** Wert, mit dem "4+" in Berechnungen zählt. */
export const RIR_PLUS = 5;
const MAX_REPS_FOR_ESTIMATE = 15; // darüber wird die Schätzung unzuverlässig

export function e1rm(load, reps, rir = 0) {
  if (!(load > 0) || !(reps > 0)) return 0;
  const rr = rir >= 4 ? RIR_PLUS : rir ?? 0; // gespeichert wird 4 = "4+"
  const r = Math.min(reps + rr, MAX_REPS_FOR_ESTIMATE);
  if (r <= 1) return load;
  return load * (1 + r / 30);
}

/** Last, mit der man `reps` Wdh. bei `rir` schafft. */
export function loadFor(est, reps, rir = 0) {
  const r = reps + rir;
  if (r <= 1) return est;
  return est / (1 + r / 30);
}

/** Wdh., die man mit `load` bei `rir` schafft (abgerundet). */
export function repsFor(est, load, rir = 0) {
  if (!(load > 0)) return 99;
  if (load >= est) return Math.max(0, 1 - rir);
  return Math.floor(30 * (est / load - 1) - rir + 1e-6);
}

/** Effektive Last inkl. Körpergewichtsanteil (Klimmzüge, Dips …). */
export function effLoad(ex, weight, bodyweight = 80) {
  return (ex?.bw ? ex.bw * bodyweight : 0) + (weight || 0);
}

/** e1RM eines geloggten Satzes. */
export function setE1rm(ex, set, bodyweight) {
  return e1rm(effLoad(ex, set.weight, bodyweight), set.reps, set.rir ?? 0);
}
