// Einrichtung beim ersten Start: Ziele, Profil, aktuelle Werte, KI-Schlüssel.

import * as store from '../store.js';
import { S } from '../store.js';
import { getEx } from '../data/exercises.js';
import { GOALS, BASELINE_EXERCISES, goalsText } from '../data/goals.js';
import { openPicker } from './picker.js';
import { toast } from '../ui.js';
import { esc, fmtNum, parseNum, clamp } from '../util.js';

const STEPS = ['Willkommen', 'Ziele', 'Über dich', 'Deine Werte', 'KI-Coach', 'Fertig'];
let step = 0;
let draft = null; // Arbeitskopie der Einstellungen
let extraIds = []; // zusätzlich gewählte Übungen für Startwerte

function ensureDraft() {
  if (draft) return;
  draft = JSON.parse(JSON.stringify(S.settings));
  draft.profile.goals ??= [];
  draft.profile.baselines ??= {};
  extraIds = Object.keys(draft.profile.baselines).filter((id) => !BASELINE_EXERCISES.includes(id));
}

const dots = () => `<div class="row" style="gap:6px;justify-content:center;margin:4px 0 18px">${STEPS.map((_, i) =>
  `<span style="width:${i === step ? 22 : 8}px;height:8px;border-radius:99px;background:${i <= step ? 'var(--accent)' : 'var(--surface-3)'}"></span>`).join('')}</div>`;

const nav = (nextLabel = 'Weiter', { skip = false } = {}) => `
  <div class="btn-row" style="margin-top:18px">
    ${step > 0 ? '<button class="btn" data-act="back">Zurück</button>' : ''}
    <button class="btn primary" data-act="next">${nextLabel}</button>
  </div>
  ${skip ? '<button class="btn ghost block sm" data-act="next" style="margin-top:8px">Überspringen</button>' : ''}`;

