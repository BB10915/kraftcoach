// Trainingsblock: Planung über mehrere Wochen – Split nach Trainingstagen, Periodisierung, Deload.
// Ein Block dauert 4–6 Wochen; die letzte Woche ist immer eine Entlastungswoche (Deload).

import { readiness } from '../data/goals.js';
import { startOfWeek, dayKey, clamp, DAY } from '../util.js';

export const BLOCK_DEFAULTS = { start: null, weeks: 5, split: 'auto', deloadWeek: null };

/** Phasen innerhalb eines Blocks. */
export const PHASES = {
  einstieg: {
    label: 'Einstieg',
    text: 'Gewichte und Technik finden – eine Wiederholung mehr Reserve als sonst.',
    rule: 'Ziel-RIR bei allen Übungen 1 höher als sonst (Grundübungen meist RIR 3), normale Satzzahl.',
    rirAdd: 1, mainSets: 0,
  },
  aufbau: {
    label: 'Aufbau',
    text: 'Volles Volumen. Gewicht oder Wiederholungen Schritt für Schritt steigern.',
    rule: 'Normale Vorgaben; Fortschritt über mehr Gewicht oder Wiederholungen.',
    rirAdd: 0, mainSets: 0,
  },
  intensiv: {
    label: 'Intensiv',
    text: 'Letzte harte Woche vor dem Deload: ein Satz mehr bei den Hauptübungen, näher ans Limit.',
    rule: 'Hauptübungen +1 Satz, Grundübungen Ziel-RIR 1. Isolationsübungen normal.',
    rirAdd: -1, mainSets: 1,
  },
  deload: {
    label: 'Deload',
    text: 'Entlastungswoche: etwa halbes Volumen, rund 10 % leichter, viel Reserve. Danach startet ein neuer Block.',
    rule: 'Volumen etwa halbieren: Hauptübungen höchstens 2–3 Sätze, alle anderen 2 Sätze, höchstens 2 Isolationsübungen. Ziel-RIR 3–4. Keine neuen Übungen, keine Rekordversuche. Die Einheit darf kürzer sein als das Budget.',
    deload: true, loadPct: 0.9,
  },
};

/** Trainingstage. mains = Gruppen von Bewegungsmustern für die Hauptübungen (erstes Muster bevorzugt). */
export const DAYS = {
  gkA: { key: 'gk', label: 'Ganzkörper A', focus: 'Kniebeuge, Drücken horizontal, Ziehen vertikal', mains: [['squat', 'hinge'], ['hpush', 'vpush'], ['vpull', 'hpull']], prefer: true },
  gkB: { key: 'gk', label: 'Ganzkörper B', focus: 'Hüftstreckung, Drücken vertikal, Rudern', mains: [['hinge', 'squat'], ['vpush', 'hpush'], ['hpull', 'vpull']], prefer: true },
  gkC: { key: 'gk', label: 'Ganzkörper C', focus: 'Beine, Drücken, Ziehen – je nach Erholung', mains: [['squat', 'hinge'], ['hpush', 'vpush'], ['hpull', 'vpull']], prefer: false },
  ok: { key: 'ok', label: 'Oberkörper', focus: 'Drücken, Ziehen, Schultern, Arme', mains: [['hpush', 'vpush'], ['hpull', 'vpull']], regions: ['push', 'pull', 'core'] },
  uk: { key: 'uk', label: 'Unterkörper', focus: 'Kniebeuge, Hüftstreckung, Beine, Rumpf', mains: [['squat'], ['hinge']], regions: ['lower', 'core'] },
  push: { key: 'push', label: 'Push', focus: 'Brust, Schultern, Trizeps', mains: [['hpush'], ['vpush']], regions: ['push', 'core'] },
  pull: { key: 'pull', label: 'Pull', focus: 'Rücken, hintere Schulter, Bizeps', mains: [['vpull'], ['hpull']], regions: ['pull', 'core'] },
  beine: { key: 'beine', label: 'Beine', focus: 'Kniebeuge, Hüftstreckung, Waden, Rumpf', mains: [['squat'], ['hinge']], regions: ['lower', 'core'] },
};

