// Kleiner JSON-Schema-Prüfer (Teilmenge: type, properties, required, items, enum,
// minimum, maximum, minItems, maxItems, maxLength). Reicht für die KI-Antworten.

export function validate(schema, value, path = '$') {
  const errors = [];
  check(schema, value, path, errors);
  return errors;
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function check(s, v, p, errs) {
  if (!s) return;
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : null;
  if (types) {
    const t = typeOf(v);
    const okType = types.some((x) => x === t || (x === 'number' && t === 'integer'));
    if (!okType) {
      errs.push(`${p}: erwartet ${types.join('|')}, erhalten ${t}`);
      return;
    }
  }
  if (s.enum && !s.enum.includes(v)) errs.push(`${p}: Wert nicht erlaubt (${JSON.stringify(v)})`);
  if (typeof v === 'number') {
    if (s.minimum != null && v < s.minimum) errs.push(`${p}: kleiner als ${s.minimum}`);
    if (s.maximum != null && v > s.maximum) errs.push(`${p}: größer als ${s.maximum}`);
  }
  if (typeof v === 'string' && s.maxLength != null && v.length > s.maxLength) errs.push(`${p}: Text zu lang`);
  if (Array.isArray(v)) {
    if (s.minItems != null && v.length < s.minItems) errs.push(`${p}: zu wenige Einträge`);
    if (s.maxItems != null && v.length > s.maxItems) errs.push(`${p}: zu viele Einträge`);
    if (s.items) v.forEach((x, i) => check(s.items, x, `${p}[${i}]`, errs));
  }
  if (typeOf(v) === 'object') {
    for (const r of s.required ?? []) if (!(r in v)) errs.push(`${p}.${r}: fehlt`);
    for (const [k, sub] of Object.entries(s.properties ?? {})) if (k in v) check(sub, v[k], `${p}.${k}`, errs);
  }
}
