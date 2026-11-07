// Automatische Tests der Rechenlogik.
// Ausführen (macOS, ohne Installation):
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/logic.test.js
// oder mit Node: node tests/logic.test.js

import { e1rm, loadFor, repsFor } from '../js/logic/e1rm.js';
import { suggestNext, suggestFirst } from '../js/logic/progression.js';
import { itemSec, sessionSec, fitToBudget, projection, proposeCut, applyCut } from '../js/logic/timing.js';
import { muscleStatus, prevSessionsFor } from '../js/logic/history.js';
import { planLocal, makeItem } from '../js/logic/planner.js';
import { computePRs, weeklyVolume, weekStreak } from '../js/logic/stats.js';
import { DEFAULT_SETTINGS } from '../js/store.js';
import { EX, alternatives } from '../js/data/exercises.js';
import { roundTo, fmtNum, parseNum } from '../js/util.js';

const log = globalThis.print ?? console.log;
let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; log('FEHLER: ' + msg); }
}
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

// --- util
ok(roundTo(61.3, 2.5) === 62.5, 'roundTo 2,5');
ok(roundTo(0.1 + 0.2, 0.1) === 0.3, 'roundTo Krümel');
ok(fmtNum(62.5) === '62,5' && fmtNum(60) === '60', 'fmtNum');
ok(parseNum('62,5') === 62.5 && parseNum('x') === null, 'parseNum');

// --- e1RM
ok(near(e1rm(100, 1, 0), 100), 'e1rm 1 Wdh');
ok(near(e1rm(100, 8, 2), 100 * (1 + 10 / 30)), 'e1rm mit RIR');
ok(e1rm(100, 8, 4) > e1rm(100, 8, 3), 'RIR 4+ zählt mehr als 3');
ok(repsFor(e1rm(100, 8, 2), 100, 2) === 8, 'repsFor invers zu e1rm');
ok(near(loadFor(e1rm(80, 6, 2), 6, 2), 80), 'loadFor invers');

// --- Live-Anpassung
const bench = EX['lh-bankdruecken'];
const item = { repsMin: 6, repsMax: 10, rir: 2, sets: 3 };
let s = suggestNext({ ex: bench, item, lastSet: { weight: 60, reps: 8, rir: 2 } });
ok(s.weight === 60 && s.reps >= 6 && s.reps <= 8, 'RIR passt → Gewicht halten: ' + JSON.stringify(s));
s = suggestNext({ ex: bench, item, lastSet: { weight: 60, reps: 10, rir: 4 } });
ok(s.weight > 60, 'zu leicht am oberen Ende → mehr Gewicht: ' + JSON.stringify(s));
s = suggestNext({ ex: bench, item, lastSet: { weight: 60, reps: 6, rir: 0 } });
ok(s.weight < 60, 'zu schwer → weniger: ' + JSON.stringify(s));
ok(s.weight >= 50, 'max −20 %');
s = suggestNext({ ex: bench, item, lastSet: { weight: 60, reps: 7, rir: 3 } });
ok(s.weight === 60 && s.reps >= 7, 'etwas leicht → gleiche Last, mehr Wdh: ' + JSON.stringify(s));
s = suggestNext({ ex: bench, item, lastSet: { weight: 40, reps: 10, rir: 4 }, calibrating: true });
ok(s.weight === 50, 'Kalibrierungssprung: ' + JSON.stringify(s));
ok(s.weight % 2.5 === 0, 'Schrittweite');
const pull = EX['kg-klimmzug'];
s = suggestNext({ ex: pull, item: { repsMin: 5, repsMax: 8, rir: 2 }, lastSet: { weight: 0, reps: 4, rir: 1 } });
ok(s.weight === 0 && s.reps >= 1 && s.reps <= 5, 'Klimmzug ohne Zusatzgewicht: ' + JSON.stringify(s));
s = suggestNext({ ex: pull, item: { repsMin: 5, repsMax: 8, rir: 2 }, lastSet: { weight: 0, reps: 12, rir: 3 } });
ok(s.weight > 0, 'Klimmzug: Zusatzgewicht vorschlagen: ' + JSON.stringify(s));

