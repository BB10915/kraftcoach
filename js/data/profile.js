// Erweitertes Profil (statische Daten): Körper, Ziele, Historie, Ernährung, Tagesablauf, Bedingungen.
// Alles optional – je mehr ausgefüllt ist, desto genauer werden Tages- und Ernährungsplan.

import { MUSCLES } from './exercises.js';
import { goalsText } from './goals.js';

export const PROFILE_DEFAULTS = {
  body: { age: null, sex: '', heightCm: null, bodyfat: null, muscleKg: null, fitness: 'mittel', restingHr: null, hrv: null },
  aims: { perf: '', priority: [], short: '', long: '' },
  hist: { years: null, split: '', sports: '' },
  nutrition: { kcal: null, protein: null, carbs: null, fat: null, diet: [], avoid: '', meals: 3, waterL: null, supps: [] },
  day: { wake: '07:00', bed: '23:00', occupation: 'arbeit', activity: 'sitzend', workFrom: '08:00', workTo: '16:30', trainTime: '17:30', commuteMin: 15, foodAccess: '', duties: '' },
  cond: { place: 'studio', partner: 'allein', intensity: 'normal', gear: '' },
};

export const SEX = [['m', 'Männlich'], ['w', 'Weiblich'], ['d', 'Divers']];
export const FITNESS = [['niedrig', 'Eher unfit'], ['mittel', 'Mittel'], ['hoch', 'Sehr fit']];
export const DIETS = [['vegetarisch', 'Vegetarisch'], ['vegan', 'Vegan'], ['laktosefrei', 'Laktosefrei'], ['glutenfrei', 'Glutenfrei'], ['halal', 'Halal']];
export const SUPPS = [['kreatin', 'Kreatin'], ['protein', 'Proteinpulver'], ['koffein', 'Koffein/Kaffee'], ['omega3', 'Omega-3'], ['vitd', 'Vitamin D'], ['magnesium', 'Magnesium']];
export const OCCUPATION = [['schule', 'Schule/Ausbildung'], ['arbeit', 'Arbeit'], ['studium', 'Studium'], ['frei', 'Flexibel/frei']];
export const ACTIVITY = [['sitzend', 'Meist sitzend'], ['gemischt', 'Gemischt'], ['koerperlich', 'Körperlich aktiv']];
export const PLACE = [['studio', 'Fitnessstudio'], ['home', 'Homegym']];
export const PARTNER = [['allein', 'Allein'], ['partner', 'Mit Partner']];
export const INTENSITY = [['locker', 'Eher locker'], ['normal', 'Normal'], ['hart', 'Richtig hart']];

const lbl = (list, k) => list.find(([v]) => v === k)?.[1] ?? k;
const n = (v) => v != null && v !== '' && !Number.isNaN(+v);

/** Kompakter Profiltext für den KI-Prompt (nur ausgefüllte Angaben). */
export function profileText(p) {
  const b = p.body ?? {}, a = p.aims ?? {}, h = p.hist ?? {}, nu = p.nutrition ?? {}, d = p.day ?? {}, c = p.cond ?? {};
  const L = [];
  const body = [
    n(b.age) && `${b.age} Jahre`, b.sex && lbl(SEX, b.sex), n(b.heightCm) && `${b.heightCm} cm`, n(p.bodyweight) && `${p.bodyweight} kg`,
    n(b.bodyfat) && `KFA ${b.bodyfat} %`, n(b.muscleKg) && `Muskelmasse ${b.muscleKg} kg`, `Fitness ${lbl(FITNESS, b.fitness)}`,
    n(b.restingHr) && `Ruhepuls normal ${b.restingHr}`, n(b.hrv) && `HRV normal ${b.hrv} ms`,
  ].filter(Boolean);
  L.push(`Körper: ${body.join(', ')}`);
  L.push(`Einschränkungen: ${p.notes || 'keine'}`);
  L.push(`Ziele: ${goalsText(p) || '–'}`);
  if (a.perf) L.push(`Leistungsziele: ${a.perf}`);
  if (a.priority?.length) L.push(`Priorisierte Muskeln: ${a.priority.map((m) => MUSCLES[m]).join(', ')}`);
  if (a.short) L.push(`Kurzfristig: ${a.short}`);
  if (a.long) L.push(`Langfristig: ${a.long}`);
  L.push(`Erfahrung: ${p.experience}${n(h.years) ? `, trainiert seit ${h.years} Jahren` : ''}, ${p.daysPerWeek}× pro Woche${h.split ? `, Split: ${h.split}` : ''}`);
  if (h.sports) L.push(`Weitere Sportarten: ${h.sports}`);
  const nut = [
    n(nu.kcal) && `${nu.kcal} kcal/Tag`, n(nu.protein) && `${nu.protein} g Protein`, n(nu.carbs) && `${nu.carbs} g KH`, n(nu.fat) && `${nu.fat} g Fett`,
    `${nu.meals || 3} Mahlzeiten`, n(nu.waterL) && `${nu.waterL} l Wasser`,
  ].filter(Boolean);
  L.push(`Ernährung aktuell: ${nut.join(', ')}`);
  if (nu.diet?.length) L.push(`Ernährungsform: ${nu.diet.map((k) => lbl(DIETS, k)).join(', ')}`);
  if (nu.avoid) L.push(`Vorlieben/Unverträglichkeiten: ${nu.avoid}`);
  L.push(`Supplements: ${nu.supps?.length ? nu.supps.map((k) => lbl(SUPPS, k)).join(', ') : 'keine'}`);
  L.push(`Tagesablauf: auf ${d.wake}, Bett ${d.bed}, ${lbl(OCCUPATION, d.occupation)}${d.occupation !== 'frei' ? ` ${d.workFrom}–${d.workTo}` : ''} (${lbl(ACTIVITY, d.activity)}), Training meist ${d.trainTime}, Weg zum Gym ${d.commuteMin ?? 0} Min`);
  if (d.foodAccess) L.push(`Essen tagsüber: ${d.foodAccess}`);
  if (d.duties) L.push(`Verpflichtungen: ${d.duties}`);
  L.push(`Bedingungen: ${lbl(PLACE, c.place)}, ${lbl(PARTNER, c.partner)}, gewünschte Intensität ${lbl(INTENSITY, c.intensity)}${c.gear ? `, Geräte/Gewichte: ${c.gear}` : ''}`);
  return L.join('\n');
}

/** Wie vollständig ist das Profil? (für Hinweise in der App) */
export function profileCompleteness(p) {
  const checks = [p.body?.age, p.body?.sex, p.body?.heightCm, p.bodyweight, p.day?.wake, p.day?.trainTime, p.nutrition?.meals];
  return checks.filter((v) => v != null && v !== '').length / checks.length;
}
