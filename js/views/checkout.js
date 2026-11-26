// Bildschirm "Training speichern": Abschluss nach dem Training (ähnlich "Aktivität speichern").
// Route: #/abschluss/<sessionId>  (?neu=1 direkt nach "Training beenden")

import * as store from '../store.js';
import { getEx } from '../data/exercises.js';
import { REGIONS } from '../data/goals.js';
import { RPE, FEEL, rpeLabel, cleanCheckout, durationMin, MAX_TITLE, MAX_NOTE } from '../logic/checkout.js';
import { toast, confirmSheet, ICONS } from '../ui.js';
import { esc, fmtNum, fmtDate } from '../util.js';

let st = null; // Entwurf { id, title, rpe, feel, pain, note, photo }

const PHOTO_MAX = 1280; // längste Seite in px
const PHOTO_Q = 0.78;

/** Foto verkleinern und als JPEG-Data-URL zurückgeben (bleibt nur auf dem Gerät). */
export async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Bild konnte nicht gelesen werden.'));
      i.src = url;
    });
    const k = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', PHOTO_Q);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function statsHtml(s) {
  const sets = store.setsOf(s.id).filter((x) => !x.warmup);
  const vol = sets.reduce((a, x) => a + x.weight * x.reps * (getEx(x.exerciseId).perHand ? 2 : 1), 0);
  const prs = sets.filter((x) => x.pr?.length).length;
  const min = durationMin(s);
  return `<div class="kpis" style="margin:0">
      <div class="kpi"><b class="num">${min ?? '–'}</b><span>Minuten</span></div>
      <div class="kpi"><b class="num">${sets.length}</b><span>Sätze</span></div>
      <div class="kpi"><b class="num">${fmtNum(vol / 1000, 1)}</b><span>Tonnen bewegt</span></div>
    </div>
    ${prs ? `<p style="margin:10px 0 0;color:var(--gold);font-weight:700">🏆 ${prs} neue${prs === 1 ? 'r' : ''} Rekord${prs === 1 ? '' : 'e'}</p>` : ''}`;
}

function rpeHtml() {
  const v = st.rpe;
  const min = durationMin(store.sessionById(st.id));
  const load = v != null && min ? v * min : null;
  return `<div class="rpe-grid" role="radiogroup" aria-label="Anstrengung 0 bis 10">${RPE.map(([k]) =>
    `<button class="rpe-b ${v === k ? 'on' : ''}" data-act="rpe" data-v="${k}" role="radio" aria-checked="${v === k}" style="--h:${120 - k * 12}">${k}</button>`).join('')}</div>
    <div class="small" style="margin-top:8px;min-height:20px">${v == null
      ? '<span class="muted">0 = Ruhe · 5 = schwer · 10 = maximal</span>'
      : `<b>${esc(rpeLabel(v))}</b>${load ? `<span class="muted"> · Trainingslast ${load} (RPE × ${min} Min)</span>` : ''}`}</div>`;
}

function formHtml(s, neu) {
  const placeholder = s.title || 'Training';
  return `<div class="page-head"><div><h1>${neu ? 'Training speichern' : 'Training'}</h1><div class="sub">${fmtDate(s.startedAt ?? s.date)}</div></div></div>
  <div class="card accent">${neu ? '<h2 style="margin:0 0 8px">Geschafft! 💪</h2>' : ''}${statsHtml(s)}</div>

  <div class="card">
    <label class="field" style="margin:0"><span>Titel</span>
      <input type="text" data-co="title" maxlength="${MAX_TITLE}" value="${esc(st.title)}" placeholder="${esc(placeholder)}" autocomplete="off"></label>
  </div>

  <div class="card">
    <b>Wie anstrengend war das Training insgesamt?</b>
    <div class="tiny muted" style="margin:2px 0 10px">Die ganze Einheit, nicht nur der letzte Satz.</div>
    <div data-rpe>${rpeHtml()}</div>
  </div>

  <div class="card">
    <b>Wie hast du dich gefühlt?</b>
    <div class="chips feel" style="margin-top:10px">${FEEL.map(([k, l, e]) =>
      `<button class="chip ${st.feel === k ? 'on' : ''}" data-act="feel" data-v="${k}"><span style="font-size:20px">${e}</span> ${l}</button>`).join('')}</div>
  </div>

  <div class="card">
    <b>Schmerzen oder Zwicken?</b>
    <div class="tiny muted" style="margin:2px 0 10px">Wird beim nächsten Check-in (bis 3 Tage) vorausgewählt und dann gemieden.</div>
    <div class="chips">${Object.entries(REGIONS).map(([k, r]) => {
      const on = st.pain.includes(k);
      return `<button class="chip ${on ? 'on' : ''}" data-act="pain" data-v="${k}" style="${on ? 'background:var(--danger);color:#fff' : ''}">${esc(r.label)}</button>`;
    }).join('')}</div>
  </div>

  <div class="card">
    <label class="field" style="margin:0"><span>Notiz</span>
      <textarea data-co="note" rows="3" maxlength="${MAX_NOTE}" placeholder="Wie lief's? z. B. „Bank lief gut, Griff war das Limit“">${esc(st.note)}</textarea></label>
  </div>

  <div class="card">
    <div class="row between"><b>Foto</b><span class="tiny faint">bleibt nur auf deinem Gerät</span></div>
    ${st.photo
      ? `<div class="co-photo"><img src="${st.photo}" alt="Foto zum Training"><button class="icon-btn" data-act="photo-del" aria-label="Foto entfernen">${ICONS.x}</button></div>`
      : '<button class="btn ghost block" data-act="photo" style="margin-top:10px">📷 Foto hinzufügen</button>'}
    <input type="file" accept="image/*" data-photo hidden>
  </div>

  <button class="btn primary block big" data-act="save">Speichern</button>
  ${neu
    ? '<button class="btn ghost block" data-act="skip" style="margin-top:8px">Ohne Angaben weiter</button>'
    : `<div class="btn-row" style="margin-top:8px"><button class="btn" data-act="back">Abbrechen</button><button class="btn danger" data-act="del">Einheit löschen</button></div>`}
  <p class="tiny faint" style="text-align:center;margin-top:12px">Alles optional. Du kannst den Abschluss später unter Fortschritt → Verlauf ändern.</p>`;
}