// Erster Satz
let f = suggestFirst({ ex: bench, item, prevSessions: [] });
ok(f.calibrating && f.weight === 40 && f.reps === 10, 'Kalibrierung Start');
f = suggestFirst({ ex: bench, item, prevSessions: [], experience: 'anfaenger' });
ok(f.weight === 25, 'Anfänger vorsichtiger: ' + f.weight);
const now = Date.now();
f = suggestFirst({ ex: bench, item, now, prevSessions: [{ date: now - 3 * 86400000, sets: [{ weight: 60, reps: 10, rir: 2 }, { weight: 60, reps: 9, rir: 2 }] }] });
ok(f.weight > 60 && !f.calibrating, 'oben im Bereich → steigern: ' + JSON.stringify(f));
f = suggestFirst({ ex: bench, item, now, prevSessions: [{ date: now - 40 * 86400000, sets: [{ weight: 60, reps: 8, rir: 2 }] }] });
ok(f.weight < 60, 'lange Pause → vorsichtiger: ' + JSON.stringify(f));

// --- Zeit
const sq = makeItem('lh-kniebeuge', settings);
const est = itemSec(sq);
ok(est > 8 * 60 && est < 16 * 60, 'Kniebeuge 3 Sätze ~10–14 Min: ' + est / 60);
const curls = makeItem('kh-bizepscurl', settings);
ok(itemSec(curls) < itemSec(sq), 'Curls kürzer als Kniebeuge');

// Planer
const plan = planLocal({ settings, sets: [], budgetMin: 50, now });
const total = sessionSec(plan.items) / 60;
ok(total <= 51 && total >= 38, 'Plan passt ins Budget 50: ' + total.toFixed(1));
ok(plan.items.filter((i) => i.role === 'main').length >= 2, 'mind. 2 Hauptübungen');
ok(plan.items[0].role === 'warmup', 'beginnt mit Aufwärmen');
ok(plan.items.some((i) => i.role === 'finisher'), 'Finisher bei 50 Min');
const short = planLocal({ settings, sets: [], budgetMin: 30, now });
ok(sessionSec(short.items) / 60 <= 31, '30-Min-Plan passt: ' + (sessionSec(short.items) / 60).toFixed(1));
ok(!short.items.some((i) => i.role === 'finisher'), 'kein Finisher bei 30 Min');
const long = planLocal({ settings, sets: [], budgetMin: 75, now });
ok(long.items.length > plan.items.length, '75 Min → mehr Übungen');

// Erholung: gestern schwer Beine -> heute keine Kniebeuge als Hauptübung
const ySets = [];
for (let i = 0; i < 4; i++) ySets.push({ id: 'k' + i, sessionId: 'y', exerciseId: 'lh-kniebeuge', weight: 100, reps: 6, rir: 1, ts: now - 20 * 3600000 });
for (let i = 0; i < 4; i++) ySets.push({ id: 'r' + i, sessionId: 'y', exerciseId: 'lh-rdl', weight: 80, reps: 8, rir: 1, ts: now - 20 * 3600000 });
const st = muscleStatus(ySets, now);
ok(st.quads.readiness < 0.4 && st.chest.readiness === 1, 'Erholung Quadrizeps niedrig');
const plan2 = planLocal({ settings, sets: ySets, budgetMin: 50, now });
const mainPatterns = plan2.items.filter((i) => i.role === 'main').map((i) => EX[i.exerciseId].pattern);
ok(!mainPatterns.includes('squat') && !mainPatterns.includes('hinge'), 'Beine nach Beintag nicht als Hauptübung: ' + mainPatterns);

// fitToBudget
const big = [makeItem('lh-kniebeuge', settings), makeItem('lh-bankdruecken', settings), makeItem('lh-rudern', settings),
  makeItem('kh-seitheben', settings), makeItem('kh-bizepscurl', settings), makeItem('kz-trizepsdruecken', settings), makeItem('c-rudergeraet', settings)];
const fitted = fitToBudget(big, 35 * 60);
ok(sessionSec(fitted) <= 36 * 60, 'fitToBudget 35 Min');
ok(fitted.some((i) => i.exerciseId === 'lh-kniebeuge'), 'Grundübungen bleiben');
ok(!fitted.some((i) => i.exerciseId === 'c-rudergeraet'), 'Finisher fliegt zuerst');

// Live-Hochrechnung
const sess = { budgetMin: 30, startedAt: now - 25 * 60000, items: big.map((i) => ({ ...i })) };
const done = new Map([[sess.items[0].uid, 3]]);
sess.items[0].status = 'done';
const pr = projection(sess, done, now);
ok(pr.over > 0, 'nach 25 Min mit 1 Übung: über Budget');
const cut = proposeCut(sess.items, done, pr.over);
ok(cut && cut.uid !== sess.items[0].uid, 'Kürzung betrifft nicht die erledigte Übung: ' + cut?.label);
ok(applyCut(sess.items, cut).length === sess.items.length, 'applyCut');

