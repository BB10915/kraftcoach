// Kleines Liniendiagramm (SVG) mit Antippen/Hover-Anzeige. Eine Serie, eine Farbe.

import { esc, fmtNum, fmtDateShort } from '../util.js';

/**
 * points: [{ x: ts, y: number, label: string }]
 * Gibt HTML zurück; danach bindChart(root) aufrufen.
 */
export function lineChart(points, { height = 200, unit = 'kg', id = 'c' } = {}) {
  if (points.length < 2) return '<div class="empty small">Ab zwei Einheiten erscheint hier der Verlauf.</div>';
  const W = 340, H = height, L = 36, R = 10, T = 12, B = 24;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(2, (y1 - y0) * 0.15);
  y0 = Math.max(0, Math.floor((y0 - pad) / 5) * 5);
  y1 = Math.ceil((y1 + pad) / 5) * 5;
  const sx = (x) => L + ((x - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const sy = (y) => T + (1 - (y - y0) / Math.max(1, y1 - y0)) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => y0 + (y1 - y0) * f);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const data = esc(JSON.stringify(points.map((p) => ({ x: sx(p.x), y: sy(p.y), t: p.label }))));
  const xl = [points[0], points[points.length - 1]];
  return `<div style="position:relative" data-chart='${data}'>
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf ${esc(unit)}">
    ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${fmtNum(v, 0)}</text>`).join('')}
    ${xl.map((p, i) => `<text x="${sx(p.x)}" y="${H - 6}" text-anchor="${i ? 'end' : 'start'}">${fmtDateShort(p.x)}</text>`).join('')}
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map((p) => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${p.pr ? 5 : 3.5}" fill="${p.pr ? 'var(--gold)' : 'var(--accent)'}" stroke="var(--surface)" stroke-width="2"/>`).join('')}
    <line data-cross x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 3" visibility="hidden"/>
  </svg>
  <div data-tip class="tiny" style="position:absolute;top:0;pointer-events:none;background:var(--surface-3);border:1px solid var(--line);border-radius:8px;padding:4px 8px;white-space:nowrap;display:none"></div>
</div>`;
}

export function bindCharts(root) {
  root.querySelectorAll('[data-chart]').forEach((box) => {
    const pts = JSON.parse(box.dataset.chart);
    const svg = box.querySelector('svg');
    const tip = box.querySelector('[data-tip]');
    const cross = box.querySelector('[data-cross]');
    const show = (ev) => {
      const r = svg.getBoundingClientRect();
      const vx = ((ev.clientX - r.left) / r.width) * 340;
      const p = pts.reduce((a, b) => (Math.abs(b.x - vx) < Math.abs(a.x - vx) ? b : a));
      cross.setAttribute('x1', p.x);
      cross.setAttribute('x2', p.x);
      cross.setAttribute('visibility', 'visible');
      tip.textContent = p.t;
      tip.style.display = 'block';
      const px = (p.x / 340) * r.width;
      tip.style.left = `${Math.min(Math.max(0, px - tip.offsetWidth / 2), r.width - tip.offsetWidth)}px`;
    };
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; cross.setAttribute('visibility', 'hidden'); });
  });
}
