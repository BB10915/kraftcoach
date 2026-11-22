// Coach-Chat: kleiner Knopf unten rechts (auf jeder Seite, auch im Training) + Chatfenster.
// Der Verlauf bleibt nur auf diesem Gerät (localStorage).

import * as store from '../store.js';
import { S } from '../store.js';
import { askCoach } from '../ai/chat.js';
import { applyActions } from '../ai/chatactions.js';
import { toast } from '../ui.js';
import { esc } from '../util.js';

const KEY = 'kc-chat';
const MAX = 40;
let msgs = load();
let busy = false;
let open = false;
let undo = null; // { at: Index der Nachricht, settings, session }
let appRef = null;
let hooks = {};

function load() {
  try {
    const m = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(m) ? m : [];
  } catch {
    return [];
  }
}
function persist() {
  msgs = msgs.slice(-MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(msgs));
  } catch {}
}

const ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
const SEND = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

const currentSession = () => store.activeSession() ?? [...S.sessions].reverse().find((s) => s.status === 'planned') ?? null;
const doneCountFor = (sess) => (uid) => (sess ? store.setsOf(sess.id).filter((x) => !x.warmup && x.itemUid === uid).length : 0);

function suggestions() {
  const sess = currentSession();
  if (sess?.status === 'active') return ['Pause auf 2 Minuten', 'Übung fühlt sich zu schwer an', 'Nur noch 20 Minuten Zeit', 'Was tun bei Seitenstechen?'];
  return ['Lohnt sich Kreatin?', 'Was esse ich vor dem Training?', 'Heute nur 40 Minuten', 'Wie lange Pause zwischen Sätzen?'];
}

/** Einmal beim Start aufrufen. hooks.setTodayBudget(min) setzt das Zeitbudget auf „Heute“. */
export function initChat(app, h = {}) {
  appRef = app;
  hooks = h;
  const fab = document.createElement('button');
  fab.id = 'chat-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Coach-Chat öffnen');
  fab.innerHTML = ICON;
  fab.addEventListener('click', openChat);
  const panel = document.createElement('div');
  panel.id = 'chat';
  panel.hidden = true;
  document.body.append(fab, panel);
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
}

/** Knopf zeigen/verstecken (bei jedem Seitenwechsel aufgerufen). */
export function updateFab(routeName) {
  const fab = document.getElementById('chat-fab');
  if (!fab) return;
  fab.hidden = open || routeName === 'start' || S.settings.ai.chat === false;
}

// iPhone: Fenster über der Tastatur halten.
function fit() {
  const panel = document.getElementById('chat');
  const vv = window.visualViewport;
  if (!panel || panel.hidden || !vv) return;
  const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  panel.style.bottom = `${kb}px`;
  panel.style.maxHeight = `${Math.round(vv.height * 0.9)}px`;
}

export function openChat() {
  open = true;
  document.getElementById('chat-fab').hidden = true;
  const panel = document.getElementById('chat');
  panel.hidden = false;
  panel.innerHTML = `<div class="chat-bg" data-close></div>
    <section class="chat-box" role="dialog" aria-modal="true" aria-label="Coach-Chat">
      <header class="chat-head">
        <div class="grow"><b>Coach</b><div class="tiny muted" data-sub></div></div>
        <button class="btn ghost sm" data-clear>Leeren</button>
        <button class="icon-btn" data-close aria-label="Chat schließen">✕</button>
      </header>
      <div class="chat-msgs" data-msgs></div>
      <form class="chat-form" data-form>
        <textarea rows="1" placeholder="Nachricht an den Coach …" enterkeyhint="send" aria-label="Nachricht"></textarea>
        <button class="btn primary chat-send" aria-label="Senden">${SEND}</button>
      </form>
    </section>`;
  const ta = panel.querySelector('textarea');
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(ta.value);
    }
  });
  panel.querySelector('[data-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    send(ta.value);
  });
  panel.onclick = (e) => {
    if (e.target.closest('[data-close]')) return closeChat();
    if (e.target.closest('[data-clear]')) return clearChat();
    const sug = e.target.closest('[data-sug]');
    if (sug) return send(sug.dataset.sug);
    if (e.target.closest('[data-undo]')) return doUndo();
  };
  document.addEventListener('keydown', escClose);
  renderMsgs();
  fit();
}

function escClose(e) {
  if (e.key === 'Escape') closeChat();
}

export function closeChat() {
  open = false;
  const panel = document.getElementById('chat');
  panel.hidden = true;
  panel.innerHTML = '';
  document.removeEventListener('keydown', escClose);
  const fab = document.getElementById('chat-fab');
  fab.hidden = S.settings.ai.chat === false;
}

async function clearChat() {
  msgs = [];
  undo = null;
  persist();
  renderMsgs();
}