// --- Historie & Stats
const hist = [
  { id: 'a1', sessionId: 's1', exerciseId: 'lh-bankdruecken', weight: 60, reps: 8, rir: 2, ts: now - 7 * 86400000 },
  { id: 'a2', sessionId: 's2', exerciseId: 'lh-bankdruecken', weight: 62.5, reps: 8, rir: 2, ts: now - 3 * 86400000 },
  { id: 'a3', sessionId: 's2', exerciseId: 'lh-bankdruecken', weight: 62.5, reps: 6, rir: 2, ts: now - 3 * 86400000 + 1 },
];
const ps = prevSessionsFor('lh-bankdruecken', hist);
ok(ps.length === 2 && ps[0].sessionId === 's2', 'prevSessionsFor neueste zuerst');
const prs = computePRs(hist);
ok(prs.has('a2') && !prs.has('a1') && !prs.has('a3'), 'Rekorde: ' + [...prs.keys()]);
const vol = weeklyVolume(hist, new Date(now - 4 * 86400000));
ok(vol.chest === 2 && vol.triceps === 1, 'Wochenvolumen Brust 2, Trizeps 1: ' + vol.chest + '/' + vol.triceps);
const sessions = [0, 1, 2, 7, 8, 9].map((d, i) => ({ id: 'x' + i, status: 'done', date: new Date(now - d * 86400000).toISOString(), startedAt: now - d * 86400000 }));
ok(weekStreak(sessions, 3, now).streak >= 0, 'weekStreak läuft');

// Alternativen
const alt = alternatives('lh-bankdruecken');
ok(alt.length >= 3 && EX[alt[0].id].pattern === 'hpush', 'Alternativen Bankdrücken: ' + alt.slice(0, 3).map((e) => e.id));
ok(alternatives('kh-seitheben')[0].id === 'kz-seitheben', 'Seitheben-Alternative');


// --- KI-Antwort prüfen und umwandeln (ohne echte Anfrage)
import { buildPrompt, convertPlan, planSchema } from '../js/ai/plan.js';
import { errorFrom } from '../js/ai/gemini.js';
import { validate } from '../js/ai/schema.js';
import { sessionSec as secOf } from '../js/logic/timing.js';
{
  const ctx = buildPrompt({ settings, sessions: [], sets: hist, budgetMin: 50, now });
  ok(ctx.prompt.includes('ZEITBUDGET: 50') && ctx.prompt.includes('lh-bankdruecken'), 'Prompt enthält Budget und Katalog');
  ok(ctx.prompt.length < 9000, 'Prompt kompakt: ' + ctx.prompt.length + ' Zeichen');
  const good = {
    titel: 'Ganzkörper A', begruendung: 'Beine erholt.',
    aufwaermen: { minuten: 5, inhalt: 'Hüfte, Schulter' },
    uebungen: [
      { id: 'lh-kniebeuge', saetze: 4, wdhMin: 5, wdhMax: 8, zielRir: 2, pauseSek: 180, hinweis: 'Tief' },
      { id: 'erfunden-xyz', saetze: 3, wdhMin: 8, wdhMax: 12, zielRir: 2, pauseSek: 90 },
      { id: 'lh-bankdruecken', saetze: 3, wdhMin: 6, wdhMax: 10, zielRir: 2, pauseSek: 150 },
      { id: 'kz-latziehen', saetze: 3, wdhMin: 8, wdhMax: 12, zielRir: 2, pauseSek: 120 },
      { id: 'kh-seitheben', saetze: 3, wdhMin: 12, wdhMax: 15, zielRir: 1, pauseSek: 60 },
      { id: 'kh-bizepscurl', saetze: 3, wdhMin: 10, wdhMax: 15, zielRir: 1, pauseSek: 60 },
      { id: 'kz-trizepsdruecken', saetze: 3, wdhMin: 10, wdhMax: 15, zielRir: 1, pauseSek: 60 },
    ],
    finisher: { id: 'c-rudergeraet', minuten: 6, inhalt: '6 Runden' },
  };
  const conv = convertPlan(good, { settings, budgetMin: 50, ...ctx });
  ok(!conv.items.some((i) => i.exerciseId === 'erfunden-xyz'), 'erfundene Übung verworfen');
  ok(conv.items[0].role === 'warmup' && conv.items[0].text === 'Hüfte, Schulter', 'Aufwärmen übernommen');
  ok(secOf(conv.items) <= 51 * 60, 'KI-Plan aufs Budget gekürzt: ' + (secOf(conv.items) / 60).toFixed(1));
  ok(conv.items.find((i) => i.exerciseId === 'lh-kniebeuge')?.note === 'Tief', 'Hinweis übernommen');
  let threw = false;
  try { convertPlan({ titel: 'x' }, { settings, budgetMin: 50, ...ctx }); } catch (e) { threw = e.kind === 'invalid'; }
  ok(threw, 'kaputte Antwort → Fehler (→ lokaler Plan)');
  ok(validate(planSchema(ctx.allowedIds, ctx.cardioIds), { ...good, uebungen: [{ id: 'lh-kniebeuge', saetze: 99 }] }).length > 0, 'Schema erkennt Fehler');

  const rpm = errorFrom(429, { error: { message: 'Quota exceeded', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '23s' }] } });
  ok(rpm.kind === 'rate-minute' && rpm.retryAfterSec === 23 && rpm.message.includes('23 s'), '429 pro Minute: ' + rpm.message);
  const rpd = errorFrom(429, { error: { message: 'Quota exceeded', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } });
  ok(rpd.kind === 'rate-day', '429 Tageslimit: ' + rpd.message);
  ok(errorFrom(404, { error: { message: 'models/x is not found' } }).kind === 'model', '404 Modell');
  ok(errorFrom(503, {}).kind === 'server', '503 Server');
  log(`\n${pass} Tests bestanden, ${fail} fehlgeschlagen`);
  if (fail && globalThis.process) process.exit(1);
}

