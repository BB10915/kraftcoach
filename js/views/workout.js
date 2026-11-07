// Bildschirm "Training": Satz eintragen (RIR tippen = speichern), Live-Vorschlag, Pausentimer, Zeitbudget.

import * as store from '../store.js';
import { S } from '../store.js';
import { getEx, alternatives } from '../data/exercises.js';
import { suggestFirst, suggestNext, rirLabel } from '../logic/progression.js';
import { prevSessionsFor } from '../logic/history.js';
import { projection, proposeCut, applyCut } from '../logic/timing.js';
import { setE1rm } from '../logic/e1rm.js';
import { makeItem } from '../logic/planner.js';
import { openPicker } from './picker.js';
import { toast, confirmSheet, numberSheet, sheet, ICONS } from '../ui.js';
import { beep, keepAwake } from '../timer.js';
import { esc, uid, fmtNum, fmtClock, fmtMin, roundTo, clamp } from '../util.js';

let tick = null;
let draft = null; // { key, weight, reps, reason, calibrating }
let beeped = false;

export function leave() {
  clearInterval(tick);
  tick = null;
  keepAwake(false);
}

const workSetsOf = (sess) => store.setsOf(sess.id).filter((x) => !x.warmup);
function doneMap(sess) {
  const m = new Map();
  for (const x of workSetsOf(sess)) m.set(x.itemUid, (m.get(x.itemUid) || 0) + 1);
  return m;
}
const openItems = (sess) => sess.items.filter((i) => i.status === 'open');

function currentItem(sess) {
  let it = sess.items.find((i) => i.uid === sess.currentUid && i.status === 'open');
  if (!it) it = openItems(sess)[0];
  if (it && sess.currentUid !== it.uid) sess.currentUid = it.uid;
  return it ?? null;
}

function unitLabel(ex) {
  if (ex.bw) return 'kg Zusatz';
  if (ex.perHand) return 'kg pro Hand';
  return 'kg';
}

/** Vorschlag für den nächsten Satz des aktuellen Items berechnen (gecacht pro Satznummer). */
function ensureDraft(sess, it) {
  const ex = getEx(it.exerciseId);
  const mine = workSetsOf(sess).filter((x) => x.itemUid === it.uid);
  const key = `${it.uid}:${mine.length}:${it.exerciseId}`;
  if (draft?.key === key) return draft;
  const bw = S.settings.profile.bodyweight || 80;
  let sug;
  if (mine.length) {
    const last = mine[mine.length - 1];
    sug = suggestNext({ ex, item: it, lastSet: last, bodyweight: bw, calibrating: !!it.calibrating });
    sug.calibrating = !!it.calibrating;
  } else {
    sug = suggestFirst({
      ex, item: it, bodyweight: bw, experience: S.settings.profile.experience,
      baseline: S.settings.profile.baselines?.[it.exerciseId],
      prevSessions: prevSessionsFor(it.exerciseId, S.sets, { excludeSessionId: sess.id, bodyweight: bw }),
    });
    if (it.calibrating !== sug.calibrating) {
      it.calibrating = sug.calibrating;
      store.putSession(sess);
    }
  }
  draft = { key, weight: sug.weight, reps: sug.reps, reason: sug.reason, calibrating: sug.calibrating, sugW: sug.weight, sugR: sug.reps };
  return draft;
}

function warmupHint(ex, weight) {
  if (ex.kind !== 'compound' || ex.bw || weight < 30) return '';
  const st = ex.step || 2.5;
  const bar = ex.eq === 'lh' ? 20 : st;
  const steps = ex.eq === 'lh' ? [[bar, 10]] : [];
  for (const [p, reps] of [[0.5, 6], [0.7, 4], [0.85, 2]]) {
    const w = roundTo(weight * p, st);
    if (w > (steps.at(-1)?.[0] ?? 0) && w < weight) steps.push([w, reps]);
  }
  return steps.length ? `Aufwärmen: ${steps.map(([w, r]) => `${fmtNum(w)} × ${r}`).join(' → ')}` : '';
}

// ---------- Rendering ----------

