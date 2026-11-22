// Chat-Aktionen: was der Coach-Chat in der App ändern darf (feste Liste, jede Aktion wird geprüft).
// Reine Logik ohne Speichern – die Oberfläche speichert das Ergebnis und kann es rückgängig machen.

import { EX, getEx } from '../data/exercises.js';
import { SUPPS } from '../data/profile.js';
import { makeItem } from '../logic/planner.js';
import { clamp, fmtNum } from '../util.js';

const ONOFF = { ton: ['sound', 'Ton am Pausenende'], vibration: ['vibrate', 'Vibration'], bildschirm_an: ['wakeLock', 'Bildschirm im Training anlassen'], anleitungen: ['guideHints', 'Anleitungs-Vorschläge'] };
const TIMES = { zeit_training: ['trainTime', 'Trainingszeit'], zeit_aufstehen: ['wake', 'Aufstehzeit'], zeit_schlafen: ['bed', 'Schlafenszeit'] };
const SUPP_LABEL = Object.fromEntries(SUPPS);

/** Alle erlaubten Aktionstypen mit kurzer Beschreibung (steht auch im KI-Prompt). */
export const ACTION_DOC = {
  pause_grund: 'zahl = Sekunden: Standard-Pause für Grundübungen (gilt für neue Pläne und offene Grundübungen im heutigen Training)',
  pause_isolation: 'zahl = Sekunden: Standard-Pause für Isolationsübungen (dito)',
  pause_uebung: 'zahl = Sekunden, id optional (sonst aktuelle Übung): Pause nur für diese Übung im heutigen Training',
  pause_starten: 'zahl = Sekunden: Pausentimer jetzt starten (nur im laufenden Training)',
  dauer_heute: 'zahl = Minuten: Zeitbudget für heute',
  dauer_standard: 'zahl = Minuten: Standard-Trainingsdauer für künftige Tage',
  saetze: 'zahl = Anzahl, id optional: Sätze einer Übung im heutigen Training',
  wdh: 'zahl = min, zahl2 = max, id optional: Wiederholungsbereich einer Übung heute',
  ziel_rir: 'zahl = 0–4, id optional: Ziel-RIR einer Übung heute',
  uebung_tauschen: 'id = neue Übung, alt = alte Übung (optional, sonst aktuelle)',
  uebung_hinzufuegen: 'id = Übung, die heute zusätzlich drankommt',
  uebung_streichen: 'id = Übung, die heute wegfällt',
  aufwaermen_min: 'zahl = Minuten Aufwärmen in künftigen Plänen',
  finisher: 'zahl = 1 an / 0 aus: Kondition-Finisher in künftigen Plänen',
  ton: 'zahl = 1/0: Ton am Pausenende',
  vibration: 'zahl = 1/0: Vibration am Pausenende',
  bildschirm_an: 'zahl = 1/0: Bildschirm im Training anlassen',
  anleitungen: 'zahl = 1/0: Übungsanleitungen vorschlagen',
  koerpergewicht: 'zahl = kg',
  zeit_training: 'text = "HH:MM": übliche Trainingszeit',
  zeit_aufstehen: 'text = "HH:MM"',
  zeit_schlafen: 'text = "HH:MM"',
  supplement_hinzu: `id = ${SUPPS.map(([k]) => k).join('|')}: Supplement ins Profil aufnehmen`,
  supplement_weg: 'id = Supplement-Schlüssel: aus dem Profil entfernen',
  notiz_profil: 'text = kurzer Hinweis, der dauerhaft ins Profil (Einschränkungen/Wünsche) kommt, z. B. "Knie links empfindlich"',
};
export const ACTION_TYPES = Object.keys(ACTION_DOC);

