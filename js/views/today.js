// Bildschirm "Heute": Zeitbudget wählen, Plan erstellen (KI oder lokal), Übungen tauschen, starten.

import * as store from '../store.js';
import { S } from '../store.js';
import { getEx, alternatives, MUSCLES } from '../data/exercises.js';
import { makePlan } from '../ai/plan.js';
import { makeItem } from '../logic/planner.js';
import { itemSec, sessionSec } from '../logic/timing.js';
import { muscleStatus } from '../logic/history.js';
import { ENERGY, SLEEP, SLEEP_H, STRESS, LAST_MEAL, ATE, LOADS, REGIONS, WISHES, DEFAULT_CHECKIN, checkinText, readiness, LEVEL_TEXT } from '../data/goals.js';
import { planDay, fmtL } from '../logic/daycoach.js';
import { parseHealth, sleepChip, healthText } from '../logic/health.js';
import { openPicker } from './picker.js';
import { toast, confirmSheet, sheet, ICONS } from '../ui.js';
import { esc, uid, fmtDate, fmtMin, fmtNum, relDays, clamp } from '../util.js';

let budget = null;
let loading = false;
let checkin = JSON.parse(JSON.stringify(DEFAULT_CHECKIN));
let showBody = false;
let showMore = false;
let dayOpen = true;

const plannedSession = () => [...S.sessions].reverse().find((s) => s.status === 'planned');

function itemMeta(it) {
  if (it.kind === 'timed') return `${it.minutes} Min${it.text ? ' · ' + esc(it.text) : ''}`;
  return `${it.sets} × ${it.repsMin}–${it.repsMax} Wdh. · RIR ${it.rir} · ≈ ${fmtMin(itemSec(it))}`;
}

function roleBadge(it) {
  if (it.role === 'warmup') return '<span class="badge info">Aufwärmen</span> ';
  if (it.role === 'finisher') return '<span class="badge warn">Kondition</span> ';
  return '';
}

const LEVEL_COLOR = { voll: 'var(--accent)', normal: 'var(--text)', reduziert: 'var(--warn)', regeneration: 'var(--info, #6cb4ff)' };

function levelHtml(p) {
  const r = readiness(p.checkin, S.settings.profile);
  const [title] = LEVEL_TEXT[r.level];
  const suggestRegen = r.level === 'regeneration' && p.title !== 'Regeneration';
  return `<div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--surface-2)">
      <div class="row between"><b style="color:${LEVEL_COLOR[r.level]}">${title}</b><span class="tiny faint">Tagesform</span></div>
      ${r.reasons.length ? `<div class="tiny muted" style="margin-top:2px">${esc(r.reasons.join(' · '))}</div>` : ''}
      ${suggestRegen ? '<button class="btn sm block" data-act="to-regen" style="margin-top:8px">Stattdessen Regenerationstag</button>' : ''}
    </div>`;
}

// ---------- Dein Tag: Morgen bis Abend ----------