function topHtml(sess, pr) {
  const pct = clamp((pr.elapsed / pr.budget) * 100, 0, 100);
  const proj = clamp((pr.projected / pr.budget) * 100, 0, 100);
  const over = pr.over > 60;
  return `<div class="wo-top">
    <div class="row between small" style="margin-bottom:6px">
      <span><b class="num" data-elapsed>${fmtClock(pr.elapsed)}</b> <span class="muted">/ ${sess.budgetMin} Min</span></span>
      <span class="${over ? '' : 'muted'}" style="${over ? 'color:var(--warn)' : ''}">Prognose ≈ ${fmtMin(pr.projected)}</span>
    </div>
    <div class="timebar ${over ? 'over' : ''}"><i style="width:${pct}%"></i><b style="left:${proj}%"></b></div>
  </div>`;
}

function cutHtml(sess, pr, dm) {
  if (pr.over < 120) return '';
  if (sess.cutDismissed && pr.over < sess.cutDismissed + 180) return '';
  const cut = proposeCut(sess.items, dm, pr.over);
  if (!cut) return '';
  return `<div class="card warn tight">
    <div class="small"><b>Du liegst ≈ ${fmtMin(pr.over)} über dem Budget.</b><br>Vorschlag: ${esc(cut.label)} (−${fmtMin(cut.saves)})</div>
    <div class="btn-row" style="margin-top:10px">
      <button class="btn sm" data-act="cut-ignore">Ignorieren</button>
      <button class="btn sm primary" data-act="cut-apply" data-cut='${esc(JSON.stringify(cut))}'>Übernehmen</button>
    </div></div>`;
}

function restHtml(sess) {
  if (!sess.rest) return '';
  const left = (sess.rest.endAt - Date.now()) / 1000;
  return `<div class="rest ${left <= 0 ? 'done' : left < 10 ? 'ending' : ''}" data-rest>
    <div class="grow"><div class="tiny muted">${esc(sess.rest.label || 'Pause')}</div><div class="clock num" data-rest-clock>${left <= 0 ? 'Los!' : fmtClock(left)}</div></div>
    <button class="btn sm" data-act="rest-plus">+30 s</button>
    <button class="btn sm" data-act="rest-skip">${left <= 0 ? 'OK' : 'Weiter'}</button>
  </div>`;
}

function strengthCard(sess, it, dm) {
  const ex = getEx(it.exerciseId);
  const d = ensureDraft(sess, it);
  const mine = workSetsOf(sess).filter((x) => x.itemUid === it.uid);
  const n = mine.length;
  const extra = n >= it.sets;
  const changed = d.weight !== d.sugW || d.reps !== d.sugR;
  return `<div class="card">
    <div class="row between" style="align-items:flex-start">
      <div class="grow">
        <h2 class="ex-title">${esc(ex.name)}</h2>
        <div class="target">Satz <b>${n + 1}</b> von ${it.sets}${extra ? ' (Zusatz)' : ''} · ${it.repsMin}–${it.repsMax} Wdh. · Ziel-RIR ${it.rir} · Pause ${fmtClock(it.restSec)}</div>
      </div>
      <button class="icon-btn" data-act="swap" aria-label="Übung tauschen">${ICONS.swap}</button>
    </div>
    ${it.note ? `<div class="pill-note" style="margin-top:10px">${esc(it.note)}</div>` : ''}
    <div class="reason ${d.calibrating ? 'calib' : ''}">${esc(d.reason || '')}${changed ? ' <span class="faint">(angepasst)</span>' : ''}</div>
    ${n === 0 ? `<div class="tiny faint" style="margin-bottom:6px">${esc(warmupHint(ex, d.weight))}</div>` : ''}
    <div class="steppers" style="margin-top:8px">
      <div class="stepper">
        <button class="icon-btn" data-act="w-" aria-label="Gewicht verringern">−</button>
        <button class="v" data-act="w-edit" aria-label="Gewicht eingeben"><b class="num">${fmtNum(d.weight)}</b><span>${unitLabel(ex)}</span></button>
        <button class="icon-btn" data-act="w+" aria-label="Gewicht erhöhen">+</button>
      </div>
      <div class="stepper">
        <button class="icon-btn" data-act="r-" aria-label="Wiederholungen verringern">−</button>
        <button class="v" data-act="r-edit" aria-label="Wiederholungen eingeben"><b class="num">${d.reps}</b><span>Wiederholungen</span></button>
        <button class="icon-btn" data-act="r+" aria-label="Wiederholungen erhöhen">+</button>
      </div>
    </div>
    <div class="small muted" style="margin:14px 0 8px">Nach dem Satz: Wie viele Wdh. wären noch gegangen? <b style="color:var(--text)">Tippen = speichern</b></div>
    <div class="rir-grid">
      ${[0, 1, 2, 3, 4].map((r) => `<button data-act="log" data-rir="${r}" class="${r === it.rir ? 'target' : ''}" aria-label="RIR ${rirLabel(r)} – Satz speichern">${rirLabel(r)}<small>${['Versagen', 'noch 1', 'noch 2', 'noch 3', 'locker'][r]}</small></button>`).join('')}
    </div>
    ${mine.length ? `<div class="set-list">${mine.map((x, i) => setRow(x, i, ex)).join('')}</div>` : ''}
    <div class="btn-row" style="margin-top:12px">
      <button class="btn sm" data-act="set+">+ Satz</button>
      ${it.sets > Math.max(1, n) ? '<button class="btn sm" data-act="set-">− Satz</button>' : ''}
      <button class="btn sm" data-act="item-done">${n ? 'Übung fertig' : 'Überspringen'}</button>
    </div>
  </div>`;
}

