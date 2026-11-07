// Einstieg: Daten laden, Navigation (Hash-Router), Service Worker.

import * as store from './store.js';
import { ICONS, $, toast } from './ui.js';
import { unlockAudio } from './timer.js';
import * as today from './views/today.js';
import * as workout from './views/workout.js';
import * as progress from './views/progress.js';
import * as exercise from './views/exercise.js';
import * as settings from './views/settings.js';

const ROUTES = {
  heute: today,
  training: workout,
  fortschritt: progress,
  uebung: exercise,
  einstellungen: settings,
};

let current = null;

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const [name, ...rest] = path.split('/');
  return { name: ROUTES[name] ? name : 'heute', param: rest.join('/') ? decodeURIComponent(rest.join('/')) : null, query: new URLSearchParams(query) };
}

export const app = {
  go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  },
  refresh: () => render(),
};

function renderTabbar(name) {
  const active = !!store.activeSession();
  const tabs = [
    ['heute', 'Heute', ICONS.today],
    ['training', 'Training', ICONS.train],
    ['fortschritt', 'Fortschritt', ICONS.stats],
    ['einstellungen', 'Einstellungen', ICONS.settings],
  ];
  const on = name === 'uebung' ? 'fortschritt' : name;
  $('#tabbar').innerHTML = `<div class="in">${tabs
    .map(([k, l, ic]) => `<a href="#/${k}" class="${on === k ? 'on' : ''}" ${on === k ? 'aria-current="page"' : ''}>${ic}${k === 'training' && active ? '<span class="dot"></span>' : ''}<span>${l}</span></a>`)
    .join('')}</div>`;
}

function render() {
  const r = parseHash();
  const view = ROUTES[r.name];
  if (current && current !== view) current.leave?.();
  current = view;
  renderTabbar(r.name);
  const root = $('#app');
  root.onclick = null;
  view.render(root, r, app);
}

async function boot() {
  try {
    await store.load();
  } catch (e) {
    $('#app').innerHTML = `<div class="card warn"><h3>Speicher nicht verfügbar</h3><p class="small">Der Browser erlaubt keine lokale Datenbank (privater Modus?). ${String(e?.message ?? e)}</p></div>`;
    return;
  }
  // Daten dauerhaft speichern lassen (Browser löscht sonst evtl. bei Speichermangel).
  navigator.storage?.persist?.().catch(() => {});
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('hashchange', render);
  if (!location.hash && store.activeSession()) location.hash = '#/training';
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Update verfügbar – App einmal schließen und neu öffnen.');
        });
      });
    }).catch(() => {});
  }
}

boot();