const sec = (s) => (s % 60 === 0 && s >= 60 ? `${s / 60} Min` : s > 90 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} Min` : `${s} s`);
const hhmm = (t) => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(t ?? '').trim()) || /^(\d{1,2})$/.exec(String(t ?? '').trim());
  if (!m) return null;
  const h = +m[1], mi = +(m[2] ?? 0);
  return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : null;
};
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(+v.replace(',', '.')) ? +v.replace(',', '.') : null);

/**
 * Wendet Aktionen auf Kopien an.
 * @param ctx { settings, session (aktiv oder geplant, darf null sein), doneCount(uid) → Zahl, now }
 * @returns { settings, session, results: [{ ok, text }], settingsChanged, sessionChanged, todayBudget }
 */
export function applyActions(actions, ctx) {
  const settings = JSON.parse(JSON.stringify(ctx.settings));
  const session = ctx.session ? JSON.parse(JSON.stringify(ctx.session)) : null;
  const done = ctx.doneCount ?? (() => 0);
  const now = ctx.now ?? Date.now();
  const out = { settings, session, results: [], settingsChanged: false, sessionChanged: false, todayBudget: null };
  const t = settings.training, p = settings.profile;
  const okS = (text) => { out.settingsChanged = true; out.results.push({ ok: true, text }); };
  const okT = (text) => { out.sessionChanged = true; out.results.push({ ok: true, text }); };
  const fail = (text) => out.results.push({ ok: false, text });
  const active = session?.status === 'active';
  const openItems = () => (session?.items ?? []).filter((i) => i.status === 'open');

  /** Übung im heutigen Training finden (per id, sonst die aktuelle). */
  const target = (id) => {
    if (!session) return null;
    if (id) return openItems().find((i) => i.exerciseId === id) ?? session.items.find((i) => i.exerciseId === id) ?? null;
    return openItems().find((i) => i.uid === session.currentUid) ?? openItems().find((i) => i.kind === 'strength') ?? null;
  };
  const needSess = () => (session ? true : (fail('Heute ist noch kein Training geplant oder gestartet.'), false));
  const nextOpen = (afterUid) => {
    const idx = session.items.findIndex((i) => i.uid === afterUid);
    const open = openItems();
    return (open.find((i) => session.items.indexOf(i) > idx) ?? open[0])?.uid ?? null;
  };

  for (const a of (Array.isArray(actions) ? actions : []).slice(0, 8)) {
    const typ = a?.typ;
    const z = num(a?.zahl), z2 = num(a?.zahl2);
    const name = (id) => getEx(id).name;
    switch (typ) {
      case 'pause_grund':
      case 'pause_isolation': {
        if (z == null) { fail('Pause: keine Zeit erkannt.'); break; }
        const s = clamp(Math.round(z), 30, 600);
        const key = typ === 'pause_grund' ? 'restCompound' : 'restIsolation';
        const old = t[key];
        t[key] = s;
        okS(`Pause ${typ === 'pause_grund' ? 'Grundübungen' : 'Isolation'}: ${sec(old)} → ${sec(s)}`);
        if (session) {
          const isComp = (i) => getEx(i.exerciseId).kind === 'compound';
          let n = 0;
          for (const i of openItems()) if (i.kind === 'strength' && isComp(i) === (typ === 'pause_grund')) { i.restSec = s; n++; }
          if (n) { out.sessionChanged = true; out.results.at(-1).text += ` (auch heute, ${n} Übung${n === 1 ? '' : 'en'})`; }
        }
        break;
      }
      case 'pause_uebung': {
        if (z == null) { fail('Pause: keine Zeit erkannt.'); break; }
        if (!needSess()) break;
        const it = target(a.id);
        if (!it || it.kind !== 'strength') { fail('Pause: Übung nicht im heutigen Training gefunden.'); break; }
        const old = it.restSec;
        it.restSec = clamp(Math.round(z), 20, 600);
        okT(`Pause ${name(it.exerciseId)}: ${sec(old)} → ${sec(it.restSec)}`);
        break;
      }
      case 'pause_starten': {
        if (z == null) { fail('Pause: keine Zeit erkannt.'); break; }
        if (!active) { fail('Den Pausentimer gibt es nur im laufenden Training.'); break; }
        const s = clamp(Math.round(z), 10, 900);
        session.rest = { endAt: now + s * 1000, total: s, label: 'Pause' };
        okT(`Pausentimer läuft: ${sec(s)}`);
        break;
      }
      case 'dauer_heute': {
        if (z == null) { fail('Dauer: keine Minuten erkannt.'); break; }
        const m = clamp(Math.round(z), 15, 180);
        if (session) {
          const old = session.budgetMin;
          session.budgetMin = m;
          okT(`Zeitbudget heute: ${old} → ${m} Min${session.status === 'planned' ? ' (Tipp: „Neu planen“, damit die Übungen passen)' : ''}`);
        } else {
          out.todayBudget = m;
          out.results.push({ ok: true, text: `Zeitbudget heute: ${m} Min` });
        }
        break;
      }
      case 'dauer_standard': {
        if (z == null) { fail('Dauer: keine Minuten erkannt.'); break; }
        const m = clamp(Math.round(z), 15, 180);
        const old = t.defaultMin;
        t.defaultMin = m;
        okS(`Standard-Trainingsdauer: ${old} → ${m} Min`);
        break;
      }
      case 'saetze': {
        if (z == null) { fail('Sätze: keine Anzahl erkannt.'); break; }
        if (!needSess()) break;
        const it = target(a.id);
        if (!it || it.kind !== 'strength') { fail('Sätze: Übung nicht im heutigen Training gefunden.'); break; }
        const old = it.sets;
        it.sets = clamp(Math.round(z), Math.max(1, done(it.uid)), 10);
        okT(`${name(it.exerciseId)}: ${old} → ${it.sets} Sätze`);
        break;
      }
      case 'wdh': {
        if (z == null) { fail('Wiederholungen: keine Zahl erkannt.'); break; }
        if (!needSess()) break;
        const it = target(a.id);
        if (!it || it.kind !== 'strength') { fail('Wiederholungen: Übung nicht im heutigen Training gefunden.'); break; }
        const lo = clamp(Math.round(Math.min(z, z2 ?? z)), 1, 30);
        const hi = clamp(Math.round(Math.max(z, z2 ?? z)), lo, 30);
        it.repsMin = lo;
        it.repsMax = hi;
        okT(`${name(it.exerciseId)}: ${lo === hi ? lo : `${lo}–${hi}`} Wdh.`);
        break;
      }
      case 'ziel_rir': {
        if (z == null) { fail('RIR: keine Zahl erkannt.'); break; }
        if (!needSess()) break;
        const it = target(a.id);
        if (!it || it.kind !== 'strength') { fail('RIR: Übung nicht im heutigen Training gefunden.'); break; }
        it.rir = clamp(Math.round(z), 0, 4);
        okT(`${name(it.exerciseId)}: Ziel-RIR ${it.rir}`);
        break;
      }
      case 'uebung_tauschen': {
        if (!needSess()) break;
        if (!EX[a.id]) { fail('Tauschen: unbekannte Übung.'); break; }
        const cur = target(a.alt);
        if (!cur || cur.status !== 'open') { fail('Tauschen: alte Übung nicht im heutigen Training gefunden.'); break; }
        if (cur.exerciseId === a.id) { fail(`${name(a.id)} ist schon im Plan.`); break; }
        const fresh = makeItem(a.id, settings, { role: cur.role });
        if (fresh.kind === 'strength' && cur.kind === 'strength') Object.assign(fresh, { repsMin: cur.repsMin, repsMax: cur.repsMax, rir: cur.rir });
        const n = done(cur.uid);
        if (n) {
          if (fresh.kind === 'strength') fresh.sets = Math.max(1, (cur.sets ?? 3) - n);
          cur.sets = n;
          cur.status = 'done';
          session.items.splice(session.items.indexOf(cur) + 1, 0, fresh);
        } else {
          if (fresh.kind === 'strength' && cur.kind === 'strength') fresh.sets = cur.sets;
          fresh.uid = cur.uid;
          session.items[session.items.indexOf(cur)] = fresh;
        }
        if (session.currentUid === cur.uid || n) session.currentUid = fresh.uid;
        okT(`Getauscht: ${name(cur.exerciseId)} → ${name(a.id)}`);
        break;
      }
      case 'uebung_hinzufuegen': {
        if (!needSess()) break;
        if (!EX[a.id]) { fail('Hinzufügen: unbekannte Übung.'); break; }
        if (openItems().some((i) => i.exerciseId === a.id)) { fail(`${name(a.id)} ist schon im Plan.`); break; }
        const it = makeItem(a.id, settings);
        const cur = target(null);
        const pos = cur ? session.items.indexOf(cur) + 1 : session.items.length;
        session.items.splice(pos, 0, it);
        if (!cur) session.currentUid = it.uid;
        okT(`Hinzugefügt: ${name(a.id)}`);
        break;
      }
      case 'uebung_streichen': {
        if (!needSess()) break;
        const it = openItems().find((i) => i.exerciseId === a.id);
        if (!it) { fail('Streichen: Übung nicht (mehr) offen im Plan.'); break; }
        it.status = done(it.uid) > 0 ? 'done' : 'skipped';
        if (session.currentUid === it.uid) session.currentUid = nextOpen(it.uid);
        okT(`Gestrichen: ${name(a.id)}`);
        break;
      }
      case 'aufwaermen_min': {
        if (z == null) { fail('Aufwärmen: keine Minuten erkannt.'); break; }
        p.warmupMin = clamp(Math.round(z), 0, 20);
        okS(`Aufwärmen: ${p.warmupMin} Min`);
        break;
      }
      case 'finisher':
        p.finisher = z !== 0;
        okS(`Kondition-Finisher: ${p.finisher ? 'an' : 'aus'}`);
        break;
      case 'ton':
      case 'vibration':
      case 'bildschirm_an':
      case 'anleitungen': {
        const [key, label] = ONOFF[typ];
        t[key] = z !== 0;
        okS(`${label}: ${t[key] ? 'an' : 'aus'}`);
        break;
      }
      case 'koerpergewicht': {
        if (z == null || z < 30 || z > 250) { fail('Körpergewicht: bitte eine Zahl zwischen 30 und 250 kg.'); break; }
        const old = p.bodyweight;
        p.bodyweight = Math.round(z * 10) / 10;
        okS(`Körpergewicht: ${fmtNum(old)} → ${fmtNum(p.bodyweight)} kg`);
        break;
      }
      case 'zeit_training':
      case 'zeit_aufstehen':
      case 'zeit_schlafen': {
        const v = hhmm(a.text);
        if (!v) { fail('Uhrzeit nicht erkannt (Format HH:MM).'); break; }
        const [key, label] = TIMES[typ];
        p.day = { ...(p.day ?? {}) };
        const old = p.day[key];
        p.day[key] = v;
        okS(`${label}: ${old ?? '–'} → ${v} Uhr`);
        break;
      }
      case 'supplement_hinzu':
      case 'supplement_weg': {
        if (!SUPP_LABEL[a.id]) { fail('Supplement unbekannt.'); break; }
        const nu = (p.nutrition = { ...(p.nutrition ?? {}) });
        const list = new Set(nu.supps ?? []);
        if (typ === 'supplement_hinzu') list.add(a.id);
        else list.delete(a.id);
        nu.supps = [...list];
        okS(`Supplements: ${SUPP_LABEL[a.id]} ${typ === 'supplement_hinzu' ? 'hinzugefügt' : 'entfernt'}`);
        break;
      }
      case 'notiz_profil': {
        const txt = String(a.text ?? '').trim().slice(0, 160);
        if (!txt) { fail('Kein Hinweis angegeben.'); break; }
        if ((p.notes ?? '').includes(txt)) { fail('Steht schon im Profil.'); break; }
        p.notes = [p.notes, txt].filter(Boolean).join('; ').slice(0, 500);
        okS(`Im Profil gemerkt: „${txt}“`);
        break;
      }
      default:
        fail(`Unbekannte Aktion (${String(typ).slice(0, 30)}).`);
    }
  }
  return out;
}

// ---------- Einfache Befehle ohne KI (offline / ohne Schlüssel / Limit erreicht) ----------

const N = '(\\d+(?:[.,]\\d+)?)';
const toSec = (n, unit) => {
  const v = parseFloat(String(n).replace(',', '.'));
  return /^m/i.test(unit ?? '') ? Math.round(v * 60) : Math.round(v);
};
const onOff = (s) => (/\b(aus|ab|deaktiv|stumm|kein|nicht|stopp)/i.test(s) ? 0 : /\b(an|ein|aktiv)/i.test(s) ? 1 : null);

/**
 * Versteht einfache Befehle wie „Pause 2 Minuten“, „heute nur 40 Minuten“, „4 Sätze“, „Ton aus“.
 * @returns Liste von Aktionen oder null
 */
export function parseLocalCommand(text, { hasSession = false, active = false } = {}) {
  const s = String(text ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const acts = [];
  let m;

  if ((m = new RegExp(`pause[a-z]*\\D{0,25}?${N}\\s*(min|minute[n]?|s|sek|sekunde[n]?)?\\b`).exec(s))) {
    const unit = m[2] ?? (parseFloat(m[1]) <= 10 ? 'min' : 's');
    const zahl = toSec(m[1], unit);
    if (/(start|timer|jetzt|stell)/.test(s) && active) acts.push({ typ: 'pause_starten', zahl });
    else if (/(grund|verbund|schwer|compound)/.test(s)) acts.push({ typ: 'pause_grund', zahl });
    else if (/isolation/.test(s)) acts.push({ typ: 'pause_isolation', zahl });
    else if (/(immer|standard|alle|generell|grundsaetzlich)/.test(s) || !hasSession) acts.push({ typ: 'pause_grund', zahl }, { typ: 'pause_isolation', zahl });
    else acts.push({ typ: 'pause_uebung', zahl });
  }
  if ((m = new RegExp(`(training|dauer|zeit|budget|nur|habe|hab)\\D{0,25}?${N}\\s*(min|minute[n]?|std|stunde[n]?)\\b`).exec(s)) && !/pause/.test(s)) {
    const v = parseFloat(m[2].replace(',', '.')) * (/^st/.test(m[3]) ? 60 : 1);
    acts.push({ typ: /(immer|standard|normalerweise|kuenftig|ab jetzt)/.test(s) ? 'dauer_standard' : 'dauer_heute', zahl: Math.round(v) });
  }
  if ((m = /(\d+)\s*saetze/.exec(s))) acts.push({ typ: 'saetze', zahl: +m[1] });
  if ((m = /(\d+)\s*(?:-|–|bis)\s*(\d+)\s*(wdh|wiederholung)/.exec(s))) acts.push({ typ: 'wdh', zahl: +m[1], zahl2: +m[2] });
  if ((m = new RegExp(`(wiege|koerpergewicht|gewicht)\\D{0,15}?${N}\\s*kg`).exec(s))) acts.push({ typ: 'koerpergewicht', zahl: parseFloat(m[2].replace(',', '.')) });
  if ((m = new RegExp(`aufwaerm\\w*\\D{0,15}?${N}\\s*min`).exec(s))) acts.push({ typ: 'aufwaermen_min', zahl: Math.round(parseFloat(m[1])) });
  if ((m = /(trainiere|training)\D{0,30}?\b(?:um|ab)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(uhr)?/.exec(s)) && !/min/.test(s.slice(m.index, m.index + m[0].length + 6)))
    acts.push({ typ: 'zeit_training', text: `${m[2]}:${m[3] ?? '00'}` });
  for (const [word, typ] of [['ton', 'ton'], ['sound', 'ton'], ['vibration', 'vibration'], ['bildschirm', 'bildschirm_an'], ['anleitung', 'anleitungen'], ['finisher', 'finisher']]) {
    if (new RegExp(`\\b${word}`).test(s)) {
      const v = onOff(s);
      if (v != null) acts.push({ typ, zahl: v });
    }
  }
  return acts.length ? acts : null;
}