function setRow(x, i, ex) {
  const pr = x.pr?.length;
  return `<button class="set-row ${pr ? 'pr' : ''}" data-act="edit-set" data-id="${x.id}">
    <span class="n">${i + 1}</span>
    <span class="grow num"><b>${fmtNum(x.weight)}</b> ${ex.bw ? 'kg+' : 'kg'} × <b>${x.reps}</b> <span class="muted">· RIR ${rirLabel(x.rir)}</span></span>
    ${pr ? '<span class="badge gold">🏆 Rekord</span>' : `<span class="tiny faint">${fmtNum(setE1rm(ex, x, S.settings.profile.bodyweight), 0)} e1RM</span>`}
  </button>`;
}

function timedCard(it) {
  const ex = getEx(it.exerciseId);
  return `<div class="card">
    <span class="badge ${it.role === 'warmup' ? 'info' : 'warn'}">${it.role === 'warmup' ? 'Aufwärmen / Beweglichkeit' : 'Kondition'}</span>
    <h2 class="ex-title" style="margin-top:8px">${esc(ex.name)}</h2>
    <div class="target">${it.minutes} Minuten</div>
    ${it.text ? `<p style="margin:10px 0 0">${esc(it.text)}</p>` : ''}
    <div class="btn-row" style="margin-top:14px">
      <button class="btn" data-act="timed-start">Timer ${it.minutes}:00</button>
      <button class="btn primary" data-act="item-done">Erledigt ✓</button>
    </div>
    <button class="btn ghost sm block" data-act="item-skip" style="margin-top:8px">Überspringen</button>
  </div>`;
}

function listHtml(sess, dm, cur) {
  const rows = sess.items.map((it, i) => {
    const ex = getEx(it.exerciseId);
    const done = dm.get(it.uid) || 0;
    const st = it.status === 'skipped' ? 'gestrichen' : it.kind === 'timed' ? `${it.minutes} Min` : `${done}/${it.sets} Sätze`;
    const cls = it.uid === cur?.uid ? 'current' : it.status !== 'open' ? 'done' : '';
    return `<button class="plan-item list-btn ${cls}" data-act="goto" data-uid="${it.uid}" style="border-radius:12px">
      <div class="idx">${it.status === 'done' ? '✓' : i + 1}</div>
      <div class="grow"><div class="name">${esc(ex.name)}</div><div class="meta">${st}</div></div>
    </button>`;
  }).join('');
  return `<h2>Ablauf</h2><div class="card tight">${rows || '<div class="empty">Noch keine Übungen.</div>'}
    <button class="btn ghost block sm" data-act="add" style="margin-top:6px">+ Übung hinzufügen</button></div>`;
}

