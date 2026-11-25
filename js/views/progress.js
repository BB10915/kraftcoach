// Bildschirm "Fortschritt": Serie, Kalender, Wochenvolumen, Rekorde, Übungen, Verlauf.

import * as store from '../store.js';
import { S } from '../store.js';
import { getEx, MUSCLES } from '../data/exercises.js';
import { computePRs, weeklyVolume, weekStreak, trainingDays, bestsFor } from '../logic/stats.js';
import { METRICS, METRIC_KEYS, seriesOf, summaryOf } from '../logic/bodylog.js';
import { lineChart, bindCharts } from './chart.js';
import { confirmSheet, toast, ICONS } from '../ui.js';
import { esc, fmtNum, fmtDate, fmtDateShort, fmtMin, dayKey, startOfWeek, DAY, MONTHS_LONG } from '../util.js';

const TARGET = [6, 12]; // empfohlene Arbeitssätze pro Muskel und Woche (allgemeine Fitness)
let weekOffset = 0;
let bodyKey = 'hr';
let bodyDays = 30;

function calendarHtml(days) {
  const now = new Date();
  const start = startOfWeek(new Date(startOfWeek(now).getTime() - 27 * DAY)); // 4 Wochen zurück + aktuelle
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(start.getTime() + i * DAY + 3600000); // +1h gegen Zeitumstellung
    const k = dayKey(d);
    const future = d > now && k !== dayKey(now);
    cells.push(`<div class="d ${days.has(k) ? 'on' : ''} ${k === dayKey(now) ? 'today' : ''} ${future ? 'out' : ''}" title="${k}">${d.getDate()}</div>`);
  }
  return `<div class="cal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((h) => `<div class="h">${h}</div>`).join('')}${cells.join('')}</div>`;
}

function volumeHtml() {
  const ws = new Date(startOfWeek(Date.now()).getTime() + weekOffset * 7 * DAY + 3600000);
  const vol = weeklyVolume(S.sets, startOfWeek(ws));
  const max = Math.max(16, ...Object.values(vol));
  const label = weekOffset === 0 ? 'Diese Woche' : weekOffset === -1 ? 'Letzte Woche' : `Woche ab ${fmtDate(startOfWeek(ws))}`;
  const rows = Object.entries(vol).sort((a, b) => b[1] - a[1]).map(([m, v]) => {
    const status = v >= TARGET[0] ? (v > TARGET[1] ? 'viel' : 'im Ziel') : 'wenig';
    return `<div class="vol-row" title="${MUSCLES[m]}: ${fmtNum(v)} Sätze (${status})">
      <span>${MUSCLES[m]}</span>
      <div class="vol-bar"><u style="left:${(TARGET[0] / max) * 100}%;width:${((TARGET[1] - TARGET[0]) / max) * 100}%"></u><i style="width:${(v / max) * 100}%;opacity:${v >= TARGET[0] ? 1 : 0.55}"></i></div>
      <b class="num" style="text-align:right">${fmtNum(v)}</b></div>`;
  }).join('');
  return `<div class="row between" style="margin-bottom:6px">
      <button class="icon-btn" data-act="wk-prev" aria-label="Vorherige Woche">‹</button>
      <b>${label}</b>
      <button class="icon-btn" data-act="wk-next" aria-label="Nächste Woche" ${weekOffset >= 0 ? 'disabled style="opacity:.3"' : ''}>›</button>
    </div>${rows}
    <p class="tiny muted" style="margin:10px 0 0">Arbeitssätze je Muskel (Hauptmuskel 1, mitbeteiligt ½). Heller Bereich = Ziel ${TARGET[0]}–${TARGET[1]} Sätze.</p>`;
}

// ---------- Körperwerte ----------

const fmtM = (k, v) => (v == null ? '–' : k === 'steps' || k === 'activeKcal' ? Math.round(v).toLocaleString('de-DE') : fmtNum(v, METRICS[k].digits));
const withUnit = (k, v) => `${fmtM(k, v)}${METRICS[k].unit && v != null ? '\u00a0' + METRICS[k].unit : ''}`;
const TREND = { gut: ['besser', 'var(--accent)'], schlecht: ['schlechter', 'var(--warn)'], gleich: ['stabil', 'var(--muted)'], auf: ['steigt', 'var(--text)'], ab: ['sinkt', 'var(--text)'] };

