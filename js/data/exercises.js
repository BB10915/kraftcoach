// Übungskatalog. Die KI darf nur IDs aus dieser Liste wählen.

export const MUSCLES = {
  chest: 'Brust',
  lats: 'Latissimus',
  upperback: 'Oberer Rücken',
  shoulders: 'Schultern',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  glutes: 'Gesäß',
  calves: 'Waden',
  core: 'Rumpf',
  lowerback: 'Unterer Rücken',
};

/** Muskeln, die mehr Erholung brauchen (Stunden). */
export const RECOVERY_H = {
  chest: 60, lats: 60, upperback: 60, quads: 72, hamstrings: 72, glutes: 72, lowerback: 72,
  shoulders: 48, biceps: 48, triceps: 48, calves: 48, core: 36,
};

export const EQUIPMENT = {
  lh: 'Langhantel',
  kh: 'Kurzhanteln',
  ma: 'Maschinen',
  kz: 'Kabelzug',
  kg: 'Körpergewicht / Klimmzugstange / Dipbarren',
  kb: 'Kettlebells',
  ca: 'Cardio-Geräte',
};

const STEP = { lh: 2.5, kh: 2, ma: 5, kz: 2.5, kg: 2.5, kb: 4, ca: 0 };

export const PATTERNS = {
  squat: { label: 'Kniebeuge', muscles: ['quads', 'glutes'], region: 'lower' },
  hinge: { label: 'Hüftstreckung', muscles: ['hamstrings', 'glutes', 'lowerback'], region: 'lower' },
  lunge: { label: 'Ausfallschritt', muscles: ['quads', 'glutes'], region: 'lower' },
  kneeext: { label: 'Beinstrecken', muscles: ['quads'], region: 'lower' },
  kneeflex: { label: 'Beinbeugen', muscles: ['hamstrings'], region: 'lower' },
  calf: { label: 'Waden', muscles: ['calves'], region: 'lower' },
  glute: { label: 'Gesäß', muscles: ['glutes'], region: 'lower' },
  hpush: { label: 'Drücken horizontal', muscles: ['chest', 'triceps'], region: 'push' },
  vpush: { label: 'Drücken vertikal', muscles: ['shoulders', 'triceps'], region: 'push' },
  fly: { label: 'Brust isoliert', muscles: ['chest'], region: 'push' },
  lateral: { label: 'Seitheben', muscles: ['shoulders'], region: 'push' },
  triceps: { label: 'Trizeps', muscles: ['triceps'], region: 'push' },
  hpull: { label: 'Rudern', muscles: ['upperback', 'lats'], region: 'pull' },
  vpull: { label: 'Ziehen vertikal', muscles: ['lats', 'biceps'], region: 'pull' },
  reardelt: { label: 'Hintere Schulter', muscles: ['shoulders', 'upperback'], region: 'pull' },
  biceps: { label: 'Bizeps', muscles: ['biceps'], region: 'pull' },
  core: { label: 'Rumpf', muscles: ['core'], region: 'core' },
  cardio: { label: 'Kondition', muscles: [], region: 'cardio' },
  mobility: { label: 'Beweglichkeit', muscles: [], region: 'mobility' },
};

/**
 * Kraftübung.
 * start = vorsichtiges Startgewicht (kg) für Fortgeschrittene zur Kalibrierung
 *         (bei Kurzhanteln pro Hand, bei Körpergewicht = Zusatzgewicht)
 */
function S(id, name, eq, kind, pattern, primary, secondary, start, o = {}) {
  return {
    id, name, eq, kind, pattern, primary, secondary, start,
    step: o.step ?? STEP[eq],
    bw: o.bw ?? 0, // Anteil Körpergewicht an der Last (Klimmzug 1.0, Liegestütz 0.65)
    perHand: o.perHand ?? eq === 'kh',
    secPerRep: o.spr ?? (kind === 'compound' ? 4 : 3),
    setup: o.setup ?? (eq === 'lh' ? 90 : 40),
    main: !!o.main, // eignet sich als Hauptübung am Anfang der Einheit
    timed: false,
  };
}

