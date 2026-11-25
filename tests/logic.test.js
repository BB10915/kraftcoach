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

// --- Einrichtung (Startwerte, Ziele) und Check-in
{
  // Startwert statt Kalibrierung
  const sqx = EX['lh-kniebeuge'];
  const it = { repsMin: 5, repsMax: 8, rir: 2 };
  const b = suggestFirst({ ex: sqx, item: it, prevSessions: [], baseline: { weight: 100, reps: 5 } });
  ok(!b.calibrating && b.weight >= 80 && b.weight <= 95 && b.reps >= 5 && b.reps <= 8, 'Startwert 100×5 → passender Einstieg: ' + JSON.stringify(b));
  const kl = suggestFirst({ ex: EX['kg-klimmzug'], item: it, prevSessions: [], baseline: { weight: 0, reps: 10 } });
  ok(kl.weight === 0 && kl.reps >= 5, 'Klimmzug-Startwert nur Körpergewicht: ' + JSON.stringify(kl));
  const hist1 = suggestFirst({ ex: sqx, item: it, now, baseline: { weight: 100, reps: 5 }, prevSessions: [{ date: now - 2 * 86400000, sets: [{ weight: 60, reps: 8, rir: 2 }] }] });
  ok(hist1.weight < 80, 'Echte Historie hat Vorrang vor Startwert: ' + hist1.weight);

  // Ziele verändern Wiederholungsbereiche
  const sK = JSON.parse(JSON.stringify(settings)); sK.profile.goals = ['kraft'];
  const sM = JSON.parse(JSON.stringify(settings)); sM.profile.goals = ['muskel'];
  ok(makeItem('lh-kniebeuge', sK).repsMax === 6, 'Ziel Kraft → 4–6 Wdh.');
  ok(makeItem('lh-kniebeuge', sM).repsMax === 10, 'Ziel Muskelaufbau → 6–10 Wdh.');

  // Check-in: Schmerzen Schulter → keine Schulterübungen
  const pPain = planLocal({ settings, sets: [], budgetMin: 60, now, checkin: { energy: 'normal', sleep: 'okay', sore: [], pain: ['schultern'], wish: '' } });
  ok(!pPain.items.some((i) => (EX[i.exerciseId].primary ?? []).includes('shoulders')), 'Schulterschmerz → keine Schulterübung');
  ok(pPain.rationale.includes('Schmerz'), 'Begründung nennt Schmerzen');
  // Müde → weniger Sätze
  const tired = planLocal({ settings, sets: [], budgetMin: 50, now, checkin: { energy: 'niedrig', sleep: 'schlecht', sore: [], pain: [], wish: '' } });
  const fresh = planLocal({ settings, sets: [], budgetMin: 50, now, checkin: { energy: 'hoch', sleep: 'gut', sore: [], pain: [], wish: '' } });
  const setsOfPlan = (p) => p.items.filter((i) => i.kind === 'strength').reduce((a, i) => a + i.sets, 0);
  ok(tired.items.filter((i) => i.kind === 'strength').every((i) => i.sets <= 3 && i.rir >= 2), 'Müde: max 3 Sätze, mehr RIR');
  ok(!tired.items.some((i) => i.role === 'finisher'), 'Müde: kein Finisher');
  ok(setsOfPlan(fresh) > setsOfPlan(tired), 'Fit: mehr Sätze als müde (' + setsOfPlan(fresh) + ' vs ' + setsOfPlan(tired) + ')');
  ok(sessionSec(tired.items) <= 51 * 60 && sessionSec(fresh.items) <= 51 * 60, 'Beide im Budget');
  // Wunsch Oberkörper
  const upper = planLocal({ settings, sets: [], budgetMin: 50, now, checkin: { energy: 'normal', sleep: 'okay', sore: [], pain: [], wish: 'oberkoerper' } });
  ok(!upper.items.some((i) => i.role === 'main' && PATTERNS_REGION(i) === 'lower'), 'Fokus Oberkörper: keine Bein-Hauptübung');

  // Prompt enthält Ziele, Startwerte, Check-in; Schmerzübungen nicht im Katalog
  const s2 = JSON.parse(JSON.stringify(settings));
  s2.profile.goals = ['kraft', 'muskel']; s2.profile.baselines = { 'lh-bankdruecken': { weight: 80, reps: 6 } };
  const ctx2 = buildPrompt({ settings: s2, sessions: [], sets: [], budgetMin: 50, now, checkin: { energy: 'niedrig', sleep: 'gut', sore: ['beine'], pain: ['schultern'], wish: 'locker' } });
  ok(ctx2.prompt.includes('Stärker werden') && ctx2.prompt.includes('Muskelaufbau'), 'Prompt: Ziele');
  ok(ctx2.prompt.includes('lh-bankdruecken: 80 kg × 6'), 'Prompt: Startwerte');
  ok(ctx2.prompt.includes('Energie niedrig') && ctx2.prompt.includes('SCHMERZEN (meiden!): Schultern'), 'Prompt: Check-in');
  ok(!ctx2.allowedIds.includes('lh-schulterdruecken') && !ctx2.allowedIds.includes('kh-seitheben'), 'Schulterübungen nicht erlaubt bei Schmerz');
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (mit Einrichtung & Check-in)`);
}
function PATTERNS_REGION(i) { return { squat: 'lower', hinge: 'lower', lunge: 'lower' }[EX[i.exerciseId].pattern] ?? 'other'; }

// Hauptübungen für Beine, Drücken und Ziehen haben Vorrang
{
  const s3 = JSON.parse(JSON.stringify(settings));
  for (const ci of [null, { energy: 'niedrig', sleep: 'okay', sore: [], pain: ['schultern'], wish: '' }]) {
    for (const min of [45, 50, 60]) {
      const pl = planLocal({ settings: s3, sets: [], budgetMin: min, now, checkin: ci });
      const regions = new Set(pl.items.filter((i) => i.role === 'main').map((i) => ({ squat: 'lower', hinge: 'lower', hpush: 'push', vpush: 'push', hpull: 'pull', vpull: 'pull' })[EX[i.exerciseId].pattern]));
      ok(regions.has('lower') && regions.has('push') && regions.has('pull'), `${min} Min${ci ? ' (müde, Schulter)' : ''}: Beine+Drücken+Ziehen → ${pl.items.map((i) => i.exerciseId).join(',')}`);
      ok(sessionSec(pl.items) <= (min + 1) * 60, `${min} Min passt: ${(sessionSec(pl.items) / 60).toFixed(1)}`);
    }
  }
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (Hauptübungen-Vorrang)`);
}

