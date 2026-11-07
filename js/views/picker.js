// Übungsauswahl als Bottom-Sheet (Hinzufügen und Tauschen).

import { EXERCISES, MUSCLES, EQUIPMENT, getEx } from '../data/exercises.js';
import { sheet } from '../ui.js';
import { esc } from '../util.js';

const FILTERS = [
  ['all', 'Alle'], ['legs', 'Beine'], ['push', 'Drücken'], ['pull', 'Ziehen'], ['arms', 'Arme'], ['core', 'Rumpf'], ['cardio', 'Kondition'], ['mobility', 'Mobility'],
];
const GROUP = {
  legs: (e) => ['quads', 'hamstrings', 'glutes', 'calves'].some((m) => e.primary.includes(m)),
  push: (e) => ['chest', 'shoulders'].some((m) => e.primary.includes(m)) && e.pattern !== 'reardelt',
  pull: (e) => ['lats', 'upperback'].some((m) => e.primary.includes(m)) || e.pattern === 'reardelt',
  arms: (e) => ['biceps', 'triceps'].some((m) => e.primary.includes(m)),
  core: (e) => e.primary.includes('core') || e.primary.includes('lowerback'),
  cardio: (e) => e.kind === 'cardio',
  mobility: (e) => e.kind === 'mobility',
};

function row(e, sub = '') {
  const muscles = e.primary.map((m) => MUSCLES[m]).join(', ') || (e.kind === 'cardio' ? 'Kondition' : 'Beweglichkeit');
  return `<button class="list-btn" data-act="pick" data-id="${esc(e.id)}">
    <div class="grow"><div style="font-weight:600">${esc(e.name)}</div>
    <div class="tiny muted">${esc(muscles)} · ${esc(EQUIPMENT[e.eq]?.split(' ')[0] ?? '')}${sub ? ' · ' + esc(sub) : ''}</div></div>
  </button>`;
}

/**
 * @param {{title:string, exclude?:string[], suggestions?:Array, equipment?:string[], onPick:(id)=>void}} o
 */
export function openPicker({ title, exclude = [], suggestions = [], equipment = null, onPick }) {
  let filter = 'all';
  let q = '';
  const { root, close } = sheet(
    `<div class="row between"><h3 style="margin:0">${esc(title)}</h3><button class="icon-btn" data-act="close" aria-label="Schließen">✕</button></div>
     ${suggestions.length ? `<div class="small muted" style="margin:12px 0 2px">Passende Alternativen</div><div>${suggestions.slice(0, 5).map((e) => row(e)).join('')}</div><div class="hr"></div>` : ''}
     <input type="search" placeholder="Übung suchen …" data-q style="margin:6px 0 10px" />
     <div class="chips" data-filters style="margin-bottom:6px">${FILTERS.map(([k, l]) => `<button class="chip ${k === 'all' ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>
     <div data-list></div>`,
    (act, el, close) => {
      if (act === 'close') return close();
      if (act === 'filter') {
        filter = el.dataset.f;
        root.querySelectorAll('[data-act=filter]').forEach((b) => b.classList.toggle('on', b.dataset.f === filter));
        renderList();
      }
      if (act === 'pick') {
        close();
        onPick(el.dataset.id);
      }
    },
  );
  const list = root.querySelector('[data-list]');
  const renderList = () => {
    const ql = q.toLowerCase();
    const items = EXERCISES.filter(
      (e) => !exclude.includes(e.id) && (!equipment || equipment.includes(e.eq)) && (filter === 'all' || GROUP[filter](e)) && (!ql || e.name.toLowerCase().includes(ql)),
    );
    list.innerHTML = items.length ? items.map((e) => row(e)).join('') : '<div class="empty">Nichts gefunden.</div>';
  };
  root.querySelector('[data-q]').addEventListener('input', (e) => {
    q = e.target.value;
    renderList();
  });
  renderList();
  return close;
}

export { getEx };