/** Zeitbasierte Übung (Kondition / Beweglichkeit). */
function T(id, name, eq, kind, text) {
  return { id, name, eq, kind, pattern: kind, primary: [], secondary: [], timed: true, text, step: 0, setup: 30 };
}

export const EXERCISES = [
  // Unterkörper – Kniebeuge
  S('lh-kniebeuge', 'Kniebeuge (Langhantel)', 'lh', 'compound', 'squat', ['quads', 'glutes'], ['core', 'lowerback', 'hamstrings'], 40, { main: true, setup: 120 }),
  S('lh-frontkniebeuge', 'Frontkniebeuge (Langhantel)', 'lh', 'compound', 'squat', ['quads'], ['glutes', 'core', 'upperback'], 30, { main: true, setup: 120 }),
  S('ma-hackenschmidt', 'Hackenschmidt-Kniebeuge', 'ma', 'compound', 'squat', ['quads', 'glutes'], [], 40, { main: true, setup: 60 }),
  S('ma-beinpresse', 'Beinpresse', 'ma', 'compound', 'squat', ['quads', 'glutes'], ['hamstrings'], 60, { main: true, setup: 60 }),
  S('kh-goblet', 'Goblet Squat (Kurzhantel)', 'kh', 'compound', 'squat', ['quads', 'glutes'], ['core'], 16, { perHand: false }),
  // Unterkörper – Hüfte
  S('lh-kreuzheben', 'Kreuzheben (Langhantel)', 'lh', 'compound', 'hinge', ['hamstrings', 'glutes', 'lowerback'], ['upperback', 'core', 'quads'], 60, { main: true, setup: 120, spr: 5 }),
  S('lh-rdl', 'Rumänisches Kreuzheben (Langhantel)', 'lh', 'compound', 'hinge', ['hamstrings', 'glutes'], ['lowerback', 'upperback'], 40, { main: true }),
  S('kh-rdl', 'Rumänisches Kreuzheben (Kurzhanteln)', 'kh', 'compound', 'hinge', ['hamstrings', 'glutes'], ['lowerback'], 16),
  S('lh-hipthrust', 'Hip Thrust (Langhantel)', 'lh', 'compound', 'glute', ['glutes'], ['hamstrings'], 40, { setup: 120 }),
  S('kg-hyperext', 'Hyperextensions (Rückenstrecker)', 'kg', 'isolation', 'hinge', ['lowerback', 'glutes'], ['hamstrings'], 0, { bw: 0.5 }),
  S('ma-abduktoren', 'Abduktoren-Maschine', 'ma', 'isolation', 'glute', ['glutes'], [], 30),
  // Unterkörper – einbeinig
  S('kh-ausfallschritt', 'Ausfallschritte (Kurzhanteln)', 'kh', 'compound', 'lunge', ['quads', 'glutes'], ['hamstrings', 'core'], 12, { spr: 5 }),
  S('kh-bulgarisch', 'Bulgarische Split-Kniebeuge (Kurzhanteln)', 'kh', 'compound', 'lunge', ['quads', 'glutes'], ['core'], 10, { spr: 6 }),
  // Unterkörper – isoliert
  S('ma-beinstrecker', 'Beinstrecker (Maschine)', 'ma', 'isolation', 'kneeext', ['quads'], [], 25),
  S('ma-beinbeuger-sitz', 'Beinbeuger sitzend (Maschine)', 'ma', 'isolation', 'kneeflex', ['hamstrings'], [], 25),
  S('ma-beinbeuger-lieg', 'Beinbeuger liegend (Maschine)', 'ma', 'isolation', 'kneeflex', ['hamstrings'], [], 20),
  S('ma-waden-stehend', 'Wadenheben stehend (Maschine)', 'ma', 'isolation', 'calf', ['calves'], [], 40, { spr: 2.5 }),
  S('ma-waden-sitzend', 'Wadenheben sitzend (Maschine)', 'ma', 'isolation', 'calf', ['calves'], [], 20, { spr: 2.5 }),
  // Drücken horizontal
  S('lh-bankdruecken', 'Bankdrücken (Langhantel)', 'lh', 'compound', 'hpush', ['chest'], ['triceps', 'shoulders'], 40, { main: true }),
  S('kh-bankdruecken', 'Bankdrücken (Kurzhanteln)', 'kh', 'compound', 'hpush', ['chest'], ['triceps', 'shoulders'], 16, { main: true }),
  S('lh-schraegbank', 'Schrägbankdrücken (Langhantel)', 'lh', 'compound', 'hpush', ['chest', 'shoulders'], ['triceps'], 30, { main: true }),
  S('kh-schraegbank', 'Schrägbankdrücken (Kurzhanteln)', 'kh', 'compound', 'hpush', ['chest', 'shoulders'], ['triceps'], 14),
  S('ma-brustpresse', 'Brustpresse (Maschine)', 'ma', 'compound', 'hpush', ['chest'], ['triceps', 'shoulders'], 30),
  S('kg-dips', 'Dips', 'kg', 'compound', 'hpush', ['chest', 'triceps'], ['shoulders'], 0, { bw: 1 }),
  S('kg-liegestuetz', 'Liegestütze', 'kg', 'compound', 'hpush', ['chest'], ['triceps', 'shoulders', 'core'], 0, { bw: 0.65, spr: 2.5 }),
  // Drücken vertikal
  S('lh-schulterdruecken', 'Schulterdrücken stehend (Langhantel)', 'lh', 'compound', 'vpush', ['shoulders'], ['triceps', 'core'], 25, { main: true }),
  S('kh-schulterdruecken', 'Schulterdrücken (Kurzhanteln)', 'kh', 'compound', 'vpush', ['shoulders'], ['triceps'], 12, { main: true }),
  S('ma-schulterpresse', 'Schulterpresse (Maschine)', 'ma', 'compound', 'vpush', ['shoulders'], ['triceps'], 25),
  // Ziehen horizontal
  S('lh-rudern', 'Langhantelrudern vorgebeugt', 'lh', 'compound', 'hpull', ['upperback', 'lats'], ['biceps', 'lowerback'], 40, { main: true }),
  S('kh-rudern', 'Einarmiges Kurzhantelrudern', 'kh', 'compound', 'hpull', ['upperback', 'lats'], ['biceps'], 20, { spr: 5 }),
  S('kz-rudern', 'Rudern am Kabel sitzend', 'kz', 'compound', 'hpull', ['upperback', 'lats'], ['biceps'], 40, { main: true, step: 5 }),
  S('ma-rudern', 'Rudern an der Maschine (brustgestützt)', 'ma', 'compound', 'hpull', ['upperback', 'lats'], ['biceps'], 30, { main: true }),
  // Ziehen vertikal
  S('kg-klimmzug', 'Klimmzüge', 'kg', 'compound', 'vpull', ['lats'], ['biceps', 'upperback'], 0, { bw: 1, main: true }),
  S('kz-latziehen', 'Latziehen breit', 'kz', 'compound', 'vpull', ['lats'], ['biceps', 'upperback'], 40, { main: true, step: 5 }),
  S('kz-latziehen-eng', 'Latziehen enger Griff', 'kz', 'compound', 'vpull', ['lats'], ['biceps', 'upperback'], 40, { step: 5 }),
  // Brust / Schulter isoliert
  S('kz-crossover', 'Cable Crossover', 'kz', 'isolation', 'fly', ['chest'], [], 10),
  S('ma-butterfly', 'Butterfly (Maschine)', 'ma', 'isolation', 'fly', ['chest'], [], 30),
  S('kh-seitheben', 'Seitheben (Kurzhanteln)', 'kh', 'isolation', 'lateral', ['shoulders'], [], 6, { step: 1 }),
  S('kz-seitheben', 'Seitheben am Kabel', 'kz', 'isolation', 'lateral', ['shoulders'], [], 5),
  S('kz-facepull', 'Face Pulls (Kabel)', 'kz', 'isolation', 'reardelt', ['shoulders', 'upperback'], [], 15),
  S('ma-reverse-butterfly', 'Reverse Butterfly (Maschine)', 'ma', 'isolation', 'reardelt', ['shoulders', 'upperback'], [], 20),
  // Arme
  S('kh-bizepscurl', 'Bizepscurls (Kurzhanteln)', 'kh', 'isolation', 'biceps', ['biceps'], [], 10),
  S('kh-hammercurl', 'Hammercurls (Kurzhanteln)', 'kh', 'isolation', 'biceps', ['biceps'], [], 10),
  S('lh-curl', 'Langhantelcurls (SZ-Stange)', 'lh', 'isolation', 'biceps', ['biceps'], [], 20, { setup: 40 }),
  S('kz-bizepscurl', 'Bizepscurls am Kabel', 'kz', 'isolation', 'biceps', ['biceps'], [], 15),
  S('kz-trizepsdruecken', 'Trizepsdrücken am Kabel', 'kz', 'isolation', 'triceps', ['triceps'], [], 20),
  S('kz-trizeps-ueberkopf', 'Trizepsstrecken über Kopf (Kabel)', 'kz', 'isolation', 'triceps', ['triceps'], [], 15),
  S('lh-frenchpress', 'French Press (SZ-Stange)', 'lh', 'isolation', 'triceps', ['triceps'], [], 20, { setup: 40 }),
  // Rumpf
  S('kz-crunch', 'Crunches am Kabel', 'kz', 'isolation', 'core', ['core'], [], 25),
  S('kg-beinheben', 'Hängendes Beinheben', 'kg', 'isolation', 'core', ['core'], [], 0, { bw: 0.3 }),
  S('kz-pallof', 'Pallof Press (Kabel)', 'kz', 'isolation', 'core', ['core'], [], 10),
  // Kondition
  T('c-rudergeraet', 'Rudergerät – Intervalle', 'ca', 'cardio', '30 s zügig / 30 s locker, wiederholen'),
  T('c-ergometer', 'Fahrrad-Ergometer – Intervalle', 'ca', 'cardio', '40 s schnell / 20 s locker, wiederholen'),
  T('c-laufband', 'Laufband mit Steigung', 'ca', 'cardio', 'Zügig gehen, 10–12 % Steigung'),
  T('c-kbswing', 'Kettlebell-Swings (EMOM)', 'kb', 'cardio', 'Jede Minute 15 Swings, Rest der Minute Pause'),
  // Beweglichkeit
  T('m-aufwaermen', 'Mobility-Aufwärmen', 'kg', 'mobility', 'Hüftkreisen, Cat-Cow, Weltgrößte Dehnung, Schulterkreisen mit Band'),
  T('m-huefte', 'Hüft-Mobility', 'kg', 'mobility', '90/90-Wechsel, tiefe Hocke halten, Hüftbeuger-Dehnung'),
  T('m-schulter', 'Schulter-Mobility (Band)', 'kg', 'mobility', 'Band-Durchzüge, Außenrotation, Wandrutschen'),
  T('m-cooldown', 'Dehnen / Cool-down', 'kg', 'mobility', 'Beinbeuger, Brust, Lat und Hüfte je 30–45 s'),
];

export const EX = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

/** Benutzerdefinierte Übung aus Session übernehmen, falls unbekannt. */
export function getEx(id) {
  return EX[id] ?? { id, name: id, eq: 'ma', kind: 'isolation', pattern: 'core', primary: [], secondary: [], start: 10, step: 2.5, bw: 0, perHand: false, secPerRep: 3, setup: 40, timed: false };
}

/** Passende Alternativen (z. B. wenn ein Gerät belegt ist). */
export function alternatives(exId, { exclude = [], equipment = null } = {}) {
  const ex = getEx(exId);
  const pool = EXERCISES.filter(
    (e) => e.id !== exId && !exclude.includes(e.id) && (!equipment || equipment.includes(e.eq)) && e.timed === ex.timed,
  );
  const score = (e) => {
    let s = 0;
    if (e.pattern === ex.pattern) s += 10;
    s += 3 * e.primary.filter((m) => ex.primary.includes(m)).length;
    if (e.kind === ex.kind) s += 2;
    if (e.eq !== ex.eq) s += 1; // anderes Gerät ist meist frei
    return s;
  };
  return pool
    .map((e) => ({ e, s: score(e) }))
    .filter((x) => x.s >= 5)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.e);
}
