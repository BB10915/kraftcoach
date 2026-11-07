// Übungsdetail: Verlauf (e1RM), Bestwerte, letzte Einheiten.

import { S } from '../store.js';
import { getEx, MUSCLES } from '../data/exercises.js';
import { seriesFor, bestsFor, computePRs } from '../logic/stats.js';
import { prevSessionsFor } from '../logic/history.js';
import { rirLabel } from '../logic/progression.js';
import { lineChart, bindCharts } from './chart.js';
import { esc, fmtNum, fmtDate } from '../util.js';

export function render(root, route, app) {
  const id = route.param;
  const ex = getEx(id);
  const bw = S.settings.profile.bodyweight || 80;
  const series = seriesFor(id, S.sets, bw);
  const bests = bestsFor(id, S.sets, bw);
  const prs = computePRs(S.sets, bw);
  const sessions = prevSessionsFor(id, S.sets, { bodyweight: bw }).slice(0, 8);
  const unit = ex.bw ? 'kg (inkl. Körpergewicht)' : ex.perHand ? 'kg pro Hand' : 'kg';

  const points = series.map((p) => ({
    x: p.ts, y: p.e1, pr: prs.has(p.top.id),
    label: `${fmtDate(p.ts)}: e1RM ${fmtNum(p.e1, 1)} kg · ${fmtNum(p.top.weight)} × ${p.top.reps} @RIR ${rirLabel(p.top.rir)}`,
  }));
  const first = series[0]?.e1, last = series[series.length - 1]?.e1;
  const delta = series.length > 1 ? ((last - first) / first) * 100 : null;

  root.innerHTML = `<div class="page-head"><div class="row"><a class="icon-btn" href="#/fortschritt" aria-label="Zurück">‹</a>
    <div><h1 style="font-size:22px">${esc(ex.name)}</h1><div class="sub">${ex.primary.map((m) => MUSCLES[m]).join(', ')}</div></div></div></div>
  <div class="kpis">
    <div class="kpi"><b class="num">${fmtNum(bests.e1, 0)}</b><span>bestes e1RM (${esc(unit)})</span></div>
    <div class="kpi"><b class="num">${bests.heavy ? `${fmtNum(bests.heavy.weight)}×${bests.heavy.reps}` : '–'}</b><span>schwerster Satz</span></div>
    <div class="kpi"><b class="num" style="color:${delta == null ? 'inherit' : delta >= 0 ? 'var(--accent)' : 'var(--warn)'}">${delta == null ? '–' : `${delta >= 0 ? '+' : ''}${fmtNum(delta, 0)} %`}</b><span>seit Beginn</span></div>
  </div>
  <h2>Geschätztes 1RM pro Einheit</h2>
  <div class="card">${lineChart(points, { unit })}
    <p class="tiny muted" style="margin:8px 0 0">Antippen zeigt den Wert. Goldene Punkte = Rekord. e1RM = geschätztes Maximalgewicht für 1 Wdh. aus Gewicht, Wdh. und RIR.</p></div>
  <h2>Letzte Einheiten</h2>
  <div class="card tight">${sessions.map((s) => `<div class="plan-item"><div class="grow">
      <div class="name">${fmtDate(s.date)}</div>
      <div class="meta num">${s.sets.map((x) => `${fmtNum(x.weight)}×${x.reps}${prs.has(x.id) ? ' 🏆' : ''} <span class="faint">(${rirLabel(x.rir)})</span>`).join(' · ')}</div>
    </div><span class="tiny muted">${fmtNum(s.best, 0)} e1RM</span></div>`).join('') || '<div class="empty small">Noch keine Sätze.</div>'}</div>`;
  bindCharts(root);
}