export function render(root, route, app) {
  const s = store.sessionById(route.param);
  const neu = route.query.get('neu') === '1';
  if (!s || s.status !== 'done') {
    root.innerHTML = '<div class="card empty"><p>Diese Einheit gibt es nicht (mehr).</p><a class="btn primary" href="#/fortschritt">Zum Verlauf</a></div>';
    return;
  }
  if (st?.id !== s.id) {
    const c = s.checkout ?? {};
    st = { id: s.id, title: c.title ?? '', rpe: c.rpe ?? null, feel: c.feel ?? null, pain: [...(c.pain ?? [])], note: c.note ?? '', photo: c.photo ?? null };
  }
  const paint = () => {
    const y = window.scrollY;
    root.innerHTML = formHtml(s, neu);
    window.scrollTo(0, y);
  };
  paint();
  const next = () => app.go(neu ? `#/heute?fertig=${s.id}` : '#/fortschritt');

  root.oninput = (e) => {
    const k = e.target.dataset?.co;
    if (k) st[k] = e.target.value;
  };
  root.onchange = async (e) => {
    if (!e.target.matches('[data-photo]')) return;
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      st.photo = await shrinkPhoto(f);
      paint();
    } catch (err) {
      toast(err?.message ?? 'Foto konnte nicht geladen werden.', 'err');
    }
  };
  root.onclick = async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'rpe') {
      const v = +el.dataset.v;
      st.rpe = st.rpe === v ? null : v;
      root.querySelector('[data-rpe]').innerHTML = rpeHtml(); // nur diesen Teil, damit Tastatur/Scroll bleiben
      return;
    }
    if (act === 'feel') { const v = +el.dataset.v; st.feel = st.feel === v ? null : v; return paint(); }
    if (act === 'pain') { const k = el.dataset.v; st.pain = st.pain.includes(k) ? st.pain.filter((x) => x !== k) : [...st.pain, k]; return paint(); }
    if (act === 'photo') return root.querySelector('[data-photo]').click();
    if (act === 'photo-del') { st.photo = null; return paint(); }
    if (act === 'save') {
      const c = cleanCheckout({ ...st, at: s.checkout?.at });
      s.checkout = c;
      try {
        await store.putSession(s);
      } catch (err) {
        // Meist voller Speicher wegen des Fotos: ohne Foto erneut versuchen.
        if (!c.photo) return toast('Speichern fehlgeschlagen: ' + (err?.message ?? err), 'err');
        s.checkout = { ...c, photo: null };
        await store.putSession(s).catch(() => {});
        toast('Speicher voll – Training ohne Foto gespeichert.', 'err');
      }
      st = null;
      toast(neu ? 'Training gespeichert' : 'Änderungen gespeichert');
      return next();
    }
    if (act === 'skip' || act === 'back') { st = null; return next(); }
    if (act === 'del') {
      if (await confirmSheet('Einheit löschen?', 'Die Einheit und alle ihre Sätze werden gelöscht.', 'Löschen', { danger: true })) {
        await store.deleteSession(s.id);
        st = null;
        toast('Einheit gelöscht');
        app.go('#/fortschritt');
      }
    }
  };
}

export function leave() {
  st = null;
}
