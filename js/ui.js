// Gemeinsame UI-Bausteine: Toast, Bottom-Sheets, Icons.

import { esc, fmtNum, parseNum } from './util.js';

export const $ = (sel, root = document) => root.querySelector(sel);

let toastTimer;
export function toast(msg, kind = '') {
  const el = $('#toast');
  el.innerHTML = `<div class="t ${kind}">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.innerHTML = ''), kind === 'err' ? 5000 : 2800);
}

/**
 * Öffnet ein Bottom-Sheet. `onClick(action, el, close)` erhält Klicks auf [data-act].
 * Gibt close() zurück.
 */
export function sheet(html, onClick = () => {}, { onClose } = {}) {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="sheet-bg"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  const bg = ov.firstElementChild;
  const close = () => {
    ov.innerHTML = '';
    onClose?.();
  };
  bg.addEventListener('click', (e) => {
    if (e.target === bg) return close();
    const a = e.target.closest('[data-act]');
    if (a) onClick(a.dataset.act, a, close);
  });
  const first = bg.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 50);
  return { close, root: bg.firstElementChild };
}

export function confirmSheet(title, text, okLabel = 'OK', { danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    sheet(
      `<h3>${esc(title)}</h3>${text ? `<p class="muted">${esc(text)}</p>` : ''}
       <div class="btn-row" style="margin-top:16px">
         <button class="btn" data-act="no">Abbrechen</button>
         <button class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">${esc(okLabel)}</button>
       </div>`,
      (act, _el, close) => {
        done = true;
        close();
        resolve(act === 'yes');
      },
      { onClose: () => !done && resolve(false) },
    );
  });
}

/** Zahl eingeben (Komma erlaubt). */
export function numberSheet(title, value, { unit = '', decimals = 1 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const { root, close } = sheet(
      `<h3>${esc(title)}</h3>
       <form class="row" data-form>
         <input type="text" inputmode="decimal" value="${esc(fmtNum(value, decimals))}" autofocus style="font-size:28px;font-weight:700;text-align:center" />
         ${unit ? `<span class="muted" style="font-size:18px">${esc(unit)}</span>` : ''}
       </form>
       <div class="btn-row" style="margin-top:16px">
         <button class="btn" data-act="no">Abbrechen</button>
         <button class="btn primary" data-act="ok">Übernehmen</button>
       </div>`,
      (act, _el, close) => {
        if (act === 'ok') return submit();
        done = true;
        close();
        resolve(null);
      },
      { onClose: () => !done && resolve(null) },
    );
    const input = root.querySelector('input');
    input.addEventListener('focus', () => input.select());
    const submit = () => {
      const n = parseNum(input.value);
      if (n == null || n < 0) return toast('Bitte eine gültige Zahl eingeben', 'err');
      done = true;
      close();
      resolve(n);
    };
    root.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });
  });
}

export const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
  train: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  swap: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
  trophy: '🏆',
};
