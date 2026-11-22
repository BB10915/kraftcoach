// Einrichtung beim ersten Start (und Profil-Bearbeitung aus den Einstellungen):
// Ziele, Körper, Training, aktuelle Werte, Ernährung, Tagesablauf, KI-Schlüssel.

import * as store from '../store.js';
import { S } from '../store.js';
import { getEx, EQUIPMENT, MUSCLES } from '../data/exercises.js';
import { GOALS, BASELINE_EXERCISES, goalsText } from '../data/goals.js';
import { SEX, FITNESS, DIETS, SUPPS, OCCUPATION, ACTIVITY, PLACE, PARTNER, INTENSITY } from '../data/profile.js';
import { openPicker } from './picker.js';
import { toast } from '../ui.js';
import { esc, fmtNum, parseNum, clamp } from '../util.js';

export const STEPS = ['Willkommen', 'Ziele', 'Körper', 'Training', 'Deine Werte', 'Ernährung', 'Tagesablauf', 'KI-Coach', 'Fertig'];
export const STEP = { ziele: 1, koerper: 2, training: 3, werte: 4, ernaehrung: 5, tag: 6, ki: 7 };
let step = 0;
let single = false; // aus den Einstellungen: nur diesen einen Schritt bearbeiten
let draft = null; // Arbeitskopie der Einstellungen
let extraIds = []; // zusätzlich gewählte Übungen für Startwerte

function ensureDraft() {
  if (draft) return;
  draft = JSON.parse(JSON.stringify(S.settings));
  draft.profile.goals ??= [];
  draft.profile.baselines ??= {};
  extraIds = Object.keys(draft.profile.baselines).filter((id) => !BASELINE_EXERCISES.includes(id));
}

// ---------- Pfad-Helfer (z. B. "profile.body.age") ----------
const getP = (path) => path.split('.').reduce((o, k) => o?.[k], draft);
function setP(path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const o = ks.reduce((a, k) => (a[k] ??= {}), draft);
  o[last] = v;
}

// ---------- Bausteine ----------
const H = (t, sub = '') => `<h1 style="font-size:24px;margin:0 0 4px">${t}</h1>${sub ? `<p class="muted small" style="margin:0 0 14px">${sub}</p>` : '<div style="height:10px"></div>'}`;
const sec = (t) => `<div class="small muted" style="margin:14px 0 6px">${t}</div>`;

/** Eingabefeld. type: num | text | time | area */
function inp(path, label, { type = 'text', ph = '', min, max, wide = false } = {}) {
  const v = getP(path);
  const val = v == null ? '' : type === 'num' ? fmtNum(v) : v;
  const attrs = `data-f="${path}" data-t="${type}" data-l="${esc(label.replace(/ \*$/, ''))}" ${min != null ? `data-min="${min}"` : ''} ${max != null ? `data-max="${max}"` : ''} placeholder="${esc(ph)}"`;
  const field = type === 'area'
    ? `<textarea rows="2" ${attrs}>${esc(val)}</textarea>`
    : `<input type="text" ${type === 'num' ? 'inputmode="decimal"' : type === 'time' ? 'inputmode="numeric"' : ''} ${attrs} value="${esc(val)}" autocomplete="off">`;
  return `<label class="field ${wide ? '' : 'grow'}"><span>${label}</span>${field}</label>`;
}
const row = (...fields) => `<div class="row" style="align-items:flex-end">${fields.join('')}</div>`;

/** Auswahl-Chips (einzeln oder mehrfach). */
function chips(path, options, { multi = false, numeric = false } = {}) {
  const v = getP(path);
  return `<div class="chips">${options.map(([k, l]) => {
    const on = multi ? (v ?? []).includes(k) : v === k;
    return `<button class="chip ${on ? 'on' : ''}" data-act="pick" data-f="${path}" data-v="${k}" ${multi ? 'data-multi="1"' : ''} ${numeric ? 'data-num="1"' : ''}>${esc(l)}</button>`;
  }).join('')}</div>`;
}