function bodyHtml() {
  const log = S.body;
  if (!log.some((e) => METRIC_KEYS.some((k) => e[k] != null))) {
    return `<div class="card empty small"><p style="margin:0">Noch keine Körperwerte gespeichert.<br>Hol dir auf <a href="#/heute">Heute</a> die Werte aus Apple Health oder trag Ruhepuls und Schlaf im Check-in ein. Ab dann landet jeder Tag hier.</p></div>`;
  }
  const have = METRIC_KEYS.filter((k) => log.some((e) => e[k] != null));
  if (!have.includes(bodyKey)) bodyKey = have[0];
  const m = METRICS[bodyKey];
  const sum = summaryOf(log, bodyKey);
  const pts = seriesOf(log, bodyKey, { days: bodyDays }).map((p) => ({ ...p, label: `${fmtDateShort(p.x)}: ${withUnit(bodyKey, p.y)}` }));
  const [tl, tc] = TREND[sum.trend] ?? ['–', 'var(--muted)'];
  const delta = sum.delta == null ? '' : ` (${sum.delta > 0 ? '+' : '−'}${fmtM(bodyKey, Math.abs(sum.delta))})`;
  const kp = (v, l, style = '') => `<div class="kpi"><b class="num" style="${style}">${v}</b><span>${l}</span></div>`;
  const recent = [...log].reverse().slice(0, 7);
  return `<div class="card">
    <div class="chips">${have.map((k) => `<button class="chip ${k === bodyKey ? 'on' : ''}" data-act="body-key" data-k="${k}">${METRICS[k].label}</button>`).join('')}</div>
    <div class="kpis four" style="grid-template-columns:repeat(3,1fr);margin:12px 0">
      ${kp(withUnit(bodyKey, sum.last?.value), sum.last ? `zuletzt · ${sum.last.day === dayKey(Date.now()) ? 'heute' : fmtDateShort(new Date(sum.last.day + 'T12:00'))}` : 'zuletzt')}
      ${kp(fmtM(bodyKey, sum.avg7), 'Ø 7 Tage')}
      ${kp(tl, `Trend${esc(delta)}`, `color:${tc}`)}
    </div>
    ${lineChart(pts, { unit: m.unit || m.label, empty: `Ab zwei Tagen mit ${m.label}-Wert erscheint hier der Verlauf.` })}
    <div class="chips" style="justify-content:center;margin-top:8px">${[[30, '30 Tage'], [90, '90 Tage'], [365, '1 Jahr']].map(([d, l]) => `<button class="chip ${d === bodyDays ? 'on' : ''}" data-act="body-days" data-d="${d}">${l}</button>`).join('')}</div>
    <p class="tiny muted" style="margin:10px 0 0">Trend: Ø der letzten 7 Tage gegenüber den 3 Wochen davor.${m.better === 'down' ? ' Beim Ruhepuls ist niedriger besser.' : ''}</p>
  </div>
  <div class="card tight">${recent.map((e) => {
    const vals = METRIC_KEYS.filter((k) => e[k] != null).map((k) => `${METRICS[k].label} ${withUnit(k, e[k])}`);
    const self = [e.energy && `Energie ${e.energy}`, e.sleep && `Schlaf ${e.sleep}`, e.stress && `Stress ${e.stress}`].filter(Boolean);
    return `<div class="plan-item"><div class="grow"><div class="name">${fmtDate(new Date(e.day + 'T12:00'))}</div>
      <div class="meta">${esc([...vals, ...self].join(' · ') || '–')}</div></div>
      <button class="icon-btn" data-act="body-del" data-day="${esc(e.day)}" aria-label="Tageswerte löschen">${ICONS.x}</button></div>`;
  }).join('')}</div>`;
}

async function bodyClick(act, el, rerender) {
  if (act === 'body-key') { bodyKey = el.dataset.k; return rerender(), true; }
  if (act === 'body-days') { bodyDays = +el.dataset.d; return rerender(), true; }
  if (act === 'body-del') {
    if (await confirmSheet('Tageswerte löschen?', `Die Körperwerte vom ${fmtDate(new Date(el.dataset.day + 'T12:00'))} werden gelöscht.`, 'Löschen', { danger: true })) {
      await store.deleteBodyDay(el.dataset.day);
      toast('Tageswerte gelöscht');
      rerender();
    }
    return true;
  }
  return false;
}