export function render(root, route, app) {
  const sess = store.activeSession();
  if (!sess) {
    leave();
    root.innerHTML = `<div class="page-head"><h1>Training</h1></div>
      <div class="card empty"><p>Gerade läuft kein Training.</p><a class="btn primary" href="#/heute">Zum Tagesplan</a></div>`;
    return;
  }
  if (S.settings.training.wakeLock) keepAwake(true);
  const dm = doneMap(sess);
  const cur = currentItem(sess);
  const pr = projection(sess, dm);

  root.innerHTML = `${topHtml(sess, pr)}
    ${cutHtml(sess, pr, dm)}
    ${restHtml(sess)}
    ${cur ? (cur.kind === 'timed' ? timedCard(cur) : strengthCard(sess, cur, dm))
      : `<div class="card empty"><p>${sess.items.length ? 'Alle Übungen erledigt! 🎉' : 'Füge deine erste Übung hinzu.'}</p>
         <button class="btn ${sess.items.length ? '' : 'primary'}" data-act="add">+ Übung hinzufügen</button></div>`}
    ${listHtml(sess, dm, cur)}
    <button class="btn ${cur ? '' : 'primary'} block big" data-act="finish" style="margin-top:8px">Training beenden</button>
    <button class="btn ghost danger block sm" data-act="abort" style="margin-top:8px">Training abbrechen (löschen)</button>`;

  startTick(root, sess);
  root.onclick = (e) => {
    const el = e.target.closest('[data-act]');
    if (el) onAction(el.dataset.act, el, sess, cur, root, route, app);
  };
}

function startTick(root, sess) {
  clearInterval(tick);
  tick = setInterval(() => {
    const el = root.querySelector('[data-elapsed]');
    if (el && sess.startedAt) el.textContent = fmtClock((Date.now() - sess.startedAt) / 1000);
    if (!sess.rest) return;
    const left = (sess.rest.endAt - Date.now()) / 1000;
    const box = root.querySelector('[data-rest]');
    const clock = root.querySelector('[data-rest-clock]');
    if (clock) clock.textContent = left <= 0 ? 'Los!' : fmtClock(left);
    box?.classList.toggle('ending', left > 0 && left < 10);
    box?.classList.toggle('done', left <= 0);
    if (left <= 0 && !beeped) {
      beeped = true;
      beep({ sound: S.settings.training.sound, vibrate: S.settings.training.vibrate });
    }
  }, 250);
}

function startRest(sess, sec, label = 'Pause') {
  sess.rest = { endAt: Date.now() + sec * 1000, total: sec, label };
  beeped = false;
}

function advance(sess) {
  const open = openItems(sess);
  const idx = sess.items.findIndex((i) => i.uid === sess.currentUid);
  const next = open.find((i) => sess.items.indexOf(i) > idx) ?? open[0];
  sess.currentUid = next?.uid ?? null;
}