export const SPLITS = {
  gk2: { label: 'Ganzkörper (A/B)', rotation: ['gkA', 'gkB'] },
  gk: { label: 'Ganzkörper (A/B/C)', rotation: ['gkA', 'gkB', 'gkC'] },
  okuk: { label: 'Oberkörper / Unterkörper', rotation: ['ok', 'uk'] },
  ppl: { label: 'Push / Pull / Beine', rotation: ['push', 'pull', 'beine'] },
};

/** Auswahl in den Einstellungen. */
export const SPLIT_CHOICES = [['auto', 'Automatisch'], ['gk', 'Ganzkörper'], ['okuk', 'Ober-/Unterkörper'], ['ppl', 'Push/Pull/Beine']];

/** Welcher Split passt zu Trainingstagen und Erfahrung? */
export function splitFor(settings) {
  const choice = settings.training?.block?.split ?? 'auto';
  const p = settings.profile ?? {};
  const days = String(p.daysPerWeek ?? '3');
  if (choice === 'gk') return { scheme: days === '2' ? 'gk2' : 'gk', auto: false };
  if (choice === 'okuk' || choice === 'ppl') return { scheme: choice, auto: false };
  const beginner = p.experience === 'anfaenger';
  let scheme;
  if (days === '2') scheme = 'gk2';
  else if (days === '3') scheme = 'gk';
  else if (days === '3–4') scheme = beginner ? 'gk' : 'okuk';
  else if (days === '4') scheme = 'okuk';
  else scheme = beginner ? 'okuk' : 'ppl'; // 5+
  return { scheme, auto: true };
}

function phaseFor(week, weeks) {
  if (week >= weeks) return 'deload';
  if (week === 1) return 'einstieg';
  if (week === weeks - 1 && weeks >= 4) return 'intensiv';
  return 'aufbau';
}

const parseDay = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const monday = (d) => startOfWeek(d).getTime();
const weeksBetween = (a, b) => Math.round((b - a) / (7 * DAY));

const sessTs = (s) => s.startedAt ?? new Date(s.date).getTime();

/**
 * Aktueller Stand im Block.
 * @returns {{ week, weeks, blockNo, phase, label, text, rule, deload, forced, rirAdd, mainSets, loadPct,
 *   start, weekStart, untilDeload, scheme, schemeLabel, autoSplit, dayIdx, dayId, day, doneThisWeek, hint }}
 */
export function blockState(settings, sessions = [], now = Date.now()) {
  const b = { ...BLOCK_DEFAULTS, ...(settings.training?.block ?? {}) };
  const weeks = clamp(Math.round(+b.weeks) || 5, 4, 6);
  const thisMon = monday(now);
  const startD = parseDay(b.start);
  let start = startD ? monday(startD) : thisMon;
  let forced = false;
  const dwD = parseDay(b.deloadWeek);
  if (dwD) {
    const dw = monday(dwD);
    if (dw === thisMon) forced = true;
    // Nach einem vorgezogenen Deload beginnt in der Woche danach ein neuer Block.
    else if (dw < thisMon && dw >= start) start = monday(dw + 8 * DAY);
  }
  if (start > thisMon) start = thisMon;
  const idx = Math.max(0, weeksBetween(start, thisMon));
  const week = (idx % weeks) + 1;
  const phase = forced ? 'deload' : phaseFor(week, weeks);
  const P = PHASES[phase];

  const { scheme, auto } = splitFor(settings);
  const rot = SPLITS[scheme].rotation;
  // Nächster Tag der Rotation: nach der letzten abgeschlossenen Einheit desselben Splits.
  const done = sessions.filter((s) => s.status === 'done').sort((a, c) => sessTs(a) - sessTs(c));
  const lastSplit = [...done].reverse().find((s) => s.block?.scheme === scheme && s.block?.dayIdx != null);
  const dayIdx = lastSplit ? (lastSplit.block.dayIdx + 1) % rot.length : 0;
  const doneThisWeek = done.filter((s) => sessTs(s) >= thisMon).length;

  const st = {
    week, weeks, blockNo: Math.floor(idx / weeks) + 1, phase, ...P, deload: !!P.deload, forced,
    rirAdd: P.rirAdd ?? 0, mainSets: P.mainSets ?? 0, loadPct: P.loadPct ?? 1,
    start: dayKey(start), weekStart: dayKey(thisMon), untilDeload: phase === 'deload' ? 0 : weeks - week,
    scheme, schemeLabel: SPLITS[scheme].label, autoSplit: auto, rotation: rot,
    dayIdx, dayId: rot[dayIdx], day: DAYS[rot[dayIdx]], doneThisWeek, hint: '',
  };
  st.hint = deloadHint(st, done, settings.profile, now);
  return st;
}