function dayHtml(sess) {
  const day = planDay({ settings: S.settings, checkin: sess?.checkin ?? checkin, session: sess, ai: sess?.dayAi });
  const t = day.targets;
  const head = `<button class="row between" data-act="day-toggle" style="width:100%;background:none;border:0;color:inherit;padding:0;text-align:left">
      <h2 style="margin:0">Dein Tag</h2><span class="small muted">${dayOpen ? 'Einklappen ▴' : 'Anzeigen ▾'}</span></button>`;
  if (!dayOpen) return `<div style="margin:22px 0 10px">${head}</div>`;
  const kp = (v, l) => `<div class="kpi"><b class="num">${v}</b><span>${l}</span></div>`;
  return `<div style="margin:22px 0 10px">${head}</div>
  <div class="card">
    <div class="small muted" style="margin-bottom:8px">Tagesziel${sess?.dayAi ? ' · Texte von der KI' : ''}</div>
    <div class="kpis four" style="margin:0">
      ${kp(t.kcal ? fmtNum(t.kcal) : '–', 'kcal')}${kp(`${t.protein} g`, 'Protein')}${kp(t.carbs ? `${t.carbs} g` : t.carbsRange.replace(' g', ''), 'Kohlenh.')}${kp(`${fmtL(t.waterL)} l`, 'Wasser')}
    </div>
    ${t.notes.length ? `<div class="tiny muted" style="margin-top:10px">${t.notes.map(esc).join('<br>')}</div>` : ''}
  </div>
  ${day.blocks.map((b) => `<div class="card day-block">
    <div class="row between" style="align-items:baseline"><b>${b.icon} ${esc(b.title)}</b><span class="small num muted">${b.time}</span></div>
    <ul class="small" style="margin:8px 0 0;padding-left:18px">${b.items.map((x) => `<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ul>
  </div>`).join('')}
  <p class="tiny faint" style="text-align:center;margin:4px 0 0">Allgemeine Empfehlungen, keine medizinische oder Ernährungsberatung. Angaben unter <a href="#/einstellungen">Einstellungen → Profil</a>.</p>`;
}

function planHtml(p) {
  const total = sessionSec(p.items);
  const over = total > p.budgetMin * 60 + 60;
  return `
  <div class="card accent">
    <div class="row between" style="align-items:flex-start">
      <div class="grow"><h2 style="margin:0 0 4px">${esc(p.title)}</h2>
        <div class="small muted">${fmtDate(p.date)} · Budget ${p.budgetMin} Min</div></div>
      <span class="badge ${p.source === 'ai' ? 'accent' : ''}">${p.source === 'ai' ? 'KI-Plan' : p.source === 'manual' ? 'Frei' : 'Lokaler Plan'}</span>
    </div>
    ${p.fallback ? `<div class="pill-note" style="margin-top:10px;color:var(--warn)">⚠︎ ${esc(p.fallback)}</div>` : ''}
    ${p.rationale ? `<p class="small" style="margin:10px 0 0">${esc(p.rationale)}</p>` : ''}
    ${p.checkin ? levelHtml(p) : ''}
    <div class="row between" style="margin-top:12px">
      <span class="small muted">Geschätzte Dauer</span>
      <b class="num" style="color:${over ? 'var(--warn)' : 'var(--accent)'}">≈ ${fmtMin(total)} / ${p.budgetMin} Min</b>
    </div>
  </div>
  <div class="card">
    ${p.items.map((it, i) => {
      const ex = getEx(it.exerciseId);
      return `<div class="plan-item">
        <div class="idx">${i + 1}</div>
        <div class="grow">
          <div class="name">${roleBadge(it)}${esc(ex.name)}</div>
          <div class="meta">${itemMeta(it)}</div>
          ${it.note ? `<div class="tiny faint" style="margin-top:2px">${esc(it.note)}</div>` : ''}
        </div>
        <button class="icon-btn" data-act="swap" data-uid="${it.uid}" aria-label="Übung tauschen">${ICONS.swap}</button>
        <button class="icon-btn" data-act="remove" data-uid="${it.uid}" aria-label="Übung entfernen">${ICONS.x}</button>
      </div>`;
    }).join('') || '<div class="empty">Keine Übungen – füge welche hinzu.</div>'}
    <button class="btn ghost block sm" data-act="add" style="margin-top:8px">+ Übung hinzufügen</button>
  </div>
  <button class="btn primary big block" data-act="start">Training starten</button>
  <div class="btn-row" style="margin-top:10px">
    <button class="btn sm" data-act="replan">Neu planen</button>
    <button class="btn sm danger" data-act="discard">Verwerfen</button>
  </div>`;
}

// ---------- Check-in: Wie geht's dir heute? ----------

function healthHtml() {
  const h = checkin.health;
  return h
    ? `<div class="pill-note" style="margin-top:10px">❤️ Aus Apple Health: ${esc(healthText(h))} <button class="btn ghost sm" data-act="health" style="padding:2px 8px;min-height:0">neu laden</button></div>`
    : '<button class="btn sm block" data-act="health" style="margin-top:10px">❤️ Werte aus Apple Health holen</button>';
}

/** Health-Werte in den Check-in übernehmen (Gewicht ins Profil). */
async function applyHealth(h) {
  checkin.health = { ...h, at: Date.now() };
  if (h.hr) checkin.hr = h.hr;
  if (h.hrv) checkin.hrv = h.hrv;
  if (h.sleepH) checkin.sleepH = sleepChip(h.sleepH);
  if (h.steps >= 12000 && !checkin.loads.includes('unterwegs')) checkin.loads = [...checkin.loads, 'unterwegs'];
  showMore = true;
  let msg = 'Health-Werte übernommen ✓';
  if (h.weight && Math.abs(h.weight - S.settings.profile.bodyweight) >= 0.1) {
    const st = JSON.parse(JSON.stringify(S.settings));
    st.profile.bodyweight = h.weight;
    await store.saveSettings(st);
    msg += ` · Gewicht auf ${fmtNum(h.weight)} kg aktualisiert`;
  }
  toast(msg);
}

/** Erst Zwischenablage versuchen, sonst Text zum Einfügen anbieten. */
async function importHealth(rerender) {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch { /* nicht erlaubt → manuell */ }
  const h = parseHealth(text);
  if (h) { await applyHealth(h); return rerender(); }
  const { root, close } = sheet(`<h3>Werte aus Apple Health</h3>
    <p class="small muted" style="margin-top:0">Starte zuerst deinen Kurzbefehl <b>„KraftCoach Health“</b> – er kopiert die Werte. Dann hier einfügen (lange tippen → Einsetzen).</p>
    <textarea data-health-text rows="6" placeholder="ruhepuls: 58&#10;hrv: 62&#10;schlaf: 7,2&#10;gewicht: 80,4&#10;schritte: 8500"></textarea>
    <p class="tiny faint">Noch keinen Kurzbefehl? Anleitung unter Einstellungen → Apple Health.</p>
    <div class="btn-row" style="margin-top:12px"><button class="btn" data-act="no">Abbrechen</button><button class="btn primary" data-act="ok">Übernehmen</button></div>`,
  async (act, _el, closeIt) => {
    if (act === 'no') return closeIt();
    const parsed = parseHealth(root.querySelector('[data-health-text]').value);
    if (!parsed) return toast('Keine Werte erkannt. Format z. B. „ruhepuls: 58“.', 'err');
    closeIt();
    await applyHealth(parsed);
    rerender();
  });
  return close;
}

function chipRow(label, options, value, act) {
  return `<div class="small muted" style="margin:12px 0 6px">${label}</div>
    <div class="chips">${options.map(([k, l, icon]) => `<button class="chip ${value === k ? 'on' : ''}" data-act="${act}" data-v="${k}">${icon ? icon + ' ' : ''}${l}</button>`).join('')}</div>`;
}

function regionRow(label, list, act, danger = false) {
  return `<div class="small muted" style="margin:12px 0 6px">${label}</div>
    <div class="chips">${Object.entries(REGIONS).map(([k, r]) => {
      const on = list.includes(k);
      return `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${k}" style="${on && danger ? 'background:var(--danger);color:#fff' : ''}">${r.label}</button>`;
    }).join('')}</div>`;
}

function checkinHtml() {
  const c = checkin;
  const body = showBody || c.sore.length || c.pain.length;
  return `<div class="card">
    <div class="row between"><b>Wie geht's dir heute?</b><span class="tiny faint">optional</span></div>
    ${healthHtml()}
    ${chipRow('Energie', ENERGY, c.energy, 'ci-energy')}
    ${chipRow('Schlaf letzte Nacht', SLEEP, c.sleep, 'ci-sleep')}
    ${body
      ? regionRow('Muskelkater', c.sore, 'ci-sore') + regionRow('Schmerzen – wird heute gemieden', c.pain, 'ci-pain', true)
      : '<button class="btn ghost sm block" data-act="ci-body" style="margin-top:12px">+ Muskelkater oder Schmerzen angeben</button>'}
    ${chipRow('Wunsch für heute', WISHES, c.wish, 'ci-wish')}
    ${showMore ? moreHtml() : '<button class="btn ghost sm block" data-act="ci-more" style="margin-top:12px">+ Mehr Angaben (Schlafdauer, Stress, Puls, Essen, Uhrzeit)</button>'}
    ${readyLine()}
  </div>`;
}

function readyLine() {
  const r = readiness(checkin, S.settings.profile);
  return `<div class="small" style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line)">Einschätzung: <b style="color:${LEVEL_COLOR[r.level]}">${LEVEL_TEXT[r.level][0]}</b>${r.reasons.length ? `<span class="muted"> – ${esc(r.reasons.join(', '))}</span>` : ''}</div>`;
}