function stepHtml() {
  const p = draft.profile;
  switch (step) {
    case 0:
      return `<div class="card accent" style="text-align:center;padding:28px 18px">
        <div style="font-size:48px">🏋️</div>
        <h1 style="margin:8px 0 6px;font-size:26px">Willkommen bei KraftCoach</h1>
        <p class="muted">Ein paar kurze Fragen, damit dein Coach von Anfang an passende Pläne und Gewichte vorschlägt. Dauert etwa 2 Minuten.</p>
        <p class="tiny faint">Alles bleibt nur auf diesem Gerät gespeichert.</p>
      </div>${nav("Los geht's")}`;

    case 1:
      return `<h1 style="font-size:24px;margin:0 0 4px">Was willst du erreichen?</h1>
        <p class="muted small" style="margin:0 0 14px">Mehrere Antworten möglich.</p>
        <div class="card tight">${GOALS.map(([k, l, d]) => `
          <button class="list-btn" data-act="goal" data-k="${k}">
            <span style="width:26px;height:26px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;font-weight:800;${p.goals.includes(k) ? 'background:var(--accent);color:var(--accent-ink)' : 'border:2px solid var(--line)'}">${p.goals.includes(k) ? '✓' : ''}</span>
            <div class="grow"><div style="font-weight:600">${l}</div><div class="tiny muted">${d}</div></div>
          </button>`).join('')}</div>
        <label class="field" style="margin-top:12px"><span>In eigenen Worten (optional)</span>
          <textarea data-goal-text rows="2" placeholder="z. B. 10 Klimmzüge schaffen, fit für den Skiurlaub">${esc(p.goal)}</textarea></label>
        ${nav()}`;

    case 2: {
      const exp = [['anfaenger', 'Anfänger', 'Wenig Erfahrung mit freien Gewichten'], ['wiedereinsteiger', 'Wiedereinsteiger', 'Früher trainiert, länger pausiert'], ['fortgeschritten', 'Fortgeschritten', 'Trainiere regelmäßig, kenne die Grundübungen']];
      return `<h1 style="font-size:24px;margin:0 0 14px">Über dich</h1>
        <div class="small muted" style="margin-bottom:6px">Erfahrung</div>
        <div class="card tight">${exp.map(([k, l, d]) => `
          <button class="list-btn" data-act="exp" data-k="${k}">
            <span style="width:22px;height:22px;border-radius:50%;flex:none;${p.experience === k ? 'background:var(--accent);box-shadow:inset 0 0 0 5px var(--surface)' : 'border:2px solid var(--line)'}"></span>
            <div class="grow"><div style="font-weight:600">${l}</div><div class="tiny muted">${d}</div></div></button>`).join('')}</div>
        <div class="small muted" style="margin:14px 0 6px">Trainings pro Woche</div>
        <div class="chips">${['2', '3', '3–4', '4', '5+'].map((v) => `<button class="chip ${p.daysPerWeek === v ? 'on' : ''}" data-act="days" data-v="${v}">${v}</button>`).join('')}</div>
        <div class="small muted" style="margin:14px 0 6px">Typische Trainingsdauer</div>
        <div class="chips">${[30, 45, 50, 60, 75].map((v) => `<button class="chip ${draft.training.defaultMin === v ? 'on' : ''}" data-act="min" data-v="${v}">${v} Min</button>`).join('')}</div>
        <label class="field" style="margin-top:14px"><span>Körpergewicht (kg) – für Klimmzüge, Dips & Co.</span>
          <input type="text" inputmode="decimal" data-bw value="${esc(fmtNum(p.bodyweight))}"></label>
        <label class="field"><span>Beschwerden oder Übungen, die du meiden willst (optional)</span>
          <textarea data-notes rows="2" placeholder="z. B. Knie empfindlich, kein Kreuzheben">${esc(p.notes)}</textarea></label>
        ${nav()}`;
    }

    case 3: {
      const ids = [...BASELINE_EXERCISES, ...extraIds];
      return `<h1 style="font-size:24px;margin:0 0 4px">Deine aktuellen Werte</h1>
        <p class="muted small" style="margin:0 0 14px">Welches Gewicht schaffst du aktuell <b>sauber</b> für wie viele Wiederholungen? Grob reicht. Übungen, die du nicht machst, einfach leer lassen – die findet die App dann selbst heraus.</p>
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

    case 4:
      return `<h1 style="font-size:24px;margin:0 0 4px">KI-Coach verbinden</h1>
        <p class="muted small" style="margin:0 0 14px">Optional: Mit einem kostenlosen Google-Gemini-Schlüssel plant die KI deine Einheiten individuell. Ohne Schlüssel plant die App mit eigenen Regeln.</p>
        <div class="card">
          <ol class="small" style="margin:0 0 12px;padding-left:20px">
            <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> öffnen und mit Google anmelden</li>
            <li>„API-Schlüssel erstellen“ tippen und kopieren</li>
            <li>Hier einfügen</li>
          </ol>
          <input type="password" data-key placeholder="AIza…" value="${esc(draft.ai.apiKey)}" spellcheck="false" autocapitalize="off" autocomplete="off">
          <p class="tiny faint" style="margin:8px 0 0">Der Schlüssel bleibt nur auf diesem Gerät.</p>
        </div>
        ${nav('Weiter', { skip: true })}`;

    case 5: {
      const n = Object.keys(p.baselines).length;
      return `<div class="card accent" style="text-align:center;padding:24px 18px">
        <div style="font-size:44px">✅</div>
        <h1 style="margin:6px 0 10px;font-size:24px">Alles bereit!</h1>
        <p class="small" style="margin:0 0 6px"><b>Ziele:</b> ${esc(goalsText(p) || '–')}</p>
        <p class="small" style="margin:0 0 6px"><b>Startwerte:</b> ${n ? `${n} Übung${n === 1 ? '' : 'en'}` : 'keine – die App kalibriert vorsichtig'}</p>
        <p class="small" style="margin:0"><b>KI:</b> ${draft.ai.apiKey ? 'verbunden' : 'ohne (lokale Planung)'}</p>
        <p class="tiny muted" style="margin:14px 0 0">Alles kannst du später in den Einstellungen ändern.</p>
      </div>${nav('Zum ersten Training')}`;
    }
  }
  return '';
}

/** Eingaben des aktuellen Schritts in den Entwurf übernehmen. Gibt Fehlermeldung zurück. */
function collect(root) {
  const p = draft.profile;
  if (step === 1) {
    p.goal = root.querySelector('[data-goal-text]').value.trim();
    if (!p.goals.length && !p.goal) return 'Wähle mindestens ein Ziel aus.';
  }
  if (step === 2) {
    const bw = parseNum(root.querySelector('[data-bw]').value);
    if (bw == null || bw < 30 || bw > 250) return 'Bitte ein Körpergewicht zwischen 30 und 250 kg angeben.';
    p.bodyweight = bw;
    p.notes = root.querySelector('[data-notes]').value.trim();
  }
  if (step === 3) {
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
      next[id] = { weight: w, reps: Math.round(r), date: new Date().toISOString() };
    }
    p.baselines = next;
  }
  if (step === 4) draft.ai.apiKey = root.querySelector('[data-key]').value.trim();
  return null;
}

export function render(root, route, app) {
  const q = route.query.get('schritt');
  if (q != null) {
    // Aus den Einstellungen aufgerufen: frisch mit den aktuellen Einstellungen beginnen.
    draft = null;
    step = clamp(parseInt(q, 10) || 0, 0, STEPS.length - 1);
    history.replaceState(null, '', '#/start');
  }
  ensureDraft();
  root.innerHTML = `${dots()}${stepHtml()}`;
  window.scrollTo(0, 0);

  root.onclick = async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const p = draft.profile;
    const rerender = () => { root.innerHTML = `${dots()}${stepHtml()}`; };
    if (act === 'goal') {
      collectSoft(root);
      p.goals = p.goals.includes(el.dataset.k) ? p.goals.filter((g) => g !== el.dataset.k) : [...p.goals, el.dataset.k];
      return rerender();
    }
    if (act === 'exp') { collectSoft(root); p.experience = el.dataset.k; return rerender(); }
    if (act === 'days') { collectSoft(root); p.daysPerWeek = el.dataset.v; return rerender(); }
    if (act === 'min') { collectSoft(root); draft.training.defaultMin = +el.dataset.v; return rerender(); }
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
    if (act === 'back') { collectSoft(root); step = Math.max(0, step - 1); return render(root, route, app); }
    if (act === 'next') {
      const err = collect(root);
      if (err) return toast(err, 'err');
      if (step < STEPS.length - 1) {
        step++;
        await store.saveSettings(draft); // Zwischenstand sichern
        draft = JSON.parse(JSON.stringify(draft));
        return render(root, route, app);
      }
      draft.onboarded = true;
      await store.saveSettings(draft);
      draft = null;
      step = 0;
      toast('Profil gespeichert ✓');
      return app.go('#/heute');
    }
  };
}

/** Eingaben ohne Prüfung übernehmen (beim Antippen von Auswahl-Tasten). */
function collectSoft(root) {
  const p = draft.profile;
  const gt = root.querySelector('[data-goal-text]');
  if (gt) p.goal = gt.value.trim();
  const bw = root.querySelector('[data-bw]');
  if (bw) { const n = parseNum(bw.value); if (n) p.bodyweight = n; }
  const notes = root.querySelector('[data-notes]');
  if (notes) p.notes = notes.value.trim();
}

/** Für den Router: Einrichtung nötig? */
export const needsOnboarding = () => !S.settings.onboarded;
