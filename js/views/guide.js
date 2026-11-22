// Übungsanleitung als Bottom-Sheet (Animation + Schritte + typische Fehler) und Vorschlags-Hinweis.

import * as store from '../store.js';
import { S } from '../store.js';
import { getEx, MUSCLES } from '../data/exercises.js';
import { guideFor, guideAdvice, LEVEL_LABEL } from '../data/guides.js';
import { animSvg, startAnims } from './anim.js';
import { sheet, toast } from '../ui.js';
import { esc } from '../util.js';

/** Vorschlag für diese Übung (berücksichtigt Erfahrung, Verlauf und „Kann ich schon“). */
export function adviceFor(id) {
  const t = S.settings.training;
  return guideAdvice(id, {
    sets: S.sets, experience: S.settings.profile.experience, known: t.guideKnown ?? [], enabled: t.guideHints !== false,
  });
}

export async function markKnown(id, known = true) {
  const list = new Set(S.settings.training.guideKnown ?? []);
  if (known) list.add(id); else list.delete(id);
  S.settings.training.guideKnown = [...list];
  await store.saveSettings();
}

/** Kleiner Hinweis-Kasten in der Trainingskarte. */
export function guideHintHtml(id) {
  const a = adviceFor(id);
  if (!a.suggest) return '';
  return `<div class="guide-hint">
    <div class="small"><span aria-hidden="true">💡</span> <b>${esc(a.reason)}</b> – kurze Anleitung mit Animation ansehen?</div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn sm ghost" data-act="guide-known" data-id="${esc(id)}" aria-label="Kann ich schon, nicht mehr vorschlagen">Kann ich schon</button>
      <button class="btn sm primary" data-act="guide" data-id="${esc(id)}">Anleitung ▶</button>
    </div>
  </div>`;
}

/** Anleitung öffnen. onChange wird aufgerufen, wenn „Kann ich“ geändert wurde. */
export function openGuide(id, { onChange } = {}) {
  const ex = getEx(id);
  const g = guideFor(id);
  const known = (S.settings.training.guideKnown ?? []).includes(id);
  const muscles = [...(ex.primary ?? []), ...(ex.secondary ?? [])].map((m) => MUSCLES[m]).filter(Boolean);
  const html = `<div class="row between" style="align-items:flex-start;gap:8px">
      <h3 style="margin-bottom:4px">${esc(ex.name)}</h3>
      <button class="icon-btn" data-act="close" aria-label="Schließen">✕</button>
    </div>
    <div class="small muted" style="margin-bottom:12px">
      <span class="badge ${g.level === 3 ? 'warn' : g.level === 2 ? 'info' : 'accent'}">${LEVEL_LABEL[g.level]}</span>
      ${muscles.length ? ` ${esc(muscles.slice(0, 4).join(', '))}` : ''}
    </div>
    ${g.anim ? `${animSvg(g.anim, { label: ex.name })}<div class="tiny faint" style="text-align:center;margin-top:6px">Antippen = Pause</div>` : ''}
    <h2 style="margin-top:14px">So geht's</h2>
    <ol class="guide-steps">${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    ${g.tips.length ? `<h2 style="margin-top:14px">Achte darauf</h2><ul class="guide-tips">${g.tips.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    <p class="tiny faint" style="margin-top:12px">Im Zweifel mit wenig Gewicht üben oder im Studio kurz einen Trainer fragen. Bei Schmerzen abbrechen.</p>
    <div class="btn-row" style="margin-top:14px">
      ${known
        ? '<button class="btn" data-act="unknown">Wieder vorschlagen</button>'
        : '<button class="btn" data-act="known">✓ Kann ich schon</button>'}
      <button class="btn primary" data-act="close">Verstanden</button>
    </div>`;
  const { root } = sheet(html, async (act, _el, close) => {
    if (act === 'close') return close();
    if (act === 'known' || act === 'unknown') {
      await markKnown(id, act === 'known');
      toast(act === 'known' ? 'Wird nicht mehr vorgeschlagen' : 'Wird wieder vorgeschlagen');
      close();
      onChange?.();
    }
  });
  startAnims(root);
}