const dots = () => single ? '' : `<div class="row" style="gap:6px;justify-content:center;margin:4px 0 18px">${STEPS.map((_, i) =>
  `<span style="width:${i === step ? 22 : 8}px;height:8px;border-radius:99px;background:${i <= step ? 'var(--accent)' : 'var(--surface-3)'}"></span>`).join('')}</div>`;

const nav = (nextLabel = 'Weiter', { skip = false } = {}) => single
  ? `<div class="btn-row" style="margin-top:18px"><button class="btn" data-act="cancel">Abbrechen</button><button class="btn primary" data-act="next">Speichern</button></div>`
  : `<div class="btn-row" style="margin-top:18px">
    ${step > 0 ? '<button class="btn" data-act="back">Zurück</button>' : ''}
    <button class="btn primary" data-act="next">${nextLabel}</button>
  </div>
  ${skip ? '<button class="btn ghost block sm" data-act="skip" style="margin-top:8px">Überspringen</button>' : ''}`;

function stepHtml() {
  const p = draft.profile;
  switch (step) {
    case 0:
      return `<div class="card accent" style="text-align:center;padding:28px 18px">
        <div style="font-size:48px">🏋️</div>
        <h1 style="margin:8px 0 6px;font-size:26px">Willkommen bei KraftCoach</h1>
        <p class="muted">Ein paar Fragen zu Zielen, Körper, Training, Ernährung und Tagesablauf – damit dein Coach jeden Tag passend plant. Dauert etwa 4 Minuten, vieles ist optional.</p>
        <p class="tiny faint">Alles bleibt nur auf diesem Gerät gespeichert.</p>
      </div>${nav("Los geht's")}`;

    case 1:
      return `${H('Was willst du erreichen?', 'Mehrere Antworten möglich.')}
        <div class="card tight">${GOALS.map(([k, l, d]) => `
          <button class="list-btn" data-act="goal" data-k="${k}">
            <span style="width:26px;height:26px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;font-weight:800;${p.goals.includes(k) ? 'background:var(--accent);color:var(--accent-ink)' : 'border:2px solid var(--line)'}">${p.goals.includes(k) ? '✓' : ''}</span>
            <div class="grow"><div style="font-weight:600">${l}</div><div class="tiny muted">${d}</div></div>
          </button>`).join('')}</div>
        ${sec('Welche Muskelgruppen sind dir besonders wichtig? (optional)')}
        ${chips('profile.aims.priority', Object.entries(MUSCLES), { multi: true })}
        <div style="height:12px"></div>
        ${inp('profile.aims.perf', 'Konkrete Leistungsziele (optional)', { type: 'area', ph: 'z. B. 100 kg Bankdrücken, 10 saubere Klimmzüge', wide: true })}
        ${inp('profile.aims.short', 'Kurzfristig – nächste 4–8 Wochen (optional)', { type: 'area', ph: 'z. B. wieder regelmäßig 3× pro Woche', wide: true })}
        ${inp('profile.aims.long', 'Langfristig – in einem Jahr (optional)', { type: 'area', ph: 'z. B. 8 kg Muskeln mehr, athletischer aussehen', wide: true })}
        ${inp('profile.goal', 'Sonst noch etwas in eigenen Worten (optional)', { type: 'area', ph: 'z. B. fit für den Skiurlaub', wide: true })}
        ${nav()}`;

    case 2:
      return `${H('Dein Körper', 'Für Kalorienbedarf, Gewichte und Erholung. Nur das Körpergewicht ist Pflicht.')}
        <div class="card">
          ${row(inp('profile.body.age', 'Alter', { type: 'num', ph: 'Jahre', min: 12, max: 99 }), inp('profile.body.heightCm', 'Größe (cm)', { type: 'num', ph: 'z. B. 180', min: 120, max: 230 }))}
          ${sec('Geschlecht')}${chips('profile.body.sex', SEX)}
          <div style="height:12px"></div>
          ${row(inp('profile.bodyweight', 'Gewicht (kg) *', { type: 'num', min: 30, max: 250 }), inp('profile.body.bodyfat', 'Körperfett (%)', { type: 'num', ph: 'falls bekannt', min: 3, max: 60 }))}
          ${row(inp('profile.body.muscleKg', 'Muskelmasse (kg)', { type: 'num', ph: 'falls bekannt', min: 10, max: 120 }), '<div class="grow"></div>')}
          ${sec('Aktuelle Fitness')}${chips('profile.body.fitness', FITNESS)}
          <div style="height:12px"></div>
          ${row(inp('profile.body.restingHr', 'Ruhepuls normal', { type: 'num', ph: 'z. B. 60', min: 30, max: 120 }), inp('profile.body.hrv', 'HRV normal (ms)', { type: 'num', ph: 'falls Uhr', min: 5, max: 250 }))}
          <p class="tiny faint" style="margin:-4px 0 10px">Ruhepuls/HRV als Vergleich: Ist der Wert im Check-in deutlich anders, plant die App vorsichtiger.</p>
          ${inp('profile.notes', 'Verletzungen, Beschwerden, Einschränkungen', { type: 'area', ph: 'z. B. Knie empfindlich, kein schweres Kreuzheben', wide: true })}
        </div>${nav()}`;

    case 3: {
      const exp = [['anfaenger', 'Anfänger'], ['wiedereinsteiger', 'Wiedereinsteiger'], ['fortgeschritten', 'Fortgeschritten']];
      return `${H('Dein Training', 'Historie und Bedingungen.')}
        <div class="card">
          ${sec('Erfahrung')}${chips('profile.experience', exp)}
          <div style="height:12px"></div>
          ${row(inp('profile.hist.years', 'Trainiere seit (Jahren)', { type: 'num', ph: 'z. B. 3', min: 0, max: 60 }), '<div class="grow"></div>')}
          ${sec('Trainings pro Woche')}${chips('profile.daysPerWeek', ['2', '3', '3–4', '4', '5+'].map((v) => [v, v]))}
          ${sec('Typische Trainingsdauer')}${chips('training.defaultMin', [30, 45, 50, 60, 75, 90].map((v) => [v, `${v} Min`]), { numeric: true })}
          <div style="height:12px"></div>
          ${inp('profile.hist.split', 'Aktueller Split / Plan (optional)', { ph: 'z. B. Ganzkörper, Push/Pull/Beine', wide: true })}
          ${inp('profile.hist.sports', 'Weitere Sportarten (optional)', { ph: 'z. B. Fußball Di + Do, BJJ am Wochenende', wide: true })}
        </div>
        <div class="card">
          ${sec('Wo trainierst du?')}${chips('profile.cond.place', PLACE)}
          ${sec('Allein oder mit Partner?')}${chips('profile.cond.partner', PARTNER)}
          ${sec('Gewünschte Intensität')}${chips('profile.cond.intensity', INTENSITY)}
          ${sec('Verfügbares Equipment')}${chips('profile.equipment', Object.entries(EQUIPMENT), { multi: true })}
          <div style="height:12px"></div>
          ${inp('profile.cond.gear', 'Besondere Geräte / Gewichtsgrenzen (optional)', { ph: 'z. B. Kurzhanteln nur bis 30 kg', wide: true })}
        </div>${nav()}`;
    }

    case 4: {
      const ids = [...BASELINE_EXERCISES, ...extraIds];
      return `${H('Deine aktuellen Werte', 'Welches Gewicht schaffst du aktuell <b>sauber</b> für wie viele Wiederholungen? Grob reicht. Übungen, die du nicht machst, einfach leer lassen – die findet die App dann selbst heraus.')}
        <div class="card tight">${ids.map((id) => {
          const ex = getEx(id);
          const b = p.baselines[id] ?? {};
          const unit = ex.bw ? 'kg extra' : ex.perHand ? 'kg/Hand' : 'kg';
          return `<div class="plan-item" style="gap:8px">
            <div class="grow" style="min-width:0"><div class="name" style="font-size:15px">${esc(ex.name)}</div>
              ${ex.bw ? '<div class="tiny faint">0 = nur Körpergewicht</div>' : ''}</div>
            <input type="text" inputmode="decimal" placeholder="${unit}" data-bl-w="${id}" value="${b.weight != null ? esc(fmtNum(b.weight)) : ''}" style="width:78px;text-align:center;padding:10px 6px" aria-label="${esc(ex.name)} Gewicht">
            <span class="muted">×</span>
            <input type="text" inputmode="numeric" placeholder="Wdh" data-bl-r="${id}" value="${b.reps ?? ''}" style="width:60px;text-align:center;padding:10px 6px" aria-label="${esc(ex.name)} Wiederholungen">
          </div>`;
        }).join('')}
          <button class="btn ghost block sm" data-act="add-ex" style="margin-top:6px">+ weitere Übung</button></div>
        ${nav('Weiter', { skip: true })}`;
    }

    case 5:
      return `${H('Ernährung', 'Optional – je genauer, desto besser passt dein Tagesplan. Grobe Schätzungen reichen.')}
        <div class="card">
          ${row(inp('profile.nutrition.kcal', 'Kalorien pro Tag', { type: 'num', ph: 'z. B. 2500', min: 800, max: 7000 }), inp('profile.nutrition.waterL', 'Wasser (l/Tag)', { type: 'num', ph: 'z. B. 2', min: 0, max: 10 }))}
          ${row(inp('profile.nutrition.protein', 'Protein (g)', { type: 'num', min: 0, max: 500 }), inp('profile.nutrition.carbs', 'Kohlenh. (g)', { type: 'num', min: 0, max: 1000 }), inp('profile.nutrition.fat', 'Fett (g)', { type: 'num', min: 0, max: 400 }))}
          ${sec('Mahlzeiten pro Tag')}${chips('profile.nutrition.meals', [2, 3, 4, 5, 6].map((v) => [v, String(v)]), { numeric: true })}
          ${sec('Ernährungsform')}${chips('profile.nutrition.diet', DIETS, { multi: true })}
          <div style="height:12px"></div>
          ${inp('profile.nutrition.avoid', 'Vorlieben & Unverträglichkeiten', { type: 'area', ph: 'z. B. mag keinen Fisch, Nussallergie, esse gern Reis', wide: true })}
          ${sec('Supplements')}${chips('profile.nutrition.supps', SUPPS, { multi: true })}
        </div>${nav('Weiter', { skip: true })}`;

    case 6: {
      const occ = p.day?.occupation;
      return `${H('Dein Tagesablauf', 'Damit Mahlzeiten, Training und Schlaf zeitlich zusammenpassen. Uhrzeiten als HH:MM.')}
        <div class="card">
          ${row(inp('profile.day.wake', 'Aufstehen', { type: 'time', ph: '07:00' }), inp('profile.day.bed', 'Schlafen gehen', { type: 'time', ph: '23:00' }))}
          ${sec('Was machst du tagsüber?')}${chips('profile.day.occupation', OCCUPATION)}
          <div style="height:12px"></div>
          ${occ !== 'frei' ? row(inp('profile.day.workFrom', `${occ === 'schule' ? 'Schule' : occ === 'studium' ? 'Uni' : 'Arbeit'} von`, { type: 'time', ph: '08:00' }), inp('profile.day.workTo', 'bis', { type: 'time', ph: '16:30' })) : ''}
          ${sec('Wie aktiv ist dein Alltag?')}${chips('profile.day.activity', ACTIVITY)}
          <div style="height:12px"></div>
          ${row(inp('profile.day.trainTime', 'Training meist um', { type: 'time', ph: '17:30' }), inp('profile.day.commuteMin', 'Weg zum Gym (Min)', { type: 'num', ph: '15', min: 0, max: 180 }))}
          ${inp('profile.day.foodAccess', 'Essensmöglichkeiten tagsüber (optional)', { ph: 'z. B. Kantine mittags, sonst nur Mitgebrachtes', wide: true })}
          ${inp('profile.day.duties', 'Sonstige Verpflichtungen (optional)', { type: 'area', ph: 'z. B. Mi abends Nachhilfe, Kinder bis 19 Uhr', wide: true })}
        </div>${nav('Weiter', { skip: true })}`;
    }

    case 7:
      return `${H('KI-Coach verbinden', 'Optional: Mit einem kostenlosen Google-Gemini-Schlüssel plant die KI Training und Tag individuell. Ohne Schlüssel plant die App mit eigenen Regeln.')}
        <div class="card">
          <ol class="small" style="margin:0 0 12px;padding-left:20px">
            <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> öffnen und mit Google anmelden</li>
            <li>„API-Schlüssel erstellen“ tippen und kopieren</li>
            <li>Hier einfügen</li>
          </ol>
          <input type="password" data-key placeholder="AIza…" value="${esc(draft.ai.apiKey)}" spellcheck="false" autocapitalize="off" autocomplete="off">
          <p class="tiny faint" style="margin:8px 0 0">Der Schlüssel bleibt nur auf diesem Gerät. An die KI gehen deine Profil- und Trainingsangaben (ohne Namen). In der Gratis-Stufe darf Google Eingaben zur Verbesserung nutzen.</p>
        </div>
        ${nav('Weiter', { skip: true })}`;

    case 8: {
      const n = Object.keys(p.baselines).length;
      return `<div class="card accent" style="text-align:center;padding:24px 18px">
        <div style="font-size:44px">✅</div>
        <h1 style="margin:6px 0 10px;font-size:24px">Alles bereit!</h1>
        <p class="small" style="margin:0 0 6px"><b>Ziele:</b> ${esc(goalsText(p) || '–')}</p>
        <p class="small" style="margin:0 0 6px"><b>Startwerte:</b> ${n ? `${n} Übung${n === 1 ? '' : 'en'}` : 'keine – die App kalibriert vorsichtig'}</p>
        <p class="small" style="margin:0 0 6px"><b>Tag:</b> auf ${esc(p.day.wake)} · Training ${esc(p.day.trainTime)} · Bett ${esc(p.day.bed)}</p>
        <p class="small" style="margin:0"><b>KI:</b> ${draft.ai.apiKey ? 'verbunden' : 'ohne (lokale Planung)'}</p>
        <p class="tiny muted" style="margin:14px 0 0">Jeden Tag fragt dich der Check-in nach deiner Tagesform. Alles kannst du später in den Einstellungen ändern.</p>
      </div>${nav('Zum ersten Training')}`;
    }
  }
  return '';
}

