// Einstellungen: Profil, KI, Training, Datensicherung.

import * as store from '../store.js';
import { S } from '../store.js';
import { EQUIPMENT, MUSCLES, getEx } from '../data/exercises.js';
import { goalsText } from '../data/goals.js';
import { SEX, OCCUPATION, PLACE, INTENSITY, DIETS } from '../data/profile.js';
import { STEP } from './onboarding.js';
import { parseHealth, healthText } from '../logic/health.js';
import { testConnection, usageToday, AiError } from '../ai/gemini.js';
import { toast, confirmSheet } from '../ui.js';
import { esc, parseNum, dayKey, fmtNum } from '../util.js';

const MODELS = [
  ['gemini-3.6-flash', 'Flash (Standard)'],
  ['gemini-3.5-flash-lite', 'Flash-Lite (sparsamer)'],
];

let showKey = false;
let showHealth = false;

const lbl = (list, k) => list.find(([v]) => v === k)?.[1] ?? '';
const has = (v) => v != null && v !== '';

function healthGuide() {
  const code = (t) => `<code style="background:var(--surface-2);padding:1px 5px;border-radius:5px">${t}</code>`;
  return `<ol class="small" style="padding-left:20px;margin:14px 0 0;line-height:1.5">
    <li>App <b>Kurzbefehle</b> öffnen → <b>+</b> (neuer Kurzbefehl) → oben als Namen ${code('KraftCoach Health')} eingeben.</li>
    <li><b>Aktion hinzufügen</b> → in der Suche ${code('Health')} eingeben → <b>Health-Samples suchen</b> (engl. „Find Health Samples“) wählen.<br>
      Einstellen: Typ <b>Ruheherzfrequenz</b>, Sortieren nach <b>Startdatum</b>, Reihenfolge <b>Neueste zuerst</b>, <b>Begrenzen</b> an, <b>1</b> Sample.</li>
    <li>Dasselbe noch einmal für <b>Herzfrequenzvariabilität</b> und für <b>Gewicht</b> (je neueste 1).</li>
    <li><b>Schritte:</b> wieder „Health-Samples suchen“, Typ <b>Schritte</b>, Filter <b>Startdatum ist heute</b>. Danach Aktion <b>Statistik berechnen</b> → <b>Summe</b>.</li>
    <li><b>Schlaf</b> (braucht Apple Watch o. ä.): „Health-Samples suchen“, Typ <b>Schlafanalyse</b>, Filter <b>Startdatum ist in den letzten 1 Tagen</b> und <b>Wert ist Schlafend</b> (bzw. Kern/Tief/REM). Dann <b>Details von Health-Samples abrufen</b> → <b>Dauer</b>, dann <b>Statistik berechnen</b> → <b>Summe</b>.</li>
    <li>Aktion <b>Text</b> hinzufügen und so ausfüllen – statt der Wörter in Klammern jeweils über der Tastatur die passende Variable (blaue Blase) antippen:
      <pre style="background:var(--surface-2);padding:10px;border-radius:10px;white-space:pre-wrap;margin:6px 0">KraftCoach Health
ruhepuls: [Ruheherzfrequenz]
hrv: [Herzfrequenzvariabilität]
schlaf: [Statistik Schlaf]
gewicht: [Gewicht]
schritte: [Statistik Schritte]</pre></li>
    <li>Letzte Aktion: <b>In Zwischenablage kopieren</b>. Fertig → oben <b>OK</b>.</li>
    <li>Beim ersten Start fragt das iPhone, ob der Kurzbefehl Health lesen darf → <b>Erlauben</b>.</li>
    <li><b>Benutzen:</b> Kurzbefehl starten (z. B. per Widget auf dem Home-Bildschirm), dann KraftCoach öffnen → Check-in → ❤️. Beim ersten Mal fragt das iPhone „Einsetzen erlauben?“ → <b>Einsetzen</b>.</li>
    <li><b>Automatisch jeden Morgen (optional):</b> Kurzbefehle → <b>Automation</b> → <b>+</b> → <b>Tageszeit</b> (z. B. 07:00) → <b>Sofort ausführen</b> → Kurzbefehl „KraftCoach Health“.</li>
  </ol>
  <p class="tiny faint" style="margin:8px 0 0">Die Namen der Aktionen können je nach iOS-Version leicht abweichen. Fehlt ein Wert (z. B. HRV ohne Uhr), die Zeile einfach weglassen – die App nimmt, was da ist.</p>`;
}

