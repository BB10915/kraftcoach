// Apple-Health-Werte übernehmen.
// Eine Web-App darf nicht direkt auf Apple Health zugreifen (das erlaubt Apple nur nativen Apps).
// Deshalb liest ein iPhone-Kurzbefehl die Werte aus Health und kopiert sie als Text;
// KraftCoach liest diesen Text aus der Zwischenablage. Format (Reihenfolge egal, Einheiten egal):
//   KraftCoach Health
//   ruhepuls: 58
//   hrv: 62
//   schlaf: 7,2
//   gewicht: 80,4
//   schritte: 8.500
//   aktivkcal: 450

const KEYS = {
  hr: ['ruhepuls', 'ruheherzfrequenz', 'resting'],
  hrv: ['hrv', 'herzfrequenzvariabilit'],
  sleep: ['schlaf', 'sleep'],
  weight: ['gewicht', 'weight', 'körpergewicht'],
  steps: ['schritte', 'steps'],
  activeKcal: ['aktivkcal', 'aktive energie', 'aktivenergie', 'active'],
};

/** Zahl aus "80,4 kg", "8.500", "58 count/min", "1,234.5" … */
export function parseLooseNumber(s, { integer = false } = {}) {
  const m = /-?\d[\d.,\s]*/.exec(String(s ?? ''));
  if (!m) return null;
  let t = m[0].replace(/\s/g, '').replace(/[.,]+$/, '');
  const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Das hintere Zeichen ist das Dezimaltrennzeichen: "1.234,5" oder "1,234.5"
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (integer && /^\d{1,3}([.,]\d{3})+$/.test(t)) {
    t = t.replace(/[.,]/g, ''); // Tausenderpunkt: "8.500"
  } else t = t.replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/** Schlafdauer in Stunden aus "7,2", "7:12", "7 h 12 min", "432" (Minuten) oder "25920" (Sekunden). */
export function parseSleep(s) {
  const str = String(s ?? '').toLowerCase();
  let m = /(\d{1,2}):(\d{2})/.exec(str);
  if (m) return +m[1] + +m[2] / 60;
  if (/\d[.,]\d/.test(str)) return parseLooseNumber(str); // "7,2" oder "7,2 h"
  m = /(\d{1,2})\s*(?:h|std|stunden?|hr)\D*(\d{1,2})?\s*(?:m|min)?/.exec(str);
  if (m && /h|std|stund|hr/.test(str)) return +m[1] + (m[2] ? +m[2] / 60 : 0);
  const n = parseLooseNumber(str);
  if (n == null) return null;
  if (n > 1440) return n / 3600; // Sekunden
  if (n > 24) return n / 60; // Minuten
  return n;
}

/**
 * Text aus dem Kurzbefehl auswerten.
 * @returns {{hr?, hrv?, sleepH?, weight?, steps?, activeKcal?}|null} null, wenn nichts erkannt wurde
 */
export function parseHealth(text) {
  const out = {};
  for (const line of String(text ?? '').split(/\r?\n|;/)) {
    const i = line.search(/[:=]/);
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (!val) continue;
    const kind = Object.entries(KEYS).find(([, ks]) => ks.some((k) => key.startsWith(k) || key.includes(k)))?.[0];
    if (!kind || out[kind === 'sleep' ? 'sleepH' : kind] != null) continue;
    if (kind === 'sleep') {
      const h = parseSleep(val);
      if (h != null && h > 0.5 && h <= 16) out.sleepH = Math.round(h * 10) / 10;
      continue;
    }
    const n = parseLooseNumber(val, { integer: kind === 'steps' || kind === 'activeKcal' || kind === 'hr' });
    if (n == null) continue;
    const ok = { hr: [30, 130], hrv: [5, 300], weight: [30, 250], steps: [0, 100000], activeKcal: [0, 8000] }[kind];
    if (n < ok[0] || n > ok[1]) continue;
    out[kind] = kind === 'weight' ? Math.round(n * 10) / 10 : Math.round(n);
  }
  return Object.keys(out).length ? out : null;
}

/** Schlafstunden → Auswahl im Check-in (5…9). */
export const sleepChip = (h) => (h == null ? null : h < 5.5 ? 5 : h >= 8.5 ? (h >= 8.75 ? 9 : 8) : Math.round(h));

/** Kurztext für Anzeige. */
export function healthText(h) {
  if (!h) return '';
  const f = (x) => String(x).replace('.', ',');
  return [
    h.hr && `Ruhepuls ${h.hr}`, h.hrv && `HRV ${h.hrv} ms`, h.sleepH && `Schlaf ${f(h.sleepH)} h`,
    h.weight && `${f(h.weight)} kg`, h.steps != null && `${h.steps.toLocaleString('de-DE')} Schritte`, h.activeKcal && `${h.activeKcal} kcal aktiv`,
  ].filter(Boolean).join(' · ');
}