async function onAction(act, el, sess, cur, root, route, app) {
  const rerender = () => render(root, route, app);
  const save = async () => { await store.putSession(sess); rerender(); };
  const ex = cur ? getEx(cur.exerciseId) : null;
  const d = draft;
  const step = ex?.step || 2.5;

  switch (act) {
    case 'w-': d.weight = Math.max(0, roundTo(d.weight - step, step)); return rerender();
    case 'w+': d.weight = roundTo(d.weight + step, step); return rerender();
    case 'r-': d.reps = Math.max(1, d.reps - 1); return rerender();
    case 'r+': d.reps = d.reps + 1; return rerender();
    case 'w-edit': {
      const v = await numberSheet('Gewicht', d.weight, { unit: unitLabel(ex) });
      if (v != null) d.weight = v;
      return rerender();
    }
    case 'r-edit': {
      const v = await numberSheet('Wiederholungen', d.reps, { decimals: 0 });
      if (v != null) d.reps = Math.max(1, Math.round(v));
      return rerender();
    }
    case 'log': return logSet(sess, cur, +el.dataset.rir, rerender);
    case 'rest-plus': if (sess.rest) { sess.rest.endAt = Math.max(Date.now(), sess.rest.endAt) + 30000; beeped = false; } return save();
    case 'rest-skip': sess.rest = null; return save();
    case 'timed-start': startRest(sess, cur.minutes * 60, getEx(cur.exerciseId).name); return save();
    case 'set+': cur.sets += 1; return save();
    case 'set-': cur.sets = Math.max(1, cur.sets - 1, doneMap(sess).get(cur.uid) || 0); return save();
    case 'item-done': {
      const n = doneMap(sess).get(cur.uid) || 0;
      cur.status = cur.kind === 'timed' || n > 0 ? 'done' : 'skipped';
      if (cur.kind === 'timed' && sess.rest?.label === getEx(cur.exerciseId).name) sess.rest = null;
      advance(sess);
      return save();
    }
    case 'item-skip': cur.status = 'skipped'; advance(sess); return save();
    case 'goto': {
      const it = sess.items.find((i) => i.uid === el.dataset.uid);
      if (!it) return;
      if (it.status !== 'open') it.status = 'open'; // erledigte/gestrichene Übung wieder aufnehmen
      sess.currentUid = it.uid;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return save();
    }
    case 'cut-ignore': sess.cutDismissed = projection(sess, doneMap(sess)).over; return save();
    case 'cut-apply': {
      const cut = JSON.parse(el.dataset.cut);
      sess.items = applyCut(sess.items, cut);
      if (cut.type === 'dropItem' && sess.currentUid === cut.uid) advance(sess);
      toast('Plan gekürzt ✓');
      return save();
    }
    case 'swap': {
      const used = sess.items.map((i) => i.exerciseId);
      const n = doneMap(sess).get(cur.uid) || 0;
      openPicker({
        title: n ? 'Weiter mit anderer Übung' : `${ex.name} tauschen`,
        exclude: used,
        equipment: S.settings.profile.equipment,
        suggestions: alternatives(cur.exerciseId, { exclude: used, equipment: S.settings.profile.equipment }),
        onPick: async (id) => {
          const fresh = makeItem(id, S.settings, { role: cur.role });
          if (fresh.kind === 'strength' && cur.kind === 'strength') Object.assign(fresh, { repsMin: cur.repsMin, repsMax: cur.repsMax, rir: cur.rir });
          if (n) {
            // Bereits Sätze gemacht: aktuelle Übung abschließen, Rest mit der neuen fortsetzen.
            fresh.sets = Math.max(1, cur.sets - n);
            cur.sets = n;
            cur.status = 'done';
            sess.items.splice(sess.items.indexOf(cur) + 1, 0, fresh);
          } else {
            fresh.sets = cur.sets;
            fresh.uid = cur.uid;
            sess.items = sess.items.map((i) => (i.uid === cur.uid ? fresh : i));
          }
          sess.currentUid = fresh.uid;
          draft = null;
          toast(`Getauscht: ${getEx(id).name}`);
          await save();
        },
      });
      return;
    }
    case 'add':
      openPicker({
        title: 'Übung hinzufügen',
        exclude: sess.items.filter((i) => i.status === 'open').map((i) => i.exerciseId),
        equipment: S.settings.profile.equipment,
        onPick: async (id) => {
          const it = makeItem(id, S.settings);
          const pos = cur ? sess.items.indexOf(cur) + 1 : sess.items.length;
          sess.items.splice(pos, 0, it);
          if (!cur) sess.currentUid = it.uid;
          await save();
        },
      });
      return;
    case 'edit-set': return editSet(el.dataset.id, sess, rerender);
    case 'finish': {
      const n = workSetsOf(sess).length;
      if (!n) {
        if (await confirmSheet('Noch keine Sätze', 'Training ohne Sätze verwerfen?', 'Verwerfen', { danger: true })) {
          await store.deleteSession(sess.id);
          leave();
          app.go('#/heute');
        }
        return;
      }
      if (!(await confirmSheet('Training beenden?', `${n} Sätze werden gespeichert.`, 'Beenden'))) return;
      sess.status = 'done';
      sess.endedAt = Date.now();
      sess.rest = null;
      for (const it of sess.items) if (it.status === 'open') it.status = (doneMap(sess).get(it.uid) || 0) > 0 ? 'done' : 'skipped';
      await store.putSession(sess);
      leave();
      draft = null;
      return app.go(`#/heute?fertig=${sess.id}`);
    }
    case 'abort':
      if (await confirmSheet('Training löschen?', 'Alle Sätze dieser Einheit werden gelöscht.', 'Löschen', { danger: true })) {
        await store.deleteSession(sess.id);
        leave();
        app.go('#/heute');
      }
      return;
  }
}

