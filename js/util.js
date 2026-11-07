// Kleine Hilfsfunktionen ohne DOM-Abhängigkeit (auch in Tests nutzbar).

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Rundet auf ein Vielfaches von step (z. B. 2,5 kg) ohne Gleitkomma-Krümel. */
export function roundTo(x, step, mode = 'round') {
  if (!step) return x;
  const f = mode === 'floor' ? Math.floor : mode === 'ceil' ? Math.ceil : Math.round;
  return Math.round(f(x / step + 1e-9) * step * 1000) / 1000;
}

/** Zahl deutsch formatieren: 62.5 -> "62,5" */
export function fmtNum(n, digits = 1) {
  if (n == null || !isFinite(n)) return '–';
  const p = 10 ** digits;
  const r = Math.round(n * p) / p;
  return String(r).replace('.', ',');
}

/** "62,5" oder "62.5" -> 62.5 ; ungültig -> null */
export function parseNum(s) {
  const n = parseFloat(String(s ?? '').trim().replace(',', '.'));
  return isFinite(n) ? n : null;
}

export const pad2 = (n) => String(n).padStart(2, '0');

/** Sekunden -> "m:ss" bzw. "h:mm:ss" */
export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Sekunden -> "12 Min" */
export const fmtMin = (sec) => `${Math.max(0, Math.round(sec / 60))} Min`;

/** Lokaler Tagesschlüssel YYYY-MM-DD */
export function dayKey(d) {
  d = new Date(d);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Montag 00:00 der Woche von d (lokal) */
export function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7; // Mo=0
  x.setDate(x.getDate() - wd);
  return x;
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
export const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** "Sa, 7. Nov." */
export function fmtDate(d) {
  d = new Date(d);
  return `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`;
}
/** "7.11." */
export function fmtDateShort(d) {
  d = new Date(d);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export const DAY = 86400000;
export const daysSince = (ts, now = Date.now()) => (now - new Date(ts).getTime()) / DAY;

export function relDays(ts, now = Date.now()) {
  const a = new Date(dayKey(now)).getTime();
  const b = new Date(dayKey(ts)).getTime();
  const d = Math.round((a - b) / DAY);
  if (d <= 0) return 'heute';
  if (d === 1) return 'gestern';
  return `vor ${d} Tagen`;
}

export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);

export function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}
