// Bildschirm "Fortschritt": Serie, Kalender, Wochenvolumen, Rekorde, Übungen, Verlauf.

import * as store from '../store.js';
import { S } from '../store.js';
import { getEx, MUSCLES } from '../data/exercises.js';
import { computePRs, weeklyVolume, weekStreak, trainingDays, bestsFor } from '../logic/stats.js';
import { progressRadar, FITNESS_AXES, STRENGTH_AXES } from '../logic/radar.js';
import { radarSvg } from './radar.js';
import { confirmSheet, toast, ICONS } from '../ui.js';
import { esc, fmtNum, fmtDate, fmtMin, dayKey, startOfWeek, DAY, MONTHS_LONG } from '../util.js';

const TARGET = [6, 12]; // empfohlene Arbeitssätze pro Muskel und Woche (allgemeine Fitness)
let weekOffset = 0;
let radarView = 'fitness'; // fitness | strength

const NO_DATA = {
  recovery: 'Noch zu wenig Daten: ab 3 Check-ins mit Ruhepuls, HRV oder Schlaf in 4 Wochen.',
  strength: 'Noch keine passende Übung in den letzten 6 Wochen.',
};

function radarHtml(bw) {
  const r = progressRadar({ sessions: S.sessions, sets: S.sets, profile: S.settings.profile });
  const fit = radarView === 'fitness';
  const axes = fit ? FITNESS_AXES : STRENGTH_AXES;
  const { now, before } = fit ? r.fitness : r.strength;
  const rows = axes.map((a) => {
    const v = now[a.key], b = before[a.key];
    const d = v != null && b != null ? v - b : null;
    const hint = v == null
      ? (fit ? NO_DATA[a.key] ?? 'Noch zu wenig Daten.' : NO_DATA.strength)
      : fit ? a.hint : `≈ ${fmtNum((v / 100) * a.target * bw, 0)} kg e1RM · 100 = ${fmtNum(a.target, 2)}× Körpergewicht`;
    const delta = d == null ? '' : `<span class="radar-d ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${d}</span>`;
    const tag = fit && a.key === 'strength' ? 'button data-act="radar" data-v="strength"' : 'div';
    return `<${tag} class="radar-row${v == null ? ' off' : ''}"><div class="grow"><b>${esc(a.label)}</b><div class="tiny muted">${esc(hint)}</div></div>
      <div class="num radar-v">${v ?? '–'}${delta}</div>${fit && a.key === 'strength' ? ICONS.chev : ''}</${tag.split(' ')[0]}>`;
  }).join('');
  return `<div class="chips" style="margin-bottom:4px">
      <button class="chip ${fit ? 'on' : ''}" data-act="radar" data-v="fitness">Fitness-Profil</button>
      <button class="chip ${fit ? '' : 'on'}" data-act="radar" data-v="strength">Kraftprofil</button>
    </div>
    ${radarSvg(axes, now, before, { link: fit ? 'strength' : null })}
    <div class="radar-legend tiny muted"><span><i></i>Heute</span><span><i class="before"></i>Vor 8 Wochen</span></div>
    <div class="radar-rows">${rows}</div>
    <p class="tiny muted" style="margin:10px 0 0">${fit
      ? '100 = Ziel erreicht. Kraft zählt das beste e1RM der letzten 6 Wochen, alles andere die letzten 4 Wochen. Tippe auf „Kraft“ für die einzelnen Übungen.'
      : 'Bestes geschätztes 1RM der letzten 6 Wochen geteilt durch dein Körpergewicht. Verwandte Übungen (z. B. Kurzhantel-Bankdrücken, Latziehen) werden umgerechnet.'}</p>`;
}

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

  <h2>Dein Profil</h2>
  <div class="card">${radarHtml(bw)}</div>

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
    if (act === 'radar' || act === 'radar-axis') { radarView = el.dataset.v ?? 'strength'; return render(root, route, app); }
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
