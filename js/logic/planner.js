// Lokaler Planer: erstellt eine Einheit ohne KI (Ersatz, wenn die KI nicht erreichbar ist).

import { EXERCISES, PATTERNS, MUSCLES, getEx } from '../data/exercises.js';
import { REGIONS, fatigueLevel } from '../data/goals.js';
import { muscleStatus, lastUsedMap } from './history.js';
import { itemSec, sessionSec, fitToBudget } from './timing.js';
import { uid, clamp } from '../util.js';
import { DAYS, dayForToday } from './block.js';

const WEEKLY_TARGET = 10; // Arbeitssätze pro Muskel und Woche (allgemeine Fitness)

/** Wiederholungsbereiche je nach Ziel. */
function presetsFor(settings) {
  const t = settings.training;
  const g = settings.profile.goals ?? [];
  const kraft = g.includes('kraft') && !g.includes('muskel');
  const muskel = g.includes('muskel') && !g.includes('kraft');
  return {
    main: kraft
      ? { sets: 3, repsMin: 4, repsMax: 6, rir: 2, restSec: t.restCompound + 30 }
      : muskel
        ? { sets: 3, repsMin: 6, repsMax: 10, rir: 2, restSec: t.restCompound }
        : { sets: 3, repsMin: 5, repsMax: 8, rir: 2, restSec: t.restCompound },
    secondary: { sets: 3, repsMin: kraft ? 6 : 8, repsMax: kraft ? 10 : 12, rir: 2, restSec: Math.round((t.restCompound + t.restIsolation) / 2) },
    accessory: { sets: 3, repsMin: 10, repsMax: 15, rir: 1, restSec: t.restIsolation },
  };
}

/** Standard-Vorgaben je Rolle. */
export function makeItem(exerciseId, settings, opts = {}) {
  const ex = getEx(exerciseId);
  const t = settings.training;
  if (ex.timed) {
    return {
      uid: uid(), exerciseId, kind: 'timed', role: opts.role ?? (ex.kind === 'mobility' ? 'warmup' : 'finisher'),
      minutes: opts.minutes ?? (ex.kind === 'mobility' ? settings.profile.warmupMin || 5 : 6),
      text: opts.text ?? ex.text, status: 'open', note: opts.note ?? '',
    };
  }
  const role = opts.role ?? (ex.main ? 'main' : ex.kind === 'compound' ? 'secondary' : 'accessory');
  const preset = presetsFor(settings)[role] ?? { sets: 3, repsMin: 8, repsMax: 12, rir: 2, restSec: t.restIsolation };
  return {
    uid: uid(), exerciseId, kind: 'strength', role,
    ...preset,
    ...pickDefined(opts, ['sets', 'repsMin', 'repsMax', 'rir', 'restSec']),
    note: opts.note ?? '', status: 'open',
  };
}

function pickDefined(o, keys) {
  const r = {};
  for (const k of keys) if (o[k] != null) r[k] = o[k];
  return r;
}

/** Wie dringend sollte ein Bewegungsmuster heute dran sein? 0..1 */
export function patternScores(status) {
  const scores = {};
  for (const [p, def] of Object.entries(PATTERNS)) {
    if (!def.muscles.length) continue;
    const vals = def.muscles.map((m) => {
      const o = status[m];
      const need = clamp(1 - o.sets7d / WEEKLY_TARGET, 0, 1);
      return o.readiness * (0.35 + 0.65 * need);
    });
    // Das am wenigsten erholte Muskel bremst das Muster.
    scores[p] = Math.min(...vals) * 0.6 + (vals.reduce((a, b) => a + b, 0) / vals.length) * 0.4;
  }
  return scores;
}

function chooseExercise(pattern, allowed, lastUsed, { mainOnly = false, exclude = new Set(), now = Date.now(), known = new Set() } = {}) {
  let cands = allowed.filter((e) => e.pattern === pattern && !exclude.has(e.id));
  if (mainOnly && cands.some((e) => e.main)) cands = cands.filter((e) => e.main);
  if (!cands.length) return null;
  // Rotation: am längsten nicht gemachte Variante zuerst.
  // Unbekannte Übungen zählen bei Hauptübungen wie "vor 1,5 Tagen gemacht" -> bekannte Hauptübungen
  // bleiben für den Fortschritt bevorzugt; bei Ergänzungsübungen wie "vor 4 Tagen" -> mehr Abwechslung.
  // Übungen mit Startwert aus der Einrichtung gelten als bekannt ("vor 5 Tagen").
  const unknownAge = (mainOnly ? 1.5 : 4) * 86400000;
  const age = (e) => (lastUsed.has(e.id) ? now - lastUsed.get(e.id) : known.has(e.id) ? 5 * 86400000 : unknownAge);
  cands.sort((a, b) => age(b) - age(a));
  return cands[0];
}