async function logSet(sess, it, rir, rerender) {
  const ex = getEx(it.exerciseId);
  const d = draft;
  const bw = S.settings.profile.bodyweight || 80;
  const all = store.setsOf(sess.id);
  const set = {
    id: uid(), sessionId: sess.id, itemUid: it.uid, exerciseId: it.exerciseId,
    weight: d.weight, reps: d.reps, rir, ts: Date.now(),
    idx: all.filter((x) => x.itemUid === it.uid).length,
    suggested: { weight: d.sugW, reps: d.sugR },
  };
  // Rekord? Nur wenn es frühere Einheiten mit dieser Übung gibt.
  const earlier = S.sets.filter((x) => x.exerciseId === it.exerciseId && !x.warmup);
  const otherSessions = earlier.some((x) => x.sessionId !== sess.id);
  if (otherSessions) {
    const e1 = setE1rm(ex, set, bw);
    const bestE1 = Math.max(0, ...earlier.map((x) => setE1rm(ex, x, bw)));
    const bestW = Math.max(0, ...earlier.map((x) => x.weight));
    const kinds = [];
    if (e1 > bestE1 + 0.01) kinds.push('e1rm');
    if (!ex.bw && set.weight > bestW) kinds.push('gewicht');
    if (kinds.length) set.pr = kinds;
  }
  await store.putSet(set);
  if (set.pr) toast(`🏆 Neuer Rekord: ${ex.name} – ${fmtNum(set.weight)} kg × ${set.reps}`, 'gold');

  const done = all.filter((x) => x.itemUid === it.uid && !x.warmup).length + 1;
  const rest = it.restSec + (rir === 0 ? 30 : 0);
  if (done >= it.sets) {
    it.status = 'done';
    const nextBefore = sess.currentUid;
    advance(sess);
    if (!set.pr) toast(sess.currentUid ? `✓ ${ex.name} erledigt` : '✓ Alle Übungen erledigt');
    if (sess.currentUid && sess.currentUid !== nextBefore) startRest(sess, Math.min(rest, 120), 'Wechsel zur nächsten Übung');
    else if (!sess.currentUid) sess.rest = null;
  } else {
    startRest(sess, rest);
  }
  if (navigator.vibrate && S.settings.training.vibrate) navigator.vibrate(30);
  await store.putSession(sess);
  rerender();
}

function editSet(id, sess, rerender) {
  const x = S.sets.find((s) => s.id === id);
  if (!x) return;
  const ex = getEx(x.exerciseId);
  const st = { weight: x.weight, reps: x.reps, rir: x.rir };
  const body = () => `<h3>Satz bearbeiten</h3>
    <div class="steppers">
      <div class="stepper"><button class="icon-btn" data-act="w-">−</button><button class="v" data-act="w-edit"><b class="num">${fmtNum(st.weight)}</b><span>${unitLabel(ex)}</span></button><button class="icon-btn" data-act="w+">+</button></div>
      <div class="stepper"><button class="icon-btn" data-act="r-">−</button><div class="v"><b class="num">${st.reps}</b><span>Wdh.</span></div><button class="icon-btn" data-act="r+">+</button></div>
    </div>
    <div class="small muted" style="margin:12px 0 6px">RIR</div>
    <div class="chips">${[0, 1, 2, 3, 4].map((r) => `<button class="chip ${r === st.rir ? 'on' : ''}" data-act="rir" data-r="${r}">${rirLabel(r)}</button>`).join('')}</div>
    <div class="btn-row" style="margin-top:16px"><button class="btn danger" data-act="del">Löschen</button><button class="btn primary" data-act="save">Speichern</button></div>`;
  const { root, close } = sheet(body(), async (act, el, close) => {
    const step = ex.step || 2.5;
    if (act === 'w-') st.weight = Math.max(0, roundTo(st.weight - step, step));
    if (act === 'w+') st.weight = roundTo(st.weight + step, step);
    if (act === 'r-') st.reps = Math.max(1, st.reps - 1);
    if (act === 'r+') st.reps += 1;
    if (act === 'rir') st.rir = +el.dataset.r;
    if (act === 'w-edit') {
      close();
      const v = await numberSheet('Gewicht', st.weight, { unit: unitLabel(ex) });
      if (v != null) { x.weight = v; x.reps = st.reps; x.rir = st.rir; await store.putSet(x); }
      draft = null;
      return rerender();
    }
    if (act === 'save') {
      Object.assign(x, st);
      await store.putSet(x);
      draft = null;
      close();
      return rerender();
    }
    if (act === 'del') {
      await store.deleteSet(x.id);
      const it = sess.items.find((i) => i.uid === x.itemUid);
      if (it && it.status === 'done') it.status = 'open';
      await store.putSession(sess);
      draft = null;
      close();
      return rerender();
    }
    root.innerHTML = body();
  });
}