/** Kurze Zusammenfassung je Profilbereich. */
function profileRows(p) {
  const b = p.body ?? {}, n = p.nutrition ?? {}, d = p.day ?? {}, c = p.cond ?? {};
  const bl = Object.entries(p.baselines ?? {});
  return [
    ['ziele', 'Ziele', [goalsText(p), p.aims?.perf, p.aims?.priority?.length && `Fokus: ${p.aims.priority.map((m) => MUSCLES[m]).join(', ')}`].filter(Boolean).join(' · ') || 'keine angegeben'],
    ['koerper', 'Körper', [has(b.age) && `${b.age} J.`, lbl(SEX, b.sex), has(b.heightCm) && `${b.heightCm} cm`, `${fmtNum(p.bodyweight)} kg`, has(b.bodyfat) && `${fmtNum(b.bodyfat)} % KFA`, p.notes && `Hinweis: ${p.notes}`].filter(Boolean).join(' · ')],
    ['training', 'Training & Bedingungen', [p.experience, `${p.daysPerWeek}×/Woche`, lbl(PLACE, c.place), lbl(INTENSITY, c.intensity), p.equipment.map((e) => EQUIPMENT[e]).join(', ')].filter(Boolean).join(' · ')],
    ['werte', 'Startwerte', bl.length ? bl.map(([id, x]) => `${getEx(id).name} ${fmtNum(x.weight)} × ${x.reps}`).join(' · ') : 'keine angegeben'],
    ['ernaehrung', 'Ernährung', [has(n.kcal) && `${n.kcal} kcal`, has(n.protein) && `${n.protein} g Protein`, `${n.meals ?? 3} Mahlzeiten`, n.diet?.map((k) => lbl(DIETS, k)).join(', '), n.supps?.length && `${n.supps.length} Supplements`].filter(Boolean).join(' · ')],
    ['tag', 'Tagesablauf', [`auf ${d.wake}`, `Training ${d.trainTime}`, `Bett ${d.bed}`, lbl(OCCUPATION, d.occupation), has(d.commuteMin) && `${d.commuteMin} Min Weg`].filter(Boolean).join(' · ')],
  ];
}