// Startwert beeinflusst die Übungswahl
{
  const s4 = JSON.parse(JSON.stringify(settings));
  s4.profile.baselines = { 'kz-latziehen': { weight: 70, reps: 10 } };
  const pl = planLocal({ settings: s4, sets: [], budgetMin: 50, now });
  ok(pl.items.some((i) => i.exerciseId === 'kz-latziehen' && i.role === 'main'), 'Latziehen mit Startwert wird Hauptübung: ' + pl.items.map((i) => i.exerciseId));
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (gesamt)`);
}

// ---------- Erweitertes Profil, Tagesform, Tagesplan ----------
import { readiness, fatigueLevel as fl } from '../js/data/goals.js';
import { nutritionTargets, planDay, bmr, toMin } from '../js/logic/daycoach.js';
import { profileText } from '../js/data/profile.js';
import { planRecovery } from '../js/logic/planner.js';
{
  const s5 = JSON.parse(JSON.stringify(settings));
  const pr = s5.profile;
  ok(pr.body && pr.day && pr.nutrition, 'Neue Profilbereiche haben Standardwerte');
  Object.assign(pr.body, { age: 30, sex: 'm', heightCm: 180, restingHr: 58, hrv: 60 });
  pr.bodyweight = 80;
  ok(Math.abs(bmr(pr) - 1780) < 1, 'Grundumsatz Mifflin 80 kg/180 cm/30 J./m = 1780: ' + bmr(pr));
  pr.goals = ['muskel'];
  const t = nutritionTargets(pr, { trainingMin: 60 });
  ok(t.kcal > 2600 && t.kcal < 3200, 'Kalorien Muskelaufbau plausibel: ' + t.kcal);
  ok(t.protein === 145, 'Protein 1,8 g/kg (gerundet): ' + t.protein);
  ok(t.waterL >= 3 && t.waterL <= 3.5, 'Wasser ~3,3 l: ' + t.waterL);
  pr.goals = ['fett'];
  ok(nutritionTargets(pr, { trainingMin: 60 }).kcal < t.kcal - 500, 'Fettabbau: weniger Kalorien');
  const minor = JSON.parse(JSON.stringify(pr)); minor.body.age = 16;
  const tm = nutritionTargets(minor, { trainingMin: 60 });
  ok(tm.minor && tm.notes.some((n) => /Wachstum/.test(n)), 'Jugendliche: Hinweis, kein großes Defizit');
  const noAge = JSON.parse(JSON.stringify(pr)); noAge.body.age = null;
  ok(nutritionTargets(noAge).kcal === null, 'Ohne Alter kein Kalorienziel');

  // Tagesform
  ok(readiness({ ...DEFAULT_CI(), hr: 68 }, pr).reasons.some((r) => /Ruhepuls/.test(r)), 'Erhöhter Ruhepuls erkannt');
  ok(readiness({ ...DEFAULT_CI(), hrv: 40 }, pr).level === 'reduziert', 'Niedrige HRV → reduzieren');
  const wrecked = { ...DEFAULT_CI(), energy: 'niedrig', sleep: 'schlecht', sleepH: 5, stress: 'hoch' };
  ok(readiness(wrecked, pr).level === 'regeneration', 'Sehr schlechte Form → Regeneration vorschlagen');
  ok(fl(wrecked, pr) === 2, 'Fatigue gedeckelt auf 2');
  ok(fl({ ...DEFAULT_CI(), energy: 'hoch', sleep: 'gut' }, pr) === -1, 'Fit → −1');

  // Regenerationsplan
  const rp = planLocal({ settings: s5, sets: [], budgetMin: 40, now, checkin: { ...DEFAULT_CI(), wish: 'regen' } });
  ok(rp.title === 'Regeneration' && rp.items.every((i) => i.kind === 'timed'), 'Regeneration: nur Cardio/Mobility');
  ok(sessionSec(rp.items) <= 41 * 60, 'Regeneration passt ins Budget: ' + sessionSec(rp.items) / 60);

  // Tagesplan
  Object.assign(pr.day, { wake: '06:30', bed: '22:30', trainTime: '18:00', commuteMin: 20 });
  pr.nutrition.supps = ['kreatin', 'koffein'];
  pr.nutrition.diet = ['vegetarisch'];
  const sess = { title: 'Ganzkörper', budgetMin: 60, items: plan.items };
  const day = planDay({ settings: s5, checkin: DEFAULT_CI(), session: sess });
  ok(day.blocks.map((b) => b.key).join() === 'morgen,vor,training,nach,abend', 'Tag hat 5 Abschnitte');
  const all = day.blocks.flatMap((b) => b.items).join(' ');
  ok(/Kreatin/.test(all) && /Losfahren um 17:40/.test(all), 'Kreatin + Abfahrtszeit');
  ok(/Skyr|Quark/.test(all) && !/Hähnchen/.test(all), 'Vegetarische Beispiele');
  ok(/kein Koffein mehr/.test(all), 'Training 18:00 bei Bett 22:30: kein Koffein mehr');
  ok(day.blocks[1].time === '15:00–18:00' && day.blocks[2].time === '18:00–19:00', 'Zeiten: ' + day.blocks.map((b) => b.time));
  const late = planDay({ settings: s5, checkin: { ...DEFAULT_CI(), trainTime: '20:00' }, session: sess });
  ok(late.blocks[1].items.some((x) => /kein Koffein/.test(x)), 'Spätes Training: kein Koffein');
  const ai = planDay({ settings: s5, checkin: DEFAULT_CI(), session: sess, ai: { kernaussage: 'KI sagt', abschnitte: [{ key: 'abend', punkte: ['Früh ins Bett'] }] } });
  ok(ai.blocks[4].items[0] === 'Früh ins Bett' && ai.levelText === 'KI sagt', 'KI-Texte werden übernommen');
  ok(toMin('7:05') === 425 && toMin('x') === null, 'Uhrzeit-Parser');

  // Prompt
  const txt = profileText(pr);
  ok(/30 Jahre/.test(txt) && /Vegetarisch/.test(txt) && /Kreatin/.test(txt) && /Training meist 18:00/.test(txt), 'Profiltext enthält Körper, Ernährung, Tagesablauf');
  const ctx5 = buildPrompt({ settings: s5, sessions: [], sets: [], budgetMin: 50, now, checkin: wrecked });
  ok(/TAGESZIELE \(berechnet\)/.test(ctx5.prompt) && /Lieber regenerieren/.test(ctx5.prompt), 'Prompt: Tagesziele + Bewertung');
  const sch = planSchema(ctx5.allowedIds, ctx5.cardioIds);
  const rawOk = { titel: 'X', begruendung: 'Y', aufwaermen: { minuten: 5, inhalt: '' }, finisher: { id: ctx5.cardioIds[0], minuten: 0, inhalt: '' },
    uebungen: [{ id: 'lh-kniebeuge', saetze: 3, wdhMin: 6, wdhMax: 8, zielRir: 2, pauseSek: 150 }, { id: 'kz-latziehen', saetze: 3, wdhMin: 8, wdhMax: 10, zielRir: 2, pauseSek: 120 }] };
  const noTag = convertPlan(rawOk, { settings: s5, budgetMin: 50, ...ctx5 });
  ok(noTag.dayAi === null && noTag.items.length >= 3, 'Fehlender Tagesplan der KI ist kein harter Fehler');
  const withTag = convertPlan({ ...rawOk, tag: { kernaussage: 'Heute locker', abschnitte: [{ key: 'morgen', punkte: ['Wasser'] }] } }, { settings: s5, budgetMin: 50, ...ctx5 });
  ok(withTag.dayAi?.kernaussage === 'Heute locker', 'KI-Tagesplan wird übernommen');
  ok(validate(sch, { ...rawOk, tag: { kernaussage: 'a', abschnitte: [] } }).length === 0, 'Schema akzeptiert Tagesplan');
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (Profil & Tagesplan)`);
}
function DEFAULT_CI() { return { energy: 'normal', sleep: 'okay', sore: [], pain: [], wish: '', sleepH: null, stress: '', hr: null, hrv: null, lastMeal: '', ate: '', trainTime: '', loads: [] }; }