/** Felder des aktuellen Schritts übernehmen. strict = prüfen und Fehlermeldung zurückgeben. */
function collectFields(root, strict) {
  for (const el of root.querySelectorAll('[data-f][data-t]')) {
    const { f, t, l } = el.dataset;
    const raw = el.value.trim();
    if (t === 'num') {
      if (!raw) { if (f !== 'profile.bodyweight') setP(f, null); continue; }
      const n = parseNum(raw);
      const min = el.dataset.min != null ? +el.dataset.min : -Infinity;
      const max = el.dataset.max != null ? +el.dataset.max : Infinity;
      if (n == null || n < min || n > max) { if (strict) return `${l}: bitte einen Wert zwischen ${min} und ${max} angeben.`; continue; }
      setP(f, n);
    } else if (t === 'time') {
      const m = /^(\d{1,2})[:.](\d{2})$/.exec(raw) || /^(\d{1,2})$/.exec(raw);
      if (!m || +m[1] > 23 || +(m[2] ?? 0) > 59) { if (strict && raw) return `${l}: bitte als Uhrzeit angeben, z. B. 07:30.`; continue; }
      setP(f, `${String(+m[1]).padStart(2, '0')}:${m[2] ?? '00'}`);
    } else setP(f, raw);
  }
  return null;
}