export function render(root, route, app) {
  const st = S.settings;
  const p = st.profile;
  const t = st.training;
  const nSess = store.doneSessions().length;

  root.innerHTML = `<div class="page-head"><h1>Einstellungen</h1></div>
  <form data-form autocomplete="off">
    <h2>Profil</h2>
    <div class="card tight">
      ${profileRows(p).map(([k, title, text]) => `<button type="button" class="list-btn" data-act="edit" data-step="${k}">
        <div class="grow" style="min-width:0"><div style="font-weight:600">${title}</div><div class="tiny muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(text)}</div></div>
        <span class="muted">›</span></button>`).join('')}
      <button type="button" class="btn ghost block sm" data-act="onboarding" style="margin-top:6px">Einrichtung komplett neu</button>
    </div>

    <h2>Apple Health</h2>
    <div class="card">
      <p class="small" style="margin-top:0">Web-Apps dürfen Apple Health nicht direkt lesen – das erlaubt Apple nur Apps aus dem App Store. Der Umweg: Ein <b>Kurzbefehl</b> holt Ruhepuls, HRV, Schlaf, Gewicht und Schritte aus Health und kopiert sie. Im Check-in tippst du dann auf <b>❤️ Werte aus Apple Health holen</b>.</p>
      <button type="button" class="btn sm block" data-act="health-guide">${showHealth ? 'Anleitung ausblenden' : 'Kurzbefehl einrichten – Anleitung'}</button>
      ${showHealth ? healthGuide() : ''}
      <button type="button" class="btn ghost sm block" data-act="health-test" style="margin-top:8px">Zwischenablage testen</button>
    </div>

    <h2>Training</h2>
    <div class="card">
      <div class="row">
        <label class="field grow"><span>Standardzeit (Min)</span><input type="text" inputmode="numeric" name="defaultMin" value="${t.defaultMin}"></label>
        <label class="field grow"><span>Aufwärmen (Min)</span><input type="text" inputmode="numeric" name="warmupMin" value="${p.warmupMin}"></label>
      </div>
      <div class="row">
        <label class="field grow"><span>Pause Grundübung (s)</span><input type="text" inputmode="numeric" name="restCompound" value="${t.restCompound}"></label>
        <label class="field grow"><span>Pause Isolation (s)</span><input type="text" inputmode="numeric" name="restIsolation" value="${t.restIsolation}"></label>
      </div>
      <label class="check"><input type="checkbox" name="finisher" ${p.finisher ? 'checked' : ''}> Kondition-Finisher einplanen (ab 40 Min)</label>
      <label class="check"><input type="checkbox" name="sound" ${t.sound ? 'checked' : ''}> Ton am Pausenende</label>
      <label class="check"><input type="checkbox" name="vibrate" ${t.vibrate ? 'checked' : ''}> Vibration (nur Android)</label>
      <label class="check"><input type="checkbox" name="wakeLock" ${t.wakeLock ? 'checked' : ''}> Bildschirm im Training anlassen</label>
    </div>

    <h2>KI-Coach (Google Gemini)</h2>
    <div class="card">
      <label class="check"><input type="checkbox" name="aiEnabled" ${st.ai.enabled ? 'checked' : ''}> KI für Tagespläne verwenden</label>
      <label class="field"><span>API-Schlüssel – wird nur auf diesem Gerät gespeichert</span>
        <div class="row"><input class="grow" type="${showKey ? 'text' : 'password'}" name="apiKey" value="${esc(st.ai.apiKey)}" placeholder="AIza…" spellcheck="false" autocapitalize="off">
        <button type="button" class="btn sm" data-act="toggle-key">${showKey ? 'Verbergen' : 'Zeigen'}</button></div>
      </label>
      <p class="tiny muted" style="margin:-6px 0 12px">Kostenlosen Schlüssel erstellen: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></p>
      <label class="field"><span>Modell-ID</span><input type="text" name="model" value="${esc(st.ai.model)}" spellcheck="false" autocapitalize="off"></label>
      <div class="chips" style="margin:-4px 0 12px">${MODELS.map(([id, l]) => `<button type="button" class="chip ${st.ai.model === id ? 'on' : ''}" data-act="model" data-id="${id}">${l}</button>`).join('')}</div>
      <div class="row between"><span class="small muted">KI-Anfragen heute: <b>${usageToday()}</b></span>
        <button type="button" class="btn sm" data-act="test">Verbindung testen</button></div>
    </div>
    <button class="btn primary block big" type="submit">Speichern</button>
  </form>

  <h2>Daten</h2>
  <div class="card">
    <p class="small muted" style="margin-top:0">Alle Daten liegen nur auf diesem Gerät (${nSess} Einheiten, ${S.sets.length} Sätze). Mach regelmäßig ein Backup!</p>
    <div class="btn-row"><button class="btn" data-act="export">Backup exportieren</button><button class="btn" data-act="import">Backup importieren</button></div>
    <input type="file" accept="application/json,.json" data-file hidden>
    <button class="btn ghost danger block sm" data-act="wipe" style="margin-top:10px">Alle Daten löschen</button>
  </div>
  <p class="tiny faint" style="text-align:center">KraftCoach · Daten lokal · KI optional</p>`;

  const form = root.querySelector('[data-form]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveForm(form);
    toast('Gespeichert ✓');
    render(root, route, app);
  });

  root.onclick = async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'edit') { await saveForm(form); return app.go(`#/start?schritt=${STEP[el.dataset.step]}&einzeln=1`); }
    if (act === 'onboarding') { await saveForm(form); return app.go('#/start?schritt=0'); }
    if (act === 'health-guide') { await saveForm(form); showHealth = !showHealth; return render(root, route, app); }
    if (act === 'health-test') {
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch { return toast('Zugriff auf die Zwischenablage nicht erlaubt.', 'err'); }
      const h = parseHealth(text);
      return toast(h ? `Erkannt: ${healthText(h)}` : 'In der Zwischenablage sind keine Health-Werte. Zuerst den Kurzbefehl starten.', h ? '' : 'err');
    }
    if (act === 'toggle-key') { await saveForm(form); showKey = !showKey; return render(root, route, app); }
    if (act === 'model') { form.model.value = el.dataset.id; await saveForm(form); return render(root, route, app); }
    if (act === 'test') {
      await saveForm(form);
      el.disabled = true;
      el.innerHTML = '<span class="spinner"></span>';
      try {
        await testConnection({ apiKey: S.settings.ai.apiKey, model: S.settings.ai.model });
        toast('Verbindung klappt ✓');
      } catch (err) {
        toast(err instanceof AiError ? err.message : String(err), 'err');
        if (err?.detail) console.warn('Gemini:', err.detail);
      }
      return render(root, route, app);
    }
    if (act === 'export') return doExport();
    if (act === 'import') return root.querySelector('[data-file]').click();
    if (act === 'wipe') {
      if (await confirmSheet('Wirklich alles löschen?', 'Alle Einheiten, Sätze und Einstellungen auf diesem Gerät werden gelöscht. Das kann nicht rückgängig gemacht werden.', 'Alles löschen', { danger: true })) {
        await store.wipeAll();
        toast('Alle Daten gelöscht');
        render(root, route, app);
      }
    }
  };

  root.querySelector('[data-file]').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch { return toast('Datei ist kein gültiges JSON.', 'err'); }
    const err = store.validateBackup(data);
    if (err) return toast(err, 'err');
    const ok = await confirmSheet('Backup importieren?', `${data.sessions.length} Einheiten und ${data.sets.length} Sätze. Die aktuellen Daten werden ersetzt (dein API-Schlüssel bleibt erhalten).`, 'Ersetzen', { danger: true });
    if (!ok) return;
    await store.importData(data, 'replace');
    toast('Backup importiert ✓');
    render(root, route, app);
  });
}