const musclesOf = (regions = []) => new Set(regions.flatMap((r) => REGIONS[r]?.muscles ?? []));

/**
 * Plan erstellen.
 * checkin = { energy, sleep, sore:[Region], pain:[Region], wish }
 * block = Stand im Trainingsblock (siehe logic/block.js) – optional; ohne Block wie früher Ganzkörper.
 * @returns {{title, rationale, items, dayId?, dayIdx?}}
 */
export function planLocal({ settings, sets, budgetMin, now = Date.now(), checkin = null, block = null }) {
  const profile = settings.profile;
  if (checkin?.wish === 'regen') return planRecovery({ settings, sets, budgetMin });
  if (block?.deload) return deloadOf(planLocal({ settings, sets, budgetMin, now, checkin, block: { ...block, deload: false, rirAdd: 0, mainSets: 0 } }), block);
  const today = block ? dayForToday(block, checkin) : null;
  const goals = profile.goals ?? [];
  const painM = musclesOf(checkin?.pain);
  const soreM = musclesOf(checkin?.sore);
  // Bei Schmerzen: keine Übung, die diesen Bereich hauptsächlich belastet.
  const allowed = EXERCISES.filter((e) => profile.equipment.includes(e.eq) && !e.primary.some((m) => painM.has(m)));
  const status = muscleStatus(sets, now);
  for (const m of painM) status[m].readiness = 0;
  for (const m of soreM) status[m].readiness *= 0.4;
  const sc = patternScores(status);
  // Split-Tag: Muster außerhalb der Tagesregionen kommen heute nicht dran.
  let day = today?.day ?? DAYS.gkC;
  const splitSc = (d) => {
    const out = { ...sc };
    if (d.regions) for (const [p, def] of Object.entries(PATTERNS)) if (out[p] != null && !d.regions.includes(def.region)) out[p] = 0;
    return out;
  };
  // Wunsch "Fokus Oberkörper / Beine"
  for (const [p, def] of Object.entries(PATTERNS)) {
    if (sc[p] == null) continue;
    if (checkin?.wish === 'oberkoerper' && def.region === 'lower') sc[p] *= 0.2;
    if (checkin?.wish === 'unterkoerper' && (def.region === 'push' || def.region === 'pull')) sc[p] *= 0.4;
    // Priorisierte Muskelgruppen aus dem Profil etwas bevorzugen
    if (def.muscles?.some((m) => profile.aims?.priority?.includes(m))) sc[p] *= 1.25;
  }
  let dsc = splitSc(day);
  const fatigue = fatigueLevel(checkin, profile);
  const lastUsed = lastUsedMap(sets);
  const known = new Set(Object.keys(profile.baselines ?? {}));
  const budgetSec = budgetMin * 60;
  // Bei schlechter Tagesform die Zeit nicht komplett auffüllen.
  const fillSec = budgetSec * (fatigue >= 2 ? 0.8 : fatigue === 1 ? 0.9 : 1);
  const used = new Set();
  const items = [];

  // 1) Aufwärmen / Beweglichkeit (länger bei Ziel Beweglichkeit/Gesundheit)
  const mobilityGoal = goals.includes('beweglichkeit') || goals.includes('gesundheit');
  const warmMin = (profile.warmupMin ?? 5) + (mobilityGoal && budgetMin >= 45 ? 2 : 0);
  if (warmMin > 0) items.push(makeItem('m-aufwaermen', settings, { role: 'warmup', minutes: warmMin }));

  // 2) Hauptübungen: je ein Muster für Beine, Drücken, Ziehen
  // Kleiner Bonus für Muster mit bekannten Übungen (Historie oder Startwert) – gut für den Fortschritt.
  const knownBonus = (p) => (allowed.some((e) => e.pattern === p && (known.has(e.id) || lastUsed.has(e.id))) ? 0.05 : 0);
  // Bevorzugtes Muster des Split-Tags (z. B. Ganzkörper A = Kniebeuge) bekommt einen Bonus.
  const pickMains = (d, s) => {
    const best = (ps) => ps.filter((p) => s[p] != null && allowed.some((e) => e.pattern === p))
      .sort((a, b) => s[b] + knownBonus(b) + (d.prefer && b === ps[0] ? 0.15 : 0) - (s[a] + knownBonus(a) + (d.prefer && a === ps[0] ? 0.15 : 0)))[0];
    return [...new Set(d.mains.map(best).filter(Boolean))];
  };
  let mainList = pickMains(day, dsc);
  // Split-Tag nicht machbar (z. B. Schmerzen)? Dann Ganzkörper nach Erholung.
  let dayFallback = false;
  if (mainList.length < 2 && day !== DAYS.gkC) {
    day = DAYS.gkC;
    dsc = splitSc(day);
    mainList = pickMains(day, dsc);
    dayFallback = true;
  }
  for (const k of Object.keys(sc)) sc[k] = dsc[k];
  let mains = mainList.sort((a, b) => sc[b] - sc[a]);
  // Kaum erholte Bereiche heute nicht als Hauptübung (aber mindestens zwei Hauptübungen).
  const rested = mains.filter((p) => sc[p] >= 0.3);
  mains = rested.length >= 2 ? rested : mains.slice(0, 2);
  const queue = [];
  for (const p of mains) queue.push({ p, role: 'main' });

  // 3) Ergänzende Grundübungen (die jeweils anderen Muster) – bei Müdigkeit weglassen
  const partner = { squat: 'hinge', hinge: 'squat', hpush: 'vpush', vpush: 'hpush', hpull: 'vpull', vpull: 'hpull' };
  if (fatigue < 2) {
    const seconds = mains.map((p) => partner[p]).concat(['lunge']).filter((p) => sc[p] > 0.5).sort((a, b) => sc[b] - sc[a]);
    for (const p of seconds) queue.push({ p, role: 'secondary' });
  }

  // 4) Isolationsübungen nach Bedarf
  const acc = ['kneeflex', 'lateral', 'reardelt', 'biceps', 'triceps', 'calf', 'core', 'kneeext', 'fly', 'glute']
    .filter((p) => sc[p] > 0.35)
    .sort((a, b) => sc[b] - sc[a]);
  for (const p of acc) queue.push({ p, role: 'accessory' });

  // 5) Finisher (Kondition) reservieren – länger bei Ziel Fitness/Fett abbauen
  const condGoal = goals.includes('fitness') || goals.includes('fett');
  let finisher = null;
  if (profile.finisher && budgetMin >= (condGoal ? 35 : 40) && fatigue < 2) {
    const cardio = allowed.filter((e) => e.kind === 'cardio').sort((a, b) => (lastUsed.get(a.id) ?? 0) - (lastUsed.get(b.id) ?? 0))[0];
    const min = condGoal ? (budgetMin >= 55 ? 10 : 8) : budgetMin >= 55 ? 8 : 6;
    if (cardio) finisher = makeItem(cardio.id, settings, { role: 'finisher', minutes: min });
  }
  const reserve = finisher ? itemSec(finisher) : 0;

  const lowReady = Object.entries(status).filter(([, o]) => o.readiness < 0.6 && o.last).map(([m]) => MUSCLES[m]);

  for (const { p, role } of queue) {
    const ex = chooseExercise(p, allowed, lastUsed, { mainOnly: role === 'main', exclude: used, now, known });
    if (!ex) continue;
    const base = makeItem(ex.id, settings, { role });
    // Tagesform: weniger Sätze und mehr Reserve bei Müdigkeit, mehr Sätze wenn richtig fit
    let setsN = role === 'main' && budgetMin >= 60 ? 4 : 3;
    if (fatigue >= 1) setsN = role === 'main' ? 3 : 2;
    if (fatigue < 0 && role === 'main') setsN += 1;
    let rir = fatigue >= 1 ? Math.min(3, base.rir + 1) : base.rir;
    // Periodisierung: Phase im Block (Einstieg/Aufbau/Intensiv)
    if (block) {
      // Extra-Satz nur, wenn genug Zeit da ist – sonst würde er andere Übungen verdrängen.
      if (role === 'main' && budgetMin >= 50) setsN = Math.min(5, setsN + block.mainSets);
      if (role !== 'accessory' || block.rirAdd > 0) rir = clamp(rir + block.rirAdd, role === 'accessory' ? 0 : 1, 3);
    }
    const it = { ...base, sets: setsN, rir };
    // Hauptübungen haben Vorrang (notfalls kürzt fitToBudget unten Finisher/Sätze),
    // alles andere nur, wenn es noch ins Budget passt.
    if (role !== 'main' && sessionSec([...items, it]) + reserve > fillSec + 60) continue;
    items.push(it);
    used.add(ex.id);
  }
  if (finisher) {
    // Finisher auf die übrige Zeit kürzen statt ihn ganz zu streichen (mind. 4 Min).
    const leftMin = Math.floor((fillSec + 60 - sessionSec(items)) / 60);
    if (leftMin >= 4) items.push({ ...finisher, minutes: Math.min(finisher.minutes, leftMin) });
  }

  const fitted = fitToBudget(items, budgetSec);
  const mainNames = fitted.filter((i) => i.role === 'main').map((i) => PATTERNS[getEx(i.exerciseId).pattern].label);
  const notes = [];
  if (block) {
    const dl = day.label + (dayFallback ? ' (statt ' + (today.day.label) + ', weil der geplante Tag heute nicht machbar ist)' : today.changed ? ' (Wunsch aus dem Check-in)' : '');
    notes.push(`Woche ${block.week}/${block.weeks} · ${block.label}: ${block.text} Heute: ${dl}.`);
  }
  if (mainNames.length) notes.push(`Schwerpunkt: ${mainNames.join(', ')}.`);
  if (painM.size) notes.push(`Schmerzbereiche (${checkin.pain.map((r) => REGIONS[r].label).join(', ')}) werden heute ausgelassen.`);
  if (fatigue >= 1) notes.push('Tagesform eher niedrig → weniger Sätze, etwas mehr Reserve (RIR), Einheit etwas kürzer.');
  if (fatigue < 0) notes.push('Gute Tagesform → ein Satz mehr bei den Hauptübungen.');
  notes.push(lowReady.length ? `Noch in Erholung: ${lowReady.join(', ')}.` : 'Alle Muskeln gut erholt.');
  const title = block && !dayFallback ? day.label : titleFor(fitted);
  const dayIdx = block ? (dayFallback ? null : today.dayIdx) : null;
  const dayId = block && !dayFallback ? (today.changed ? today.dayId : block.dayId) : null;
  return { title, rationale: notes.join(' '), items: fitted, dayId, dayIdx };
}