/** Eingaben des aktuellen Schritts in den Entwurf übernehmen. Gibt Fehlermeldung zurück. */
function collect(root) {
  const p = draft.profile;
  const err = collectFields(root, true);
  if (err) return err;
  if (step === 1 && !p.goals.length && !p.goal) return 'Wähle mindestens ein Ziel aus.';
  if (step === 2 && !(p.bodyweight >= 30 && p.bodyweight <= 250)) return 'Bitte ein Körpergewicht zwischen 30 und 250 kg angeben.';
  if (step === 3 && !p.equipment.length) return 'Wähle mindestens ein Equipment aus.';
  if (step === 4) {
    const next = {};
    for (const el of root.querySelectorAll('[data-bl-w]')) {
      const id = el.dataset.blW;
      const ex = getEx(id);
      const wRaw = el.value.trim();
      const rRaw = root.querySelector(`[data-bl-r="${id}"]`).value.trim();
      if (!wRaw && !rRaw) continue;
      const w = wRaw ? parseNum(wRaw) : ex.bw ? 0 : null;
      const r = parseNum(rRaw);
      if (w == null || w < 0 || w > 500) return `${ex.name}: Bitte ein gültiges Gewicht angeben.`;
      if (r == null || r < 1 || r > 50) return `${ex.name}: Bitte die Wiederholungen angeben (1–50).`;
      const old = p.baselines[id];
      next[id] = old && old.weight === w && old.reps === Math.round(r) ? old : { weight: w, reps: Math.round(r), date: new Date().toISOString() };
    }
    p.baselines = next;
  }
  if (step === 7) draft.ai.apiKey = root.querySelector('[data-key]').value.trim();
  return null;
}