// ---------- Apple Health (Kurzbefehl-Text) ----------
import { parseHealth, parseLooseNumber, parseSleep, sleepChip } from '../js/logic/health.js';
{
  const txt = 'KraftCoach Health\nruhepuls: 58 count/min\nhrv: 62,4 ms\nschlaf: 7,2\ngewicht: 80,4 kg\nschritte: 8.500\naktivkcal: 1.234';
  const h = parseHealth(txt);
  ok(h.hr === 58 && h.hrv === 62 && h.sleepH === 7.2 && h.weight === 80.4 && h.steps === 8500 && h.activeKcal === 1234, 'Health-Text komplett: ' + JSON.stringify(h));
  ok(parseHealth('Ruhepuls=61; Schlaf=7:30; Gewicht=79.9').sleepH === 7.5, 'Semikolon-Format, Schlaf 7:30');
  ok(parseHealth('hallo welt') === null && parseHealth('') === null, 'Kein Health-Text → null');
  ok(parseHealth('ruhepuls: \ngewicht: 500') === null, 'Leere/unsinnige Werte ignoriert');
  ok(parseSleep('7 h 12 min') === 7.2 && Math.abs(parseSleep('432') - 7.2) < 0.01 && Math.abs(parseSleep('25920') - 7.2) < 0.01 && parseSleep('7,2 h') === 7.2, 'Schlaf: h/min, Minuten, Sekunden');
  ok(parseLooseNumber('1.234,5') === 1234.5 && parseLooseNumber('80.4') === 80.4 && parseLooseNumber('8,500', { integer: true }) === 8500, 'Zahlenformate');
  ok(sleepChip(5.2) === 5 && sleepChip(6.6) === 7 && sleepChip(8.6) === 8 && sleepChip(9.5) === 9, 'Schlaf → Auswahl');
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (Apple Health)`);
}

// ---------- Übungsanleitungen & Animationen ----------
import { GUIDES, guideFor, guideAdvice, timesDone } from '../js/data/guides.js';
import { ANIMS, solve, poseAt, frameSvg } from '../js/views/anim.js';
import { EXERCISES } from '../js/data/exercises.js';
{
  const missing = EXERCISES.filter((e) => !GUIDES[e.id]).map((e) => e.id);
  ok(missing.length === 0, 'Jede Übung hat eine Anleitung' + (missing.length ? ': fehlt ' + missing.join(', ') : ''));
  const badAnim = Object.entries(GUIDES).filter(([, g]) => !ANIMS[g.anim]).map(([k]) => k);
  ok(badAnim.length === 0, 'Jede Anleitung hat eine Animation' + (badAnim.length ? ': ' + badAnim.join(', ') : ''));
  ok(Object.values(GUIDES).every((g) => g.steps.length >= 2 && [1, 2, 3].includes(g.level)), 'Anleitungen: mind. 2 Schritte, Stufe 1–3');
  let bad = [];
  for (const [k, a] of Object.entries(ANIMS)) {
    for (const t of [0, 400, 900, 1500, 2600, 4000]) {
      const pts = solve(poseAt(a, t));
      const vals = Object.values(pts).flat();
      if (!vals.every(Number.isFinite) || vals.some((v) => v < -40 || v > 240)) { bad.push(`${k}@${t}`); break; }
    }
    if (!frameSvg(a, a.frames[0]).includes('<polyline')) bad.push(k + ' svg');
  }
  ok(bad.length === 0, 'Alle Animationen ergeben gültige Posen' + (bad.length ? ': ' + bad.join(', ') : ''));
  // Füße bleiben beim Kreuzheben stehen (Inverse Kinematik)
  const dl = ANIMS.deadlift;
  const a0 = solve(poseAt(dl, 0)).AL, a1 = solve(poseAt(dl, 1800)).AL;
  ok(Math.abs(a0[0] - a1[0]) < 0.5 && Math.abs(a0[1] - a1[1]) < 0.5, 'Kreuzheben: Füße bleiben fest');

  const sets = [{ exerciseId: 'lh-kniebeuge', sessionId: 'a' }, { exerciseId: 'lh-kniebeuge', sessionId: 'a' }, { exerciseId: 'lh-kniebeuge', sessionId: 'b' }];
  ok(timesDone('lh-kniebeuge', sets) === 2, 'Anzahl Einheiten pro Übung');
  ok(guideAdvice('lh-kreuzheben', { experience: 'fortgeschritten' }).suggest, 'Neue technische Übung → Anleitung vorschlagen');
  ok(!guideAdvice('ma-beinstrecker', { experience: 'fortgeschritten' }).suggest, 'Fortgeschritten + neue einfache Maschine → kein Vorschlag');
  ok(guideAdvice('ma-beinstrecker', { experience: 'anfaenger' }).suggest, 'Anfänger + neue Maschine → Vorschlag');
  ok(guideAdvice('lh-kniebeuge', { experience: 'anfaenger', sets }).suggest, 'Anfänger, technisch, erst 2× gemacht → Vorschlag');
  ok(!guideAdvice('lh-kniebeuge', { experience: 'fortgeschritten', sets }).suggest, 'Fortgeschritten, schon gemacht → kein Vorschlag');
  ok(!guideAdvice('lh-kreuzheben', { known: ['lh-kreuzheben'] }).suggest, '„Kann ich“ → kein Vorschlag');
  ok(!guideAdvice('lh-kreuzheben', { enabled: false }).suggest, 'Vorschläge ausgeschaltet');
  ok(guideFor('unbekannt-xyz').steps.length === 1, 'Fallback für unbekannte Übung');
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (Anleitungen)`);
}