export function render(root, route, app) {
  const done = store.doneSessions();
  const bw = S.settings.profile.bodyweight || 80;
  if (!done.length) {
    root.innerHTML = `<div class="page-head"><h1>Fortschritt</h1></div><div class="card empty"><p>Noch keine abgeschlossenen Einheiten.<br>Nach dem ersten Training siehst du hier Verlauf, Rekorde und Wochenvolumen.</p><a class="btn primary" href="#/heute">Zum Tagesplan</a></div>
  <h2>Körperwerte</h2>${bodyHtml()}`;
    bindCharts(root);
    root.onclick = (e) => {
      const el = e.target.closest('[data-act]');
      if (el) bodyClick(el.dataset.act, el, () => render(root, route, app));
    };
    return;
  }
  const minWeek = parseInt(String(S.settings.profile.daysPerWeek), 10) || 3;
  const { streak, thisWeek } = weekStreak(S.sessions, minWeek);
  const days = trainingDays(S.sessions);

  // Rekorde (aus der ganzen Historie berechnet)
  const prs = computePRs(S.sets, bw);
  const prSets = S.sets.filter((x) => prs.has(x.id)).sort((a, b) => b.ts - a.ts).slice(0, 6);

  // Übungen nach Häufigkeit
  const counts = new Map();
  for (const x of S.sets) if (!x.warmup && !getEx(x.exerciseId).timed) counts.set(x.exerciseId, (counts.get(x.exerciseId) || 0) + 1);
  const exList = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  root.innerHTML = `<div class="page-head"><h1>Fortschritt</h1></div>
  <div class="kpis">
    <div class="kpi"><b class="num">${thisWeek}</b><span>Einheiten diese Woche (Ziel ${esc(S.settings.profile.daysPerWeek)})</span></div>
    <div class="kpi"><b class="num">${streak}</b><span>Wochen-Serie (≥ ${minWeek}/Woche)</span></div>
    <div class="kpi"><b class="num">${done.length}</b><span>Einheiten gesamt</span></div>
  </div>
  <div class="card">${calendarHtml(days)}</div>

  <h2>Körperwerte</h2>
  ${bodyHtml()}

  <h2>Wochenvolumen pro Muskelgruppe</h2>
  <div class="card">${volumeHtml()}</div>

  <h2>Rekorde</h2>
  <div class="card tight">${prSets.length ? prSets.map((x) => {
    const ex = getEx(x.exerciseId);
    return `<button class="list-btn" data-act="ex" data-id="${esc(x.exerciseId)}"><span style="font-size:22px">🏆</span>
      <div class="grow"><div style="font-weight:600">${esc(ex.name)}</div>
      <div class="tiny muted">${fmtNum(x.weight)} kg × ${x.reps} · ${prs.get(x.id).includes('e1rm') ? 'bestes e1RM' : 'schwerstes Gewicht'} · ${fmtDate(x.ts)}</div></div>${ICONS.chev}</button>`;
  }).join('') : '<div class="empty small">Rekorde erscheinen ab der zweiten Einheit einer Übung.</div>'}</div>

  <h2>Übungen</h2>
  <div class="card tight">${exList.map(([id, n]) => {
    const b = bestsFor(id, S.sets, bw);
    return `<button class="list-btn" data-act="ex" data-id="${esc(id)}"><div class="grow"><div style="font-weight:600">${esc(getEx(id).name)}</div>
      <div class="tiny muted">${n} Sätze · e1RM ${fmtNum(b.e1, 0)} kg · schwerster Satz ${fmtNum(b.heavy?.weight)} × ${b.heavy?.reps ?? '–'}</div></div>${ICONS.chev}</button>`;
  }).join('')}</div>

  <h2>Verlauf</h2>
  <div class="card tight">${[...done].reverse().slice(0, 30).map((s) => {
    const sets = store.setsOf(s.id).filter((x) => !x.warmup);
    const names = [...new Set(sets.map((x) => getEx(x.exerciseId).name))];
    return `<div class="plan-item"><div class="grow"><div class="name">${esc(s.title || 'Training')} <span class="tiny muted">· ${fmtDate(s.startedAt ?? s.date)}</span></div>
      <div class="meta">${s.endedAt ? fmtMin((s.endedAt - s.startedAt) / 1000) : '–'} · ${sets.length} Sätze · ${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? ' …' : ''}</div></div>
      <button class="icon-btn" data-act="del" data-id="${s.id}" aria-label="Einheit löschen">${ICONS.x}</button></div>`;
  }).join('')}</div>
  <p class="tiny faint" style="text-align:center">${MONTHS_LONG[new Date().getMonth()]} ${new Date().getFullYear()}</p>`;

  bindCharts(root);
  root.onclick = async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (await bodyClick(act, el, () => render(root, route, app))) return;
    if (act === 'ex') return app.go(`#/uebung/${encodeURIComponent(el.dataset.id)}`);
    if (act === 'wk-prev') { weekOffset--; return render(root, route, app); }
    if (act === 'wk-next') { weekOffset = Math.min(0, weekOffset + 1); return render(root, route, app); }
    if (act === 'del') {
      if (await confirmSheet('Einheit löschen?', 'Die Einheit und alle ihre Sätze werden gelöscht.', 'Löschen', { danger: true })) {
        await store.deleteSession(el.dataset.id);
        toast('Einheit gelöscht');
        render(root, route, app);
      }
    }
  };
}
