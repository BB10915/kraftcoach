// Einstellungen: Profil, KI, Training, Datensicherung.

import * as store from '../store.js';
import { S } from '../store.js';
import { EQUIPMENT } from '../data/exercises.js';
import { testConnection, usageToday, AiError } from '../ai/gemini.js';
import { toast, confirmSheet } from '../ui.js';
import { esc, parseNum, dayKey } from '../util.js';

const MODELS = [
  ['gemini-3.6-flash', 'Flash (Standard)'],
  ['gemini-3.5-flash-lite', 'Flash-Lite (sparsamer)'],
];

let showKey = false;

export function render(root, route, app) {
  const st = S.settings;
  const p = st.profile;
  const t = st.training;
  const nSess = store.doneSessions().length;

  root.innerHTML = `<div class="page-head"><h1>Einstellungen</h1></div>
  <form data-form autocomplete="off">
    <h2>Profil</h2>
    <div class="card">
      <label class="field"><span>Ziel</span><textarea name="goal" rows="2">${esc(p.goal)}</textarea></label>
      <label class="field"><span>Erfahrung</span><select name="experience">
        ${[['anfaenger', 'Anfänger'], ['wiedereinsteiger', 'Wiedereinsteiger'], ['fortgeschritten', 'Fortgeschritten']].map(([v, l]) => `<option value="${v}" ${p.experience === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></label>
      <div class="row">
        <label class="field grow"><span>Einheiten pro Woche</span><input type="text" name="daysPerWeek" value="${esc(p.daysPerWeek)}"></label>
        <label class="field grow"><span>Körpergewicht (kg)</span><input type="text" inputmode="decimal" name="bodyweight" value="${esc(String(p.bodyweight).replace('.', ','))}"></label>
      </div>
      <label class="field"><span>Hinweise / Einschränkungen für die KI</span><textarea name="notes" rows="2" placeholder="z. B. kein schweres Kreuzheben, Fokus Klimmzüge">${esc(p.notes)}</textarea></label>
      <div class="small muted" style="margin-bottom:6px">Ausrüstung</div>
      ${Object.entries(EQUIPMENT).map(([k, l]) => `<label class="check"><input type="checkbox" name="eq" value="${k}" ${p.equipment.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}
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
  st.profile.goal = String(f.get('goal') ?? '').trim() || st.profile.goal;
  st.profile.experience = f.get('experience');
  st.profile.daysPerWeek = String(f.get('daysPerWeek') ?? '').trim();
  st.profile.bodyweight = num('bodyweight', st.profile.bodyweight, 30, 250);
  st.profile.notes = String(f.get('notes') ?? '').trim();
  st.profile.equipment = f.getAll('eq');
  if (!st.profile.equipment.length) st.profile.equipment = ['kg'];
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
