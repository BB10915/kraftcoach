// Bildschirm "Fortschritt": Serie, Kalender, Wochenvolumen, Rekorde, Übungen, Verlauf.

import * as store from '../store.js';
import { S } from '../store.js';
import { getEx, MUSCLES } from '../data/exercises.js';
import { computePRs, weeklyVolume, weekStreak, trainingDays, bestsFor } from '../logic/stats.js';
import { confirmSheet, toast, ICONS } from '../ui.js';
import { esc, fmtNum, fmtDate, fmtMin, dayKey, startOfWeek, DAY, MONTHS_LONG } from '../util.js';

const TARGET = [6, 12]; // empfohlene Arbeitssätze pro Muskel und Woche (allgemeine Fitness)
let weekOffset = 0;

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

export function render(root, route, app) {
  const done = store.doneSessions();
  const bw = S.settings.profile.bodyweight || 80;
  if (!done.length) {
    root.innerHTML = `<div class="page-head"><h1>Fortschritt</h1></div><div class="card empty"><p>Noch keine abgeschlossenen Einheiten.<br>Nach dem ersten Training siehst du hier Verlauf, Rekorde und Wochenvolumen.</p><a class="btn primary" href="#/heute">Zum Tagesplan</a></div>`;
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

  root.onclick = async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
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