export function render(root, route, app) {
  const q = route.query.get('schritt');
  if (q != null) {
    // Aus den Einstellungen aufgerufen: frisch mit den aktuellen Einstellungen beginnen.
    draft = null;
    step = clamp(parseInt(q, 10) || 0, 0, STEPS.length - 1);
    single = route.query.get('einzeln') === '1';
    history.replaceState(null, '', '#/start');
  }
  ensureDraft();
  const paint = () => {
    root.innerHTML = `${single ? '<div class="page-head"><h1>Profil bearbeiten</h1></div>' : ''}${dots()}${stepHtml()}`;
  };
  paint();
  window.scrollTo(0, 0);

  const finish = (toSettings) => {
    draft = null;
    step = 0;
    single = false;
    app.go(toSettings ? '#/einstellungen' : '#/heute');
  };

  root.onclick = async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const p = draft.profile;
    const rerender = () => { const y = window.scrollY; paint(); window.scrollTo(0, y); };
    if (act === 'goal') {
      collectFields(root, false);
      p.goals = p.goals.includes(el.dataset.k) ? p.goals.filter((g) => g !== el.dataset.k) : [...p.goals, el.dataset.k];
      return rerender();
    }
    if (act === 'pick') {
      collectFields(root, false);
      const { f, v } = el.dataset;
      const val = el.dataset.num ? +v : v;
      if (el.dataset.multi) {
        const cur = getP(f) ?? [];
        setP(f, cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]);
      } else {
        // Optionale Auswahl lässt sich durch erneutes Tippen wieder abwählen.
        const required = ['profile.experience', 'training.defaultMin', 'profile.nutrition.meals', 'profile.daysPerWeek', 'profile.day.occupation', 'profile.day.activity', 'profile.cond.place', 'profile.cond.partner', 'profile.cond.intensity', 'profile.body.fitness'];
        setP(f, getP(f) === val && !required.includes(f) ? '' : val);
      }
      return rerender();
    }
    if (act === 'add-ex') {
      const err = collect(root);
      if (err) return toast(err, 'err');
      openPicker({
        title: 'Übung für Startwert',
        exclude: [...BASELINE_EXERCISES, ...extraIds],
        equipment: p.equipment,
        onPick: (id) => {
          if (getEx(id).timed) return toast('Für Kondition/Mobility braucht es keinen Startwert.');
          extraIds.push(id);
          rerender();
        },
      });
      return;
    }
    if (act === 'cancel') return finish(true);
    if (act === 'back') { collectFields(root, false); step = Math.max(0, step - 1); return render(root, route, app); }
    if (act === 'skip') { step++; await store.saveSettings(JSON.parse(JSON.stringify(draft))); return render(root, route, app); }
    if (act === 'next') {
      const err = collect(root);
      if (err) return toast(err, 'err');
      if (single) {
        await store.saveSettings(draft);
        toast('Gespeichert ✓');
        return finish(true);
      }
      if (step < STEPS.length - 1) {
        step++;
        await store.saveSettings(draft); // Zwischenstand sichern
        draft = JSON.parse(JSON.stringify(draft));
        return render(root, route, app);
      }
      draft.onboarded = true;
      await store.saveSettings(draft);
      toast('Profil gespeichert ✓');
      return finish(false);
    }
  };
}

/** Für den Router: Einrichtung nötig? */
export const needsOnboarding = () => !S.settings.onboarded;