// --- Coach-Chat
import { applyActions, parseLocalCommand, ACTION_TYPES } from '../js/ai/chatactions.js';
import { chatContext, cleanReply, CHAT_SCHEMA } from '../js/ai/chat.js';
{
  const st = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const a = makeItem('lh-bankdruecken', st), b = makeItem('kh-seitheben', st);
  const sess = { id: 's1', status: 'active', budgetMin: 50, title: 'Test', items: [a, b], currentUid: a.uid, startedAt: 0 };
  const dc = (u) => (u === a.uid ? 2 : 0);

  let r = applyActions([{ typ: 'pause_uebung', zahl: 120 }], { settings: st, session: sess, doneCount: dc });
  ok(r.session.items[0].restSec === 120 && sess.items[0].restSec !== 120, 'Chat: Pause der aktuellen Übung (Original unverändert)');
  r = applyActions([{ typ: 'pause_isolation', zahl: 75 }], { settings: st, session: sess, doneCount: dc });
  ok(r.settings.training.restIsolation === 75 && r.session.items[1].restSec === 75 && r.session.items[0].restSec === a.restSec, 'Chat: Isolationspause in Einstellungen + heute');
  r = applyActions([{ typ: 'saetze', zahl: 1 }], { settings: st, session: sess, doneCount: dc });
  ok(r.session.items[0].sets === 2, 'Chat: Sätze nicht unter bereits gemachte');
  r = applyActions([{ typ: 'dauer_heute', zahl: 999 }], { settings: st, session: sess, doneCount: dc });
  ok(r.session.budgetMin === 180, 'Chat: Dauer begrenzt');
  r = applyActions([{ typ: 'dauer_heute', zahl: 40 }], { settings: st, session: null });
  ok(r.todayBudget === 40 && !r.sessionChanged, 'Chat: Dauer ohne Training → Budget auf Heute');
  r = applyActions([{ typ: 'uebung_tauschen', id: 'kh-bankdruecken' }], { settings: st, session: sess, doneCount: dc });
  ok(r.session.items[0].status === 'done' && r.session.items[1].exerciseId === 'kh-bankdruecken' && r.session.currentUid === r.session.items[1].uid, 'Chat: Tausch nach 2 Sätzen setzt mit neuer Übung fort');
  r = applyActions([{ typ: 'uebung_tauschen', id: 'kh-hammercurl', alt: 'kh-seitheben' }], { settings: st, session: sess, doneCount: dc });
  ok(r.session.items[1].exerciseId === 'kh-hammercurl' && r.session.items[1].uid === b.uid && r.session.items.length === 2, 'Chat: Tausch ohne Sätze ersetzt');
  r = applyActions([{ typ: 'uebung_streichen', id: 'lh-bankdruecken' }], { settings: st, session: sess, doneCount: dc });
  ok(r.session.items[0].status === 'done' && r.session.currentUid === b.uid, 'Chat: Streichen der aktuellen Übung springt weiter');
  r = applyActions([{ typ: 'uebung_hinzufuegen', id: 'gibtsnicht' }, { typ: 'loeschen_alles' }, { typ: 'zeit_training', text: '18.30' }, { typ: 'supplement_hinzu', id: 'kreatin' }], { settings: st, session: sess });
  ok(!r.results[0].ok && !r.results[1].ok && r.settings.profile.day.trainTime === '18:30' && r.settings.profile.nutrition.supps.includes('kreatin'), 'Chat: Unbekanntes abgelehnt, Uhrzeit & Supplement übernommen');
  r = applyActions([{ typ: 'pause_starten', zahl: 90 }], { settings: st, session: { ...sess, status: 'planned' }, now: 1000 });
  ok(!r.results[0].ok, 'Chat: Pausentimer nur im laufenden Training');
  r = applyActions([{ typ: 'ton', zahl: 0 }, { typ: 'koerpergewicht', zahl: '82,5' }], { settings: st, session: null });
  ok(r.settings.training.sound === false && r.settings.profile.bodyweight === 82.5, 'Chat: Ton aus, Gewicht mit Komma');

  const P = (t, o) => parseLocalCommand(t, o);
  ok(JSON.stringify(P('Pause 2 Minuten', { hasSession: true })) === '[{"typ":"pause_uebung","zahl":120}]', 'Lokal: Pause 2 Minuten');
  ok(P('Stell die Pause für Grundübungen auf 180 Sekunden')[0].typ === 'pause_grund', 'Lokal: Grundübungspause');
  ok(P('starte eine Pause von 90 s', { active: true, hasSession: true })[0].typ === 'pause_starten', 'Lokal: Timer starten');
  ok(P('Ich habe heute nur 40 Minuten')[0].typ === 'dauer_heute' && P('Training immer 60 Minuten')[0].typ === 'dauer_standard', 'Lokal: Dauer heute/Standard');
  ok(P('Ton aus')[0].zahl === 0 && P('Vibration an')[0].zahl === 1, 'Lokal: an/aus');
  ok(P('4 Sätze')[0].zahl === 4 && P('8 bis 12 Wiederholungen')[0].zahl2 === 12, 'Lokal: Sätze/Wdh.');
  ok(P('Lohnt sich Kreatin?') === null, 'Lokal: Frage ist kein Befehl');

  ok(CHAT_SCHEMA.properties.aktionen.items.properties.typ.enum.length === ACTION_TYPES.length, 'Chat-Schema kennt alle Aktionen');
  const c = cleanReply({ antwort: ' Ok ', aktionen: [{ typ: 'ton', zahl: 0 }, { typ: 'boese' }, { zahl: 3 }] });
  ok(c.text === 'Ok' && c.actions.length === 1, 'Chat: ungültige Aktionen verworfen');
  const ctx = chatContext({ settings: st, session: sess, sets: [], doneCount: dc });
  ok(ctx.includes('TRAINING LÄUFT') && ctx.includes('lh-bankdruecken') && ctx.includes('← AKTUELL') && !ctx.includes(st.ai.apiKey || 'AIza'), 'Chat-Kontext enthält Training, aber keinen Schlüssel');
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (Chat)`);
}

// --- Trainingsblock: Split, Periodisierung, Deload
import { blockState, blockTag, dayForToday, splitFor, withDeloadNow, withNewBlock, DAYS, weeklyFrequency, frequencyText } from '../js/logic/block.js';
import { matchesDay } from '../js/ai/plan.js';
import { PATTERNS } from '../js/data/exercises.js';
{
  const W = 7 * 86400000;
  // Fester Montag 12:00 als "jetzt", damit Wochengrenzen eindeutig sind.
  const mon = new Date(2026, 10, 23, 12, 0).getTime();
  const sb = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  sb.training.block = { start: '2026-11-23', weeks: 5, split: 'auto', deloadWeek: null };
  sb.profile.daysPerWeek = '4';
  sb.profile.experience = 'fortgeschritten';
  const at = (wk, extra = {}) => blockState({ ...sb, training: { ...sb.training, block: { ...sb.training.block, ...extra } } }, [], mon + wk * W + 2 * 86400000);
  const phases = [0, 1, 2, 3, 4, 5].map((w) => at(w).phase);
  ok(JSON.stringify(phases) === '["einstieg","aufbau","aufbau","intensiv","deload","einstieg"]', 'Block 5 Wochen: Phasen ' + phases);
  ok(at(5).blockNo === 2 && at(5).week === 1, 'Nach Deload startet Block 2');
  ok(at(0, { weeks: 4 }).weeks === 4 && at(3, { weeks: 4 }).deload && at(2, { weeks: 4 }).phase === 'intensiv', 'Block 4 Wochen');
  ok(at(5, { weeks: 6 }).deload && at(4, { weeks: 6 }).phase === 'intensiv', 'Block 6 Wochen');
  ok(at(0, { weeks: 9 }).weeks === 6 && at(0, { weeks: 1 }).weeks === 4, 'Blocklänge auf 4–6 begrenzt');
  ok(at(1, { start: null }).week === 1, 'Ohne Start: diese Woche = Woche 1');
  // Vorgezogener Deload in Woche 2, danach neuer Block
  ok(at(1, { deloadWeek: '2026-11-30' }).deload && at(1, { deloadWeek: '2026-11-30' }).forced, 'Deload vorgezogen');
  const after = at(2, { deloadWeek: '2026-11-30' });
  ok(after.week === 1 && after.phase === 'einstieg', 'Nach vorgezogenem Deload: Woche 1 → ' + after.week);
  const wd = withDeloadNow(sb, mon + W);
  ok(wd.training.block.deloadWeek === '2026-11-30' && sb.training.block.deloadWeek === null, 'withDeloadNow ohne Nebenwirkung');
  ok(withNewBlock(sb, mon + 3 * W).training.block.start === '2026-12-14', 'Neuer Block ab dieser Woche');

  // Split nach Trainingstagen
  const sp = (days, exp = 'fortgeschritten', split = 'auto') => splitFor({ profile: { daysPerWeek: days, experience: exp }, training: { block: { split } } }).scheme;
  ok(sp('2') === 'gk2' && sp('3') === 'gk' && sp('3–4') === 'gk' && sp('4') === 'okuk' && sp('5+') === 'okuk', 'Auto-Split nach Mindest-Tagen');
  for (const d of ['2', '3', '3–4', '4', '5+']) ok(weeklyFrequency(sp(d), parseInt(d, 10)) >= 2, `Auto-Split trifft jede Muskelgruppe ≥ 2× bei ${d} Tagen`);
  ok(weeklyFrequency('okuk', 3) < 2 && weeklyFrequency('ppl', 5) < 2 && weeklyFrequency('ppl', 6) >= 2, 'Frequenz: OK/UK bei 3, PPL bei 5 Tagen unter 2×');
  ok(/weniger als/.test(frequencyText('ppl', '3–4')) && !/weniger als/.test(frequencyText('gk', '3')), 'Warnung bei < 2× pro Woche');
  ok(sp('5+', 'fortgeschritten', 'gk') === 'gk' && sp('2', 'x', 'ppl') === 'ppl', 'Split manuell');

  // Rotation: nach Oberkörper kommt Unterkörper
  let bs = blockState(sb, [], mon);
  ok(bs.dayId === 'ok', 'Rotation startet mit Oberkörper');
  const done1 = [{ id: 'a', status: 'done', date: new Date(mon - 86400000).toISOString(), startedAt: mon - 86400000, block: blockTag(bs) }];
  bs = blockState(sb, done1, mon);
  ok(bs.dayId === 'uk', 'Danach Unterkörper');
  const regenS = [...done1, { id: 'b', status: 'done', date: new Date(mon - 3600000).toISOString(), startedAt: mon - 3600000, block: blockTag(bs, { regen: true }) }];
  ok(blockState(sb, regenS, mon).dayId === 'uk', 'Regeneration zählt nicht für die Rotation');
  ok(blockState(sb, done1, mon).doneThisWeek === 0 && blockState(sb, done1, mon + 86400000).doneThisWeek === 0, 'Einheiten diese Woche zählen ab Montag');
  ok(dayForToday(bs, { wish: 'oberkoerper' }).dayId === 'ok' && dayForToday(bs, { wish: 'oberkoerper' }).changed, 'Wunsch Oberkörper ändert den Split-Tag');

  // Lokaler Planer: Split-Tag wird eingehalten
  const regionsOf = (pl) => pl.items.filter((i) => i.kind === 'strength').map((i) => PATTERNS[EX[i.exerciseId].pattern].region);
  const okPlan = planLocal({ settings: sb, sets: [], budgetMin: 60, now: mon, block: blockState(sb, [], mon) });
  ok(regionsOf(okPlan).every((r) => ['push', 'pull', 'core'].includes(r)) && okPlan.title === 'Oberkörper', 'OK-Tag ohne Beinübungen: ' + regionsOf(okPlan));
  ok(okPlan.dayId === 'ok' && okPlan.dayIdx === 0 && /Woche 1\/5/.test(okPlan.rationale), 'Plan kennt Tag und Woche');
  const ukPlan = planLocal({ settings: sb, sets: [], budgetMin: 60, now: mon, block: blockState(sb, done1, mon) });
  ok(regionsOf(ukPlan).every((r) => ['lower', 'core'].includes(r)), 'UK-Tag nur Beine/Rumpf: ' + regionsOf(ukPlan));
  ok(ukPlan.items.filter((i) => i.role === 'main').length >= 2, 'UK-Tag mit 2 Hauptübungen');
  // Schmerzen in den Beinen am UK-Tag → Ganzkörper ohne Beine, Rotation bleibt stehen
  const ukPain = planLocal({ settings: sb, sets: [], budgetMin: 50, now: mon, block: blockState(sb, done1, mon), checkin: { energy: 'normal', sleep: 'okay', sore: [], pain: ['beine'], wish: '' } });
  ok(ukPain.dayIdx === null && /nicht machbar/.test(ukPain.rationale), 'Split-Tag nicht machbar → Ersatz, keine Rotation');

  // PPL
  const sp5 = JSON.parse(JSON.stringify(sb)); sp5.profile.daysPerWeek = '5+'; sp5.training.block.split = 'ppl';
  const pushPlan = planLocal({ settings: sp5, sets: [], budgetMin: 50, now: mon, block: blockState(sp5, [], mon) });
  ok(regionsOf(pushPlan).every((r) => ['push', 'core'].includes(r)) && pushPlan.title === 'Push', 'Push-Tag: ' + regionsOf(pushPlan));

  // Periodisierung: Einstieg mehr Reserve, Intensiv mehr Sätze, Deload halbes Volumen
  const gk = JSON.parse(JSON.stringify(sb)); gk.profile.daysPerWeek = '3';
  const mk = (wk) => planLocal({ settings: gk, sets: [], budgetMin: 60, now: mon + wk * W, block: blockState(gk, [], mon + wk * W) });
  const mainOf = (pl) => pl.items.find((i) => i.role === 'main');
  const e = mk(0), a = mk(1), i3 = mk(3), d = mk(4);
  ok(mainOf(e).rir === mainOf(a).rir + 1, 'Einstieg: RIR +1');
  ok(mainOf(i3).sets === mainOf(a).sets + 1 && mainOf(i3).rir === Math.max(1, mainOf(a).rir - 1), 'Intensiv: +1 Satz, RIR −1');
  const strSets = (pl) => pl.items.filter((x) => x.kind === 'strength').reduce((s2, x) => s2 + x.sets, 0);
  ok(strSets(d) <= strSets(a) * 0.6, `Deload: Volumen etwa halbiert (${strSets(d)} vs ${strSets(a)})`);
  ok(d.items.filter((x) => x.kind === 'strength').every((x) => x.rir >= 3 && x.loadPct === 0.9), 'Deload: RIR 3, 90 % Last');
  ok(d.items.filter((x) => x.role === 'accessory').length <= 2 && /Deload/.test(d.title), 'Deload: max. 2 Isolationsübungen, Titel');
  ok(sessionSec(d.items) <= 60 * 60 * 0.85, 'Deload-Einheit kürzer');
  ok(e.title === 'Ganzkörper A' && mk(0).items.some((x) => x.role === 'main' && EX[x.exerciseId].pattern === 'squat'), 'Ganzkörper A mit Kniebeuge');

  // Lastvorschlag im Deload: ~10 % leichter, innerhalb der Einheit nicht steigern
  const benchD = { repsMin: 6, repsMax: 10, rir: 3, sets: 2, loadPct: 0.9 };
  const prevB = [{ date: mon - 3 * 86400000, sets: [{ weight: 80, reps: 8, rir: 2 }] }];
  const normalF = suggestFirst({ ex: EX['lh-bankdruecken'], item: { ...benchD, loadPct: undefined }, prevSessions: prevB, now: mon });
  const deloadF = suggestFirst({ ex: EX['lh-bankdruecken'], item: benchD, prevSessions: prevB, now: mon });
  ok(deloadF.weight < normalF.weight && deloadF.weight >= normalF.weight * 0.85 && /Deload/.test(deloadF.reason), `Deload-Startgewicht leichter: ${deloadF.weight} vs ${normalF.weight}`);
  const dn = suggestNext({ ex: EX['lh-bankdruecken'], item: benchD, lastSet: { weight: 70, reps: 10, rir: 4 } });
  ok(dn.weight === 70, 'Deload: Gewicht halten trotz RIR 4+');

  // KI-Prompt enthält den Block, Deload wird abgesichert, Split-Check
  const ctxB = buildPrompt({ settings: sb, sessions: [], sets: [], budgetMin: 50, now: mon });
  ok(ctxB.prompt.includes('TRAININGSBLOCK') && ctxB.prompt.includes('Woche 1 von 5') && ctxB.prompt.includes('Oberkörper') && ctxB.today.dayId === 'ok', 'Prompt mit Block und Split-Tag');
  const dBlock = blockState(sb, [], mon + 4 * W);
  ok(buildPrompt({ settings: sb, sessions: [], sets: [], budgetMin: 50, now: mon + 4 * W }).prompt.includes('Phase: Deload'), 'Prompt in der Deload-Woche');
  const rawD = { titel: 'X', begruendung: '', aufwaermen: { minuten: 5, inhalt: '' }, finisher: { id: ctxB.cardioIds[0], minuten: 0, inhalt: '' },
    tag: { kernaussage: '', abschnitte: [] },
    uebungen: [
      { id: 'lh-bankdruecken', saetze: 4, wdhMin: 6, wdhMax: 8, zielRir: 1, pauseSek: 150 },
      { id: 'kz-rudern', saetze: 4, wdhMin: 8, wdhMax: 10, zielRir: 2, pauseSek: 120 },
      { id: 'kh-seitheben', saetze: 3, wdhMin: 12, wdhMax: 15, zielRir: 1, pauseSek: 60 },
      { id: 'kh-bizepscurl', saetze: 3, wdhMin: 10, wdhMax: 12, zielRir: 1, pauseSek: 60 },
      { id: 'kz-trizepsdruecken', saetze: 3, wdhMin: 10, wdhMax: 12, zielRir: 1, pauseSek: 60 },
    ] };
  const cv = convertPlan(rawD, { settings: sb, budgetMin: 50, allowedIds: ctxB.allowedIds, cardioIds: ctxB.cardioIds, block: dBlock });
  const cs = cv.items.filter((x) => x.kind === 'strength');
  ok(cs.every((x) => x.rir >= 3 && x.loadPct === 0.9 && x.sets <= 3) && cs.filter((x) => x.role === 'accessory').length <= 2, 'KI-Plan im Deload begrenzt');
  ok(matchesDay(cs, DAYS.ok) && !matchesDay(cs, DAYS.uk) && matchesDay(cs, DAYS.gkA), 'Split-Check für KI-Plan');
  log(`${pass} Tests bestanden, ${fail} fehlgeschlagen (Trainingsblock)`);
}