/**
 * Deload aus einem normalen Plan: gleiche Übungen, etwa halbes Volumen,
 * höchstens 2 Isolationsübungen, RIR 3 und rund 10 % weniger Last.
 */
export function deloadOf(plan, block) {
  let acc = 0;
  const items = [];
  for (const it of plan.items) {
    if (it.kind !== 'strength') { items.push(it); continue; }
    if (it.role === 'accessory' && ++acc > 2) continue;
    items.push({ ...it, sets: Math.max(it.role === 'main' ? 2 : 1, Math.ceil(it.sets / 2)), rir: Math.max(3, it.rir), loadPct: block.loadPct ?? 0.9 });
  }
  // Begründung stammt schon aus dem Plan mit Deload-Phase (Woche x/y · Deload: …).
  return { ...plan, title: `${plan.title} · Deload`, items };
}

export function titleFor(items) {
  const regions = new Set(items.filter((i) => i.kind === 'strength').map((i) => PATTERNS[getEx(i.exerciseId).pattern]?.region));
  const hasLower = regions.has('lower');
  const hasUpper = regions.has('push') || regions.has('pull');
  if (hasLower && hasUpper) return 'Ganzkörper';
  if (hasLower) return 'Unterkörper';
  if (regions.has('push') && regions.has('pull')) return 'Oberkörper';
  if (regions.has('push')) return 'Drücken';
  if (regions.has('pull')) return 'Ziehen';
  return 'Training';
}

