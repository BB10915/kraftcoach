// Tages-Coach: aus Profil (statisch) + Check-in (tagesaktuell) + Trainingsplan einen ganzen Tag planen:
// Morgen → vor dem Training → Training → danach → Abend, dazu Kalorien-, Makro- und Wasserziel.
// Allgemeine Faustregeln (Sporternährung), keine medizinische Beratung.

import { readiness, LEVEL_TEXT } from '../data/goals.js';
import { getEx } from '../data/exercises.js';

const num = (v) => (v == null || v === '' || Number.isNaN(+v) ? null : +v);
export const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  return m ? (+m[1] % 24) * 60 + Math.min(59, +m[2]) : null;
};
export const fmtT = (min) => {
  const m = ((Math.round(min / 5) * 5) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const r5 = (x) => Math.round(x / 5) * 5;
const r10 = (x) => Math.round(x / 10) * 10;
const fmtL = (l) => String(Math.round(l * 10) / 10).replace('.', ',');

/** Grundumsatz (kcal). Mit Körperfett: Katch-McArdle, sonst Mifflin-St Jeor. null, wenn Angaben fehlen. */
export function bmr(profile) {
  const w = num(profile.bodyweight);
  const b = profile.body ?? {};
  if (!w) return null;
  const bf = num(b.bodyfat);
  if (bf && bf > 3 && bf < 60) return 370 + 21.6 * w * (1 - bf / 100);
  const age = num(b.age), h = num(b.heightCm);
  if (!age || !h) return null;
  const sexOff = b.sex === 'm' ? 5 : b.sex === 'w' ? -161 : -78;
  return 10 * w + 6.25 * h - 5 * age + sexOff;
}

/**
 * Tagesziele für einen Trainingstag.
 * @returns {{kcal:number|null, tdee:number|null, protein:number, fat:number, carbs:number|null, carbsRange:string, waterL:number, notes:string[]}}
 */
export function nutritionTargets(profile, { trainingMin = 50, checkin = null, recovery = false } = {}) {
  const w = num(profile.bodyweight) || 75;
  const goals = profile.goals ?? [];
  const age = num(profile.body?.age);
  const minor = age != null && age < 18;
  const notes = [];
  const base = bmr(profile);
  const act = { sitzend: 1.35, gemischt: 1.5, koerperlich: 1.65 }[profile.day?.activity] ?? 1.4;
  const trainKcal = (recovery ? 0.05 : 0.08) * w * trainingMin;
  let tdee = base ? base * act + trainKcal : null;
  if (tdee && checkin?.loads?.length) tdee += 150 * checkin.loads.length;

  let adj = 0;
  const fat = goals.includes('fett'), muscle = goals.includes('muskel');
  if (fat && muscle) adj = -200;
  else if (fat) adj = -400;
  else if (muscle) adj = 250;
  if (minor && adj < 0) {
    adj = Math.max(adj, -200);
    notes.push('Im Wachstum: kein großes Kaloriendefizit – lieber ausreichend essen und über Training und Bewegung steuern.');
  }
  const kcal = tdee ? r10(tdee + adj) : null;

  let pPerKg = muscle || goals.includes('kraft') ? 1.8 : 1.6;
  if (fat) pPerKg = 2.0;
  if (minor) pPerKg = Math.min(pPerKg, 1.5);
  const protein = r5(Math.min(2.2, pPerKg) * w);
  const fatG = r5(0.9 * w);
  const carbs = kcal ? Math.max(r10(2 * w), r10((kcal - protein * 4 - fatG * 9) / 4)) : null;
  const carbsRange = `${Math.round(3 * w / 10) * 10}–${Math.round(5 * w / 10) * 10} g`;
  let waterL = 0.035 * w + 0.5 * (trainingMin / 60);
  if (checkin?.loads?.includes('unterwegs')) waterL += 0.3;
  waterL = Math.round(waterL * 10) / 10;

  const cur = num(profile.nutrition?.kcal);
  if (kcal && cur && Math.abs(cur - kcal) > 250) notes.push(`Du isst laut Profil ca. ${cur} kcal – für dein Ziel wären heute etwa ${kcal} kcal passend.`);
  const curP = num(profile.nutrition?.protein);
  if (curP && curP < protein * 0.8) notes.push(`Dein Protein (${curP} g) liegt unter dem Ziel von ~${protein} g – am einfachsten pro Mahlzeit eine Portion mehr.`);
  if (!kcal) notes.push('Für ein Kalorienziel fehlen Alter und Größe (Einstellungen → Körper).');
  return { kcal, tdee: tdee ? r10(tdee) : null, protein, fat: fatG, carbs, carbsRange, waterL, notes, minor };
}

/** Essensbeispiele passend zur Ernährungsform. */
function foods(diet = []) {
  if (diet.includes('vegan')) return { pre: 'Haferflocken mit Sojamilch und Banane oder Reis mit Tofu', snack: 'Banane, Reiswaffeln oder ein Müsliriegel', post: 'Linsen-/Kichererbsen-Bowl mit Reis oder Tofu-Pfanne', protein: 'Tofu, Tempeh, Linsen, Sojajoghurt', breakfast: 'Haferflocken mit Sojajoghurt und Beeren' };
  if (diet.includes('vegetarisch')) return { pre: 'Reis oder Nudeln mit Ei/Tofu und Gemüse', snack: 'Banane, Skyr oder Reiswaffeln', post: 'Kartoffeln mit Quark, Omelett mit Brot oder Linsen-Bowl', protein: 'Skyr, Quark, Eier, Hüttenkäse, Linsen', breakfast: 'Skyr oder Quark mit Haferflocken und Obst, oder Rührei mit Brot' };
  const lf = diet.includes('laktosefrei');
  return {
    pre: 'Reis, Nudeln oder Kartoffeln mit Hähnchen/Fisch und etwas Gemüse',
    snack: lf ? 'Banane oder Reiswaffeln' : 'Banane, Joghurt oder Reiswaffeln',
    post: 'Hähnchen, Fisch oder mageres Fleisch mit Reis/Kartoffeln und Gemüse',
    protein: lf ? 'Hähnchen, Fisch, Eier, laktosefreier Skyr' : 'Hähnchen, Fisch, Eier, Skyr, Quark',
    breakfast: lf ? 'Haferflocken mit laktosefreiem Joghurt, oder Eier mit Brot' : 'Haferflocken mit Skyr/Quark und Obst, oder Eier mit Vollkornbrot',
  };
}

/**
 * Den ganzen Tag planen.
 * @param session geplantes/aktives Training (items, budgetMin, title) oder null
 * @param ai optionale Texte der KI: { kernaussage, abschnitte: [{key, punkte}] }
 */
export function planDay({ settings, checkin = null, session = null, ai = null }) {
  const p = settings.profile;
  const d = p.day ?? {};
  const supps = p.nutrition?.supps ?? [];
  const goals = p.goals ?? [];
  const ready = readiness(checkin, p);
  const recovery = session?.title === 'Regeneration' || ready.level === 'regeneration' && checkin?.wish === 'regen';
  const trainingMin = session?.budgetMin ?? settings.training.defaultMin ?? 50;
  const t = nutritionTargets(p, { trainingMin, checkin, recovery });
  const f = foods(p.nutrition?.diet);
  const meals = Math.max(2, Math.min(6, num(p.nutrition?.meals) || 3));
  const perMeal = r5(t.protein / meals);
  const age = num(p.body?.age);

  const wake = toMin(d.wake) ?? 7 * 60;
  let bed = toMin(d.bed) ?? 23 * 60;
  if (bed <= wake) bed += 1440;
  let train = toMin(checkin?.trainTime) ?? toMin(d.trainTime) ?? 17 * 60 + 30;
  if (train < wake) train += 1440;
  const end = train + trainingMin;
  const commute = num(d.commuteMin) ?? 0;
  const leave = train - commute;
  const early = train - wake < 120; // Training kurz nach dem Aufstehen
  const caffeineOk = supps.includes('koffein') && !(age != null && age < 18);
  const caffeineLate = train > bed - 8 * 60;
  const sleptBadly = checkin?.sleep === 'schlecht' || (checkin?.sleepH && checkin.sleepH <= 6);
  const sleepNeed = age != null && age < 18 ? 9 * 60 : 8 * 60;
  const targetBed = Math.min(bed, wake + 1440 - sleepNeed - (sleptBadly ? 30 : 0));

  const blocks = [];
  // --- Morgen
  const morning = ['Nach dem Aufstehen 300–500 ml Wasser trinken.'];
  if (early) morning.push(`Training schon um ${fmtT(train)}: vorher nur ein leichter Snack (${f.snack}), richtig frühstücken danach.`);
  else morning.push(`Frühstück mit ~${perMeal} g Protein, z. B. ${f.breakfast}.`);
  morning.push('10 Minuten Tageslicht (Spaziergang, Fenster) – stabilisiert deinen Schlafrhythmus.');
  if (supps.includes('kreatin')) morning.push('3–5 g Kreatin – täglich, Zeitpunkt egal (z. B. zum Frühstück).');
  if (supps.includes('vitd') || supps.includes('omega3')) morning.push(`${[supps.includes('vitd') && 'Vitamin D', supps.includes('omega3') && 'Omega-3'].filter(Boolean).join(' und ')} zu einer fetthaltigen Mahlzeit.`);
  if (sleptBadly) morning.push('Schlecht geschlafen: kein Ausschlafen bis mittags – lieber ein Powernap (max. 20 Min) vor 15 Uhr.');
  blocks.push({ key: 'morgen', icon: '🌅', title: 'Morgenroutine', time: `${fmtT(wake)}–${fmtT(wake + 60)}`, items: morning });

  // --- Vor dem Training
  const pre = [];
  if (!early) pre.push(`Mahlzeit ca. 2–3 h vorher (gegen ${fmtT(train - 150)}): ${f.pre} – Kohlenhydrate + Protein, wenig Fett und Ballaststoffe.`);
  if (checkin?.lastMeal === 'gt4' || checkin?.ate === 'wenig') pre.push(`Deine letzte Mahlzeit ist länger her: 30–60 Min vorher noch einen schnellen Snack (${f.snack}).`);
  else if (checkin?.lastMeal === 'lt1') pre.push('Du hast gerade erst gegessen – Aufwärmen etwas länger und ruhiger angehen.');
  else pre.push(`Falls es knapp wird: Snack 30–60 Min vorher (${f.snack}).`);
  pre.push('In den 2 Stunden davor 300–500 ml trinken.');
  if (caffeineOk) {
    pre.push(caffeineLate
      ? 'Heute kein Koffein mehr vor dem Training – zu nah an der Schlafenszeit.'
      : `Optional Kaffee/Koffein 30–60 Min vorher (max. ~${r10(3 * (num(p.bodyweight) || 75))} mg).`);
  }
  if (commute > 0) pre.push(`Losfahren um ${fmtT(leave)} (${commute} Min Weg).`);
  if (d.occupation !== 'frei' && toMin(d.workTo) != null && train < toMin(d.workTo) && train > (toMin(d.workFrom) ?? 0)) {
    pre.push(`Achtung: ${fmtT(train)} liegt in deiner ${d.occupation === 'schule' ? 'Schul' : 'Arbeits'}zeit – Trainingszeit im Check-in anpassen?`);
  }
  blocks.push({ key: 'vor', icon: '🍽️', title: 'Vor dem Training', time: `${fmtT(train - 180)}–${fmtT(train)}`, items: pre });

  // --- Training
  const tr = [];
  const lv = LEVEL_TEXT[ready.level];
  if (session) {
    const strength = (session.items ?? []).filter((i) => i.kind === 'strength');
    tr.push(`${session.title || 'Training'} – ${trainingMin} Min${strength.length ? `, ${strength.length} Übungen (${strength.slice(0, 3).map((i) => getEx(i.exerciseId).name.replace(/ \(.*\)$/, '')).join(', ')}${strength.length > 3 ? ' …' : ''})` : ''}.`);
  } else tr.push(`Training ca. ${trainingMin} Min – Plan oben erstellen.`);
  tr.push(`${lv[0]}: ${lv[1]}`);
  tr.push('Während des Trainings ca. 0,5 l Wasser trinken.');
  if (p.cond?.partner === 'partner') tr.push('Mit Partner: Pausen nicht verquatschen – der Timer hilft.');
  blocks.push({ key: 'training', icon: '🏋️', title: recovery ? 'Regeneration' : 'Training', time: `${fmtT(train)}–${fmtT(end)}`, items: tr });

  // --- Danach
  const post = [`Innerhalb von 1–2 h eine Mahlzeit mit ~${r5(Math.max(25, 0.4 * (num(p.bodyweight) || 75)))} g Protein + Kohlenhydraten, z. B. ${f.post}.`];
  if (supps.includes('protein')) post.push('Proteinshake ist praktisch, wenn die nächste Mahlzeit mehr als 2 h entfernt ist.');
  post.push('Flüssigkeit auffüllen: in den 2 h danach ca. 0,5–0,75 l.');
  if (checkin?.sore?.length || goals.includes('beweglichkeit')) post.push('5 Min lockeres Auslaufen oder Dehnen der trainierten Muskeln.');
  blocks.push({ key: 'nach', icon: '🥤', title: 'Nach dem Training', time: `${fmtT(end)}–${fmtT(end + 120)}`, items: post });

  // --- Abend
  const eve = [];
  const dinner = Math.min(bed - 150, Math.max(end + 60, bed - 210));
  if (end + 60 >= bed - 120) eve.push('Training spät: die Mahlzeit danach ist dein Abendessen – leicht verdaulich, mit Protein.');
  else if (dinner - end < 180) eve.push(`Die Mahlzeit nach dem Training (gegen ${fmtT(end + 75)}) ist gleichzeitig dein Abendessen – bei Hunger später noch ein kleiner Protein-Snack.`);
  else eve.push(`Abendessen gegen ${fmtT(dinner)} – bis ca. 2–3 h vor dem Schlafen.`);
  if (goals.includes('beweglichkeit') || goals.includes('gesundheit') || checkin?.sore?.length) eve.push('10 Min Mobility (Hüfte, Brustwirbelsäule, Schultern) – ideal vor dem Fernseher.');
  if (supps.includes('magnesium')) eve.push('Magnesium am Abend.');
  if (supps.includes('protein') || goals.includes('muskel')) eve.push(`Optional vor dem Schlafen: langsames Protein (z. B. ${f.protein.split(', ').slice(-2).join(' oder ')}).`);
  eve.push('30–60 Min vor dem Schlafen Bildschirm runter, Raum kühl und dunkel.');
  eve.push(`Ins Bett um ${fmtT(targetBed)} → ${Math.round(sleepNeed / 60)} h Schlaf bis ${fmtT(wake)}${sleptBadly ? ' (heute etwas früher, um aufzuholen)' : ''}.`);
  blocks.push({ key: 'abend', icon: '🌙', title: 'Abendroutine', time: `${fmtT(Math.max(end + 120, bed - 240))}–${fmtT(targetBed)}`, items: eve });

  // KI-Texte übernehmen (Zeiten und Zahlen bleiben lokal berechnet)
  if (ai?.abschnitte?.length) {
    for (const a of ai.abschnitte) {
      const b = blocks.find((x) => x.key === a.key);
      const pts = (a.punkte ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 6);
      if (b && pts.length) { b.items = pts; b.ai = true; }
    }
  }
  return {
    level: ready.level, levelTitle: lv[0], levelText: ai?.kernaussage || lv[1], reasons: ready.reasons,
    targets: t, blocks,
  };
}

/** Kurztext der Tagesziele für den KI-Prompt. */
export function targetsText(t) {
  return `${t.kcal ? `${t.kcal} kcal, ` : ''}${t.protein} g Protein, ${t.carbs ? `${t.carbs} g` : t.carbsRange} Kohlenhydrate, ${t.fat} g Fett, ${fmtL(t.waterL)} l Wasser`;
}
export { fmtL };