/** Deload vorziehen? Wenn die letzten Check-ins mehrfach schwach waren (ab Woche 3). */
export function deloadHint(st, done, profile = {}, now = Date.now()) {
  if (st.deload || st.week < 3) return '';
  const recent = done.filter((s) => s.checkin && now - sessTs(s) <= 14 * DAY).slice(-3);
  const weak = recent.filter((s) => ['reduziert', 'regeneration'].includes(readiness(s.checkin, profile).level)).length;
  return weak >= 2 ? `Bei ${weak} der letzten ${recent.length} Einheiten war deine Tagesform reduziert. Ein vorgezogener Deload kann helfen, dich zu erholen.` : '';
}

/** Tag für heute – ein Wunsch im Check-in (Fokus Oberkörper/Beine) geht vor. */
export function dayForToday(st, checkin = null) {
  const wish = checkin?.wish;
  let dayId = st.dayId;
  if (wish === 'oberkoerper' && !['ok', 'push', 'pull'].includes(DAYS[dayId].key)) dayId = st.rotation.includes('ok') ? 'ok' : st.rotation.includes('push') ? 'push' : dayId;
  if (wish === 'unterkoerper' && !['uk', 'beine'].includes(DAYS[dayId].key)) dayId = st.rotation.includes('uk') ? 'uk' : st.rotation.includes('beine') ? 'beine' : dayId;
  const i = st.rotation.indexOf(dayId);
  return { dayId, day: DAYS[dayId], dayIdx: i >= 0 ? i : st.dayIdx, changed: dayId !== st.dayId };
}

/** Wird in der Einheit gespeichert (für Rotation und Anzeige). */
export function blockTag(st, { dayId = st.dayId, dayIdx = st.dayIdx, regen = false } = {}) {
  return {
    week: st.week, weeks: st.weeks, blockNo: st.blockNo, phase: st.phase, deload: st.deload,
    scheme: st.scheme, dayId: regen ? null : dayId, dayIdx: regen ? null : dayIdx,
  };
}

export function blockLine(tag) {
  if (!tag) return '';
  const p = PHASES[tag.phase]?.label ?? '';
  const d = tag.dayId ? DAYS[tag.dayId]?.label : '';
  return [`Woche ${tag.week}/${tag.weeks}`, p, d].filter(Boolean).join(' · ');
}

/** Abschnitt für den KI-Prompt. */
export function blockText(st, today = null) {
  const t = today ?? { day: st.day, changed: false };
  const L = [
    `Block ${st.blockNo}, Woche ${st.week} von ${st.weeks} (letzte Woche = Deload) – Phase: ${st.label}${st.forced ? ' (vorgezogen)' : ''}`,
    `Vorgabe der Phase: ${st.rule}`,
    `Split: ${st.schemeLabel}. Heute laut Plan: ${t.day.label} (${t.day.focus})${t.changed ? ' – auf Wunsch im Check-in geändert' : ''}.`,
    `Einheiten diese Woche bisher: ${st.doneThisWeek}`,
  ];
  if (!st.deload) L.push(`Nächster Deload in ${st.untilDeload} Woche${st.untilDeload === 1 ? '' : 'n'}.`);
  return L.join('\n');
}

/** Einstellungen ändern: Deload in dieser Woche bzw. neuen Block ab dieser Woche. */
export function withDeloadNow(settings, now = Date.now()) {
  const st = JSON.parse(JSON.stringify(settings));
  st.training.block = { ...BLOCK_DEFAULTS, ...(st.training.block ?? {}), deloadWeek: dayKey(monday(now)) };
  if (!st.training.block.start) st.training.block.start = dayKey(monday(now));
  return st;
}

export function withNewBlock(settings, now = Date.now()) {
  const st = JSON.parse(JSON.stringify(settings));
  st.training.block = { ...BLOCK_DEFAULTS, ...(st.training.block ?? {}), start: dayKey(monday(now)), deloadWeek: null };
  return st;
}