function fmt(text) {
  // Kleine Formatierung: **fett**, Zeilenumbrüche, Aufzählungen mit - oder •
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/^[-•]\s+/gm, '• ')
    .replace(/\n/g, '<br>');
}

function renderMsgs() {
  const box = document.querySelector('#chat [data-msgs]');
  if (!box) return;
  const sub = document.querySelector('#chat [data-sub]');
  if (sub) sub.textContent = S.settings.ai.apiKey && S.settings.ai.enabled ? 'Fragen & Änderungen in der App' : 'Ohne KI-Schlüssel: einfache Befehle';
  const rows = msgs.map((m, i) => {
    if (m.role === 'user') return `<div class="msg me">${fmt(m.text)}</div>`;
    const res = (m.results ?? []).map((r) => `<li class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✓' : '✕'} ${esc(r.text)}</li>`).join('');
    const canUndo = undo && undo.at === i;
    return `<div class="msg bot">${fmt(m.text)}${res ? `<ul class="msg-acts">${res}</ul>` : ''}
      ${canUndo ? '<button class="btn sm ghost" data-undo style="margin-top:6px">↶ Rückgängig</button>' : ''}${m.undone ? '<div class="tiny muted" style="margin-top:4px">Rückgängig gemacht</div>' : ''}</div>`;
  }).join('');
  const empty = !msgs.length
    ? `<div class="chat-empty"><p class="small muted">Frag mich alles rund ums Training, Ernährung oder Supplements – oder sag mir, was ich in der App ändern soll.</p>
       <div class="chips">${suggestions().map((s) => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`
    : '';
  box.innerHTML = empty + rows + (busy ? '<div class="msg bot typing"><i></i><i></i><i></i></div>' : '');
  box.scrollTop = box.scrollHeight;
  const btn = document.querySelector('#chat .chat-send');
  if (btn) btn.disabled = busy;
}

async function send(raw) {
  const text = String(raw ?? '').trim();
  if (!text || busy) return;
  const ta = document.querySelector('#chat textarea');
  if (ta) {
    ta.value = '';
    ta.style.height = 'auto';
  }
  const history = msgs.map((m) => ({
    role: m.role,
    text: m.role === 'model' && m.results?.length ? `${m.text}\n[App: ${m.results.map((r) => (r.ok ? '' : 'NICHT: ') + r.text).join('; ')}${m.undone ? '; vom Nutzer rückgängig gemacht' : ''}]` : m.text,
  }));
  msgs.push({ role: 'user', text, ts: Date.now() });
  busy = true;
  renderMsgs();

  const session = currentSession();
  let reply;
  try {
    reply = await askCoach({ message: text, history, settings: S.settings, session, sets: S.sets, doneCount: doneCountFor(session) });
  } catch (e) {
    reply = { text: `Da ging etwas schief: ${e?.message ?? e}`, actions: [] };
  }
  const msg = { role: 'model', text: reply.text || 'Okay.', ts: Date.now() };
  if (reply.actions?.length) {
    const fresh = currentSession(); // kann sich während des Wartens geändert haben
    const before = { settings: JSON.parse(JSON.stringify(S.settings)), session: fresh ? JSON.parse(JSON.stringify(fresh)) : null, todayBudget: hooks.getTodayBudget?.() ?? null };
    const res = applyActions(reply.actions, { settings: S.settings, session: fresh, doneCount: doneCountFor(fresh) });
    msg.results = res.results;
    try {
      if (res.settingsChanged) await store.saveSettings(res.settings);
      if (res.sessionChanged && res.session) await store.putSession(res.session);
      if (res.todayBudget) hooks.setTodayBudget?.(res.todayBudget);
      if (res.settingsChanged || res.sessionChanged || res.todayBudget) {
        undo = { at: msgs.length, ...before, todayBudget: res.todayBudget ? before.todayBudget : null };
        hooks.onChange?.();
        appRef?.refresh();
      }
    } catch (e) {
      msg.results.push({ ok: false, text: `Speichern fehlgeschlagen: ${e?.message ?? e}` });
    }
  }
  msgs.push(msg);
  busy = false;
  persist();
  renderMsgs();
}

async function doUndo() {
  if (!undo) return;
  const u = undo;
  undo = null;
  // KI-Einstellungen (Schlüssel, Modell) nie zurückdrehen – nur, was der Chat geändert hat.
  await store.saveSettings({ ...u.settings, ai: S.settings.ai });
  if (u.session) {
    // Nur zurücksetzen, wenn die Einheit noch existiert (nicht inzwischen beendet/gelöscht).
    const now = store.sessionById(u.session.id);
    if (now && now.status === u.session.status) await store.putSession(u.session);
  }
  if (u.todayBudget) hooks.setTodayBudget?.(u.todayBudget);
  if (msgs[u.at]) msgs[u.at].undone = true;
  persist();
  hooks.onChange?.();
  appRef?.refresh();
  toast('Änderung rückgängig gemacht');
  renderMsgs();
}