async function saveForm(form) {
  const f = new FormData(form);
  const st = JSON.parse(JSON.stringify(S.settings));
  const num = (k, d, lo, hi) => { const n = parseNum(f.get(k)); return n == null ? d : Math.min(hi, Math.max(lo, n)); };
  st.profile.warmupMin = Math.round(num('warmupMin', 5, 0, 15));
  st.profile.finisher = f.get('finisher') === 'on';
  st.training.defaultMin = Math.round(num('defaultMin', 50, 15, 120));
  st.training.restCompound = Math.round(num('restCompound', 150, 30, 300));
  st.training.restIsolation = Math.round(num('restIsolation', 90, 30, 300));
  st.training.sound = f.get('sound') === 'on';
  st.training.vibrate = f.get('vibrate') === 'on';
  st.training.wakeLock = f.get('wakeLock') === 'on';
  st.ai.enabled = f.get('aiEnabled') === 'on';
  st.ai.apiKey = String(f.get('apiKey') ?? '').trim();
  st.ai.model = String(f.get('model') ?? '').trim() || 'gemini-3.6-flash';
  await store.saveSettings(st);
}

async function doExport() {
  const data = store.exportData({ includeKey: false });
  const json = JSON.stringify(data, null, 1);
  const name = `kraftcoach-backup-${dayKey(Date.now())}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // Auf dem Handy: Teilen-Menü (in Dateien sichern, per Mail senden …)
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'KraftCoach Backup' }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Backup gespeichert (ohne API-Schlüssel)');
}
