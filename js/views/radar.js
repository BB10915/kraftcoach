// Netzdiagramm (SVG): Fläche = heute, gestrichelt = vor 8 Wochen. Achsen ohne Daten grau.

import { esc } from '../util.js';

/**
 * axes: [{ key, label }], now/before: { key: 0..100 | null }
 * link: key einer Achse, die als antippbar markiert wird (data-act="radar-axis").
 */
export function radarSvg(axes, now, before, { link = null } = {}) {
  const W = 340, H = 276, cx = W / 2, cy = 140, R = 90;
  const n = axes.length;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100];
  };
  const f = (p) => p.map((x) => x.toFixed(1)).join(',');
  const poly = (vals) => vals.map((v, i) => f(pt(i, v ?? 0))).join(' ');
  const has = (o) => axes.some((a) => o?.[a.key] != null);
  let s = '';
  for (const r of [25, 50, 75, 100]) s += `<polygon points="${poly(axes.map(() => r))}" fill="none" stroke="var(--line)" stroke-width="${r === 100 ? 1.5 : 1}"/>`;
  axes.forEach((a, i) => { const [x, y] = pt(i, 100); s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)"/>`; });
  if (has(now)) s += `<polygon points="${poly(axes.map((a) => now[a.key]))}" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
  if (has(before)) s += `<polygon points="${poly(axes.map((a) => before[a.key]))}" fill="none" stroke="var(--gold)" stroke-width="1.6" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
  axes.forEach((a, i) => {
    const v = now?.[a.key];
    if (v != null) { const [x, y] = pt(i, v); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="var(--accent)"/>`; }
    const [lx, ly] = pt(i, 100 + 1400 / R);
    const mid = Math.abs(lx - cx) < 8;
    const anchor = mid ? 'middle' : lx > cx ? 'start' : 'end';
    const y0 = mid ? (ly < cy ? ly - 18 : ly + 8) : ly - 3; // zwei Zeilen: Name, Wert
    const fill = v == null ? 'var(--faint)' : 'var(--text)';
    const x = lx.toFixed(1);
    const label = `<text x="${x}" y="${y0.toFixed(1)}" text-anchor="${anchor}" fill="${fill}" font-size="13"${a.key === link ? ' text-decoration="underline"' : ''}>${esc(a.label)}<tspan x="${x}" dy="16" font-weight="700">${v == null ? '–' : v}</tspan></text>`;
    s += a.key === link
      ? `<g data-act="radar-axis" data-key="${esc(a.key)}" style="cursor:pointer">${label}</g>`
      : label;
  });
  return `<svg class="radar" viewBox="0 0 ${W} ${H}" role="img" aria-label="Netzdiagramm: ${esc(axes.map((a) => `${a.label} ${now?.[a.key] ?? 'keine Daten'}`).join(', '))}">${s}</svg>`;
}