function setChips(label, options, key, { multi = false, numeric = false } = {}) {
  const v = checkin[key];
  return `<div class="small muted" style="margin:12px 0 6px">${label}</div>
    <div class="chips">${options.map(([k, l]) => {
      const on = multi ? (v ?? []).includes(k) : v === k;
      return `<button class="chip ${on ? 'on' : ''}" data-act="ci-set" data-k="${key}" data-v="${k}" ${multi ? 'data-multi="1"' : ''} ${numeric ? 'data-num="1"' : ''}>${l}</button>`;
    }).join('')}</div>`;
}

function moreHtml() {
  const c = checkin;
  const def = S.settings.profile.day?.trainTime ?? '';
  const box = (k, label, ph, mode = 'numeric') => `<label class="field grow"><span>${label}</span><input type="text" inputmode="${mode}" data-ci-in="${k}" value="${esc(c[k] ?? '')}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
  return `${setChips('Wie lange geschlafen?', SLEEP_H, 'sleepH', { numeric: true })}
    ${setChips('Stresslevel', STRESS, 'stress')}
    <div class="row" style="margin-top:12px;align-items:flex-end">${box('hr', 'Ruhepuls heute', S.settings.profile.body?.restingHr ? `normal ${S.settings.profile.body.restingHr}` : 'z. B. 60')}${box('hrv', 'HRV (ms)', 'optional')}${box('trainTime', 'Training um', def || '17:30', 'text')}</div>
    ${setChips('Letzte Mahlzeit vor', LAST_MEAL, 'lastMeal')}
    ${setChips('Heute bisher gegessen', ATE, 'ate')}
    ${setChips('Heutige Belastung', LOADS, 'loads', { multi: true })}`;
}

/** Textfelder des Check-ins übernehmen (vor jedem Neuzeichnen). */
function readInputs(root) {
  for (const el of root.querySelectorAll('[data-ci-in]')) {
    const k = el.dataset.ciIn;
    const raw = el.value.trim();
    if (k === 'trainTime') {
      const m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(raw);
      checkin.trainTime = m && +m[1] < 24 && +(m[2] ?? 0) < 60 ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : '';
    } else {
      const n = parseInt(raw, 10);
      checkin[k] = n > 0 && n < 300 ? n : null;
    }
  }
}

function chooserHtml() {
  const hasKey = !!S.settings.ai.apiKey && S.settings.ai.enabled;
  return `
  <div class="card">
    <div class="small muted" style="text-align:center">Wie viel Zeit hast du heute?</div>
    <div class="budget">
      <button class="icon-btn" data-act="minus" aria-label="5 Minuten weniger">−</button>
      <div class="val num">${budget}<small>Min</small></div>
      <button class="icon-btn" data-act="plus" aria-label="5 Minuten mehr">+</button>
    </div>
    <div class="chips" style="justify-content:center">${[30, 45, 50, 60, 75].map((m) => `<button class="chip ${m === budget ? 'on' : ''}" data-act="set" data-m="${m}">${m}</button>`).join('')}</div>
  </div>
  ${checkinHtml()}
  <button class="btn primary big block" data-act="plan" ${loading ? 'disabled' : ''}>
    ${loading ? '<span class="spinner"></span> Plan wird erstellt …' : hasKey ? 'Plan erstellen (KI)' : 'Plan erstellen'}
  </button>
  ${!hasKey ? '<p class="tiny muted" style="text-align:center;margin:8px 0 0">Ohne API-Schlüssel plant die App lokal. Schlüssel in den <a href="#/einstellungen">Einstellungen</a> hinterlegen.</p>' : ''}
  <div class="btn-row" style="margin-top:10px">
    ${hasKey ? '<button class="btn sm" data-act="plan-local">Ohne KI planen</button>' : ''}
    <button class="btn sm" data-act="free">Freies Training</button>
  </div>`;
}

function recoveryHtml() {
  const st = muscleStatus(S.sets);
  const entries = Object.entries(st).filter(([, o]) => o.last);
  if (!entries.length) return '';
  entries.sort((a, b) => a[1].readiness - b[1].readiness);
  return `<h2>Erholung</h2><div class="card tight"><div class="chips">${entries
    .map(([m, o]) => {
      const pct = Math.round(o.readiness * 100);
      const cls = pct >= 90 ? 'accent' : pct >= 60 ? '' : 'warn';
      return `<span class="badge ${cls}" style="font-size:13px;padding:6px 10px">${MUSCLES[m]} ${pct} %</span>`;
    })
    .join('')}</div></div>`;
}

function recentHtml() {
  const done = store.doneSessions().slice(-3).reverse();
  if (!done.length) return '';
  return `<h2>Zuletzt</h2><div class="card tight">${done
    .map((s) => {
      const n = store.setsOf(s.id).filter((x) => !x.warmup).length;
      const dur = s.endedAt && s.startedAt ? fmtMin((s.endedAt - s.startedAt) / 1000) : '–';
      return `<div class="plan-item"><div class="grow"><div class="name">${esc(s.title || 'Training')}</div>
        <div class="meta">${fmtDate(s.startedAt ?? s.date)} · ${relDays(s.startedAt ?? s.date)} · ${dur} · ${n} Sätze</div></div></div>`;
    })
    .join('')}</div>`;
}

function summaryHtml(id) {
  const s = store.sessionById(id);
  if (!s || s.status !== 'done') return '';
  const sets = store.setsOf(s.id).filter((x) => !x.warmup);
  const vol = sets.reduce((a, x) => a + x.weight * x.reps * (getEx(x.exerciseId).perHand ? 2 : 1), 0);
  const prs = sets.filter((x) => x.pr?.length).length;
  return `<div class="card accent"><h2 style="margin:0 0 8px">Geschafft! 💪</h2>
    <div class="kpis" style="margin:0">
      <div class="kpi"><b class="num">${fmtMin((s.endedAt - s.startedAt) / 1000).replace(' Min', '')}</b><span>Minuten</span></div>
      <div class="kpi"><b class="num">${sets.length}</b><span>Sätze</span></div>
      <div class="kpi"><b class="num">${fmtNum(vol / 1000, 1)}</b><span>Tonnen bewegt</span></div>
    </div>
    ${prs ? `<p style="margin:10px 0 0;color:var(--gold);font-weight:700">🏆 ${prs} neue${prs === 1 ? 'r' : ''} Rekord${prs === 1 ? '' : 'e'}</p>` : ''}
  </div>`;
}

export function render(root, route, app) {
  budget ??= S.settings.training.defaultMin || 50;
  const active = store.activeSession();
  const planned = plannedSession();
  const doneId = route.query.get('fertig');

  let body = '';
  if (doneId) body += summaryHtml(doneId);
  if (active) {
    const min = Math.round((Date.now() - active.startedAt) / 60000);
    body += `<div class="card accent"><h3>Training läuft</h3><p class="small muted" style="margin:0 0 12px">${esc(active.title || 'Training')} · seit ${min} Min</p>
      <a class="btn primary block" href="#/training">Weiter trainieren</a></div>`;
  } else if (planned) body += planHtml(planned);
  else body += chooserHtml();
  const todaySess = active ?? planned ?? (doneId ? store.sessionById(doneId) : null);
  if (todaySess) body += dayHtml(todaySess);
  body += recoveryHtml() + recentHtml();

  root.innerHTML = `<div class="page-head"><div><h1>Heute</h1><div class="sub">${fmtDate(Date.now())}</div></div></div>${body}`;

  root.onclick = async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const p = plannedSession();
    readInputs(root);
    if (act === 'day-toggle') { dayOpen = !dayOpen; return render(root, route, app); }
    if (act === 'ci-more') { showMore = true; return render(root, route, app); }
    if (act === 'health') return importHealth(() => render(root, route, app));
    if (act === 'ci-set') {
      const { k, v } = el.dataset;
      const val = el.dataset.num ? +v : v;
      if (el.dataset.multi) checkin[k] = checkin[k].includes(val) ? checkin[k].filter((x) => x !== val) : [...checkin[k], val];
      else checkin[k] = checkin[k] === val ? (el.dataset.num ? null : '') : val;
      return render(root, route, app);
    }
    if (act === 'minus' || act === 'plus') { budget = clamp(budget + (act === 'plus' ? 5 : -5), 15, 120); return render(root, route, app); }
    if (act === 'set') { budget = +el.dataset.m; return render(root, route, app); }
    if (act === 'ci-energy') { checkin.energy = el.dataset.v; return render(root, route, app); }
    if (act === 'ci-sleep') { checkin.sleep = el.dataset.v; return render(root, route, app); }
    if (act === 'ci-wish') { checkin.wish = el.dataset.v; return render(root, route, app); }
    if (act === 'ci-body') { showBody = true; return render(root, route, app); }
    if (act === 'ci-sore' || act === 'ci-pain') {
      const key = act === 'ci-sore' ? 'sore' : 'pain';
      const v = el.dataset.v;
      checkin[key] = checkin[key].includes(v) ? checkin[key].filter((x) => x !== v) : [...checkin[key], v];
      return render(root, route, app);
    }
    if (act === 'plan' || act === 'plan-local') return createPlan(act === 'plan', root, route, app);
    if (act === 'free') {
      const s = { id: uid(), date: new Date().toISOString(), status: 'active', budgetMin: budget, title: 'Freies Training', source: 'manual', items: [], startedAt: Date.now() };
      await store.putSession(s);
      return app.go('#/training');
    }
    if (!p) return;
    if (act === 'start') {
      if (!p.items.length) return toast('Füge zuerst eine Übung hinzu.');
      p.status = 'active';
      p.startedAt = Date.now();
      p.date = new Date().toISOString();
      p.currentUid = p.items[0].uid;
      await store.putSession(p);
      return app.go('#/training');
    }
    if (act === 'discard') {
      if (await confirmSheet('Plan verwerfen?', 'Du kannst danach einen neuen Plan erstellen.', 'Verwerfen', { danger: true })) {
        await store.deleteSession(p.id);
        render(root, route, app);
      }
      return;
    }
    if (act === 'to-regen') {
      checkin = { ...JSON.parse(JSON.stringify(p.checkin ?? checkin)), wish: 'regen' };
      budget = p.budgetMin;
      await store.deleteSession(p.id);
      return createPlan(false, root, route, app);
    }
    if (act === 'replan') {
      budget = p.budgetMin;
      await store.deleteSession(p.id);
      return createPlan(true, root, route, app);
    }
    if (act === 'remove') {
      p.items = p.items.filter((i) => i.uid !== el.dataset.uid);
      await store.putSession(p);
      return render(root, route, app);
    }
    if (act === 'swap') {
      const it = p.items.find((i) => i.uid === el.dataset.uid);
      const used = p.items.map((i) => i.exerciseId);
      openPicker({
        title: `${getEx(it.exerciseId).name} tauschen`,
        exclude: used,
        equipment: S.settings.profile.equipment,
        suggestions: alternatives(it.exerciseId, { exclude: used, equipment: S.settings.profile.equipment }),
        onPick: async (id) => {
          const fresh = makeItem(id, S.settings, { role: it.role });
          // Vorgaben (Sätze/Wdh./RIR) möglichst übernehmen
          Object.assign(fresh, it.kind === fresh.kind && fresh.kind === 'strength' ? { sets: it.sets, repsMin: it.repsMin, repsMax: it.repsMax, rir: it.rir } : {}, { uid: it.uid, note: '' });
          p.items = p.items.map((i) => (i.uid === it.uid ? fresh : i));
          await store.putSession(p);
          toast(`Getauscht: ${getEx(id).name}`);
          render(root, route, app);
        },
      });
      return;
    }
    if (act === 'add') {
      openPicker({
        title: 'Übung hinzufügen',
        exclude: p.items.map((i) => i.exerciseId),
        equipment: S.settings.profile.equipment,
        onPick: async (id) => {
          const it = makeItem(id, S.settings);
          const finIdx = p.items.findIndex((i) => i.role === 'finisher');
          if (finIdx >= 0 && it.role !== 'finisher') p.items.splice(finIdx, 0, it);
          else p.items.push(it);
          await store.putSession(p);
          render(root, route, app);
        },
      });
    }
  };
}

async function createPlan(useAi, root, route, app) {
  if (loading) return;
  loading = true;
  render(root, route, app);
  try {
    const ci = JSON.parse(JSON.stringify(checkin));
    const plan = await makePlan({ settings: S.settings, sessions: S.sessions, sets: S.sets, budgetMin: budget, useAi, checkin: ci });
    const s = {
      id: uid(), date: new Date().toISOString(), status: 'planned', budgetMin: budget,
      title: plan.title, rationale: plan.rationale, source: plan.source, items: plan.items, checkin: ci, dayAi: plan.dayAi ?? null,
      fallback: plan.fallbackReason ? `KI nicht verfügbar: ${plan.fallbackReason.message} Lokaler Plan erstellt.` : '',
    };
    await store.putSession(s);
    if (plan.fallbackReason) toast(plan.fallbackReason.message, 'err');
  } catch (e) {
    toast('Plan konnte nicht erstellt werden: ' + (e?.message ?? e), 'err');
  } finally {
    loading = false;
    // Nur neu zeichnen, wenn man noch auf "Heute" ist.
    if (!location.hash || location.hash.startsWith('#/heute')) render(root, route, app);
  }
}