/** Regenerationstag: lockeres Ausdauertraining + Mobility, keine schweren Sätze. */
export function planRecovery({ settings, sets = [], budgetMin }) {
  const eq = settings.profile.equipment;
  const lastUsed = lastUsedMap(sets);
  const cardio = ['c-laufband', 'c-ergometer', 'c-rudergeraet'].map(getEx).filter((e) => eq.includes(e.eq))
    .sort((a, b) => (lastUsed.get(a.id) ?? 0) - (lastUsed.get(b.id) ?? 0))[0];
  const B = Math.max(15, budgetMin);
  const items = [makeItem('m-aufwaermen', settings, { role: 'warmup', minutes: 5 })];
  let left = B - 5;
  if (cardio) {
    const m = Math.max(10, Math.round(B * 0.4));
    items.push(makeItem(cardio.id, settings, { role: 'finisher', minutes: m, text: 'Locker (Zone 2): Puls ca. 120–135, du kannst dabei noch reden' }));
    left -= m + 1;
  }
  for (const id of ['m-huefte', 'm-schulter']) {
    if (left < 8) break;
    items.push(makeItem(id, settings, { role: 'warmup', minutes: 6 }));
    left -= 7;
  }
  if (left >= 4) items.push(makeItem('m-cooldown', settings, { role: 'warmup', minutes: Math.min(10, left) }));
  return {
    title: 'Regeneration',
    rationale: 'Regenerationstag: lockere Ausdauer fördert die Durchblutung, Mobility löst Verspannungen. Keine schweren Sätze – morgen bist du wieder voll leistungsfähig.',
    items: fitToBudget(items, budgetMin * 60),
  };
}