// Planer bleibt bei bekannten Hauptübungen
{
  const t0 = now - 2 * 86400000;
  const known = ['lh-bankdruecken', 'kz-latziehen', 'lh-rdl'].flatMap((e, i) =>
    [0, 1, 2].map((n) => ({ id: e + n, sessionId: 'k', exerciseId: e, weight: 50, reps: 8, rir: 2, ts: t0 - i * 86400000 })));
  const pl = planLocal({ settings, sets: known, budgetMin: 50, now });
  const mains = pl.items.filter((i) => i.role === 'main').map((i) => i.exerciseId);
  ok(mains.includes('kz-latziehen') && !mains.includes('kg-klimmzug'), 'bekanntes Latziehen bleibt Hauptübung: ' + mains);
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (inkl. Planer-Rotation)`);
}

// Grobe Gewichtsstufen (Maschine 5 kg): Wdh. nie unter dem Zielbereich
{
  const lat = EX['kz-latziehen'];
  const it = { repsMin: 5, repsMax: 8, rir: 2 };
  const f1 = suggestFirst({ ex: lat, item: it, now, prevSessions: [{ date: now - 2 * 86400000, sets: [{ weight: 55, reps: 8, rir: 2 }, { weight: 55, reps: 7, rir: 1 }] }] });
  ok(f1.reps >= 5, 'Latziehen: Wdh. im Zielbereich: ' + JSON.stringify(f1));
  for (const last of [{ weight: 60, reps: 5, rir: 0 }, { weight: 40, reps: 8, rir: 4 }, { weight: 50, reps: 6, rir: 2 }, { weight: 45, reps: 8, rir: 3 }]) {
    const n = suggestNext({ ex: lat, item: it, lastSet: last });
    ok(n.reps >= 5 && n.reps <= 8 && n.weight % 5 === 0, 'Maschine nach ' + JSON.stringify(last) + ' → ' + JSON.stringify(n));
  }
  // Zufallstest: Vorschläge immer gültig
  let bad = 0;
  for (let i = 0; i < 400; i++) {
    const ex = [EX['lh-bankdruecken'], EX['ma-beinpresse'], EX['kh-seitheben'], EX['kz-rudern']][i % 4];
    const lo = 5 + (i % 6), it2 = { repsMin: lo, repsMax: lo + 4, rir: i % 3 };
    const w = Math.max(ex.step, Math.round((10 + (i * 7) % 90) / ex.step) * ex.step);
    const n = suggestNext({ ex, item: it2, lastSet: { weight: w, reps: 3 + (i % 12), rir: i % 5 } });
    if (!(n.weight > 0 && n.reps >= 1 && n.reps <= it2.repsMax && Math.abs(n.weight / ex.step - Math.round(n.weight / ex.step)) < 1e-6 && n.weight <= w * 1.25 + ex.step && n.weight >= w * 0.8 - ex.step)) bad++;
  }
  ok(bad === 0, 'Zufallstest Vorschläge gültig, Fehler: ' + bad);
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (final)`);
}
