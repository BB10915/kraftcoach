// Bewegungs-Animationen: Strichfigur als SVG, die zwischen Schlüssel-Posen hin und her läuft.
// Winkel in Grad: 0 = nach unten, 90 = nach vorne (rechts), 180 = nach oben, -90 = nach hinten (links).
// Gliedmaßen werden entweder über Winkel gesetzt oder über ein Ziel (Hand/Knöchel), dann rechnet
// eine einfache Inverse Kinematik das Ellbogen-/Kniegelenk aus (so bleiben Füße und Hände fest).

const LEN = { torso: 46, neck: 7, head: 9, uarm: 26, farm: 24, thigh: 36, shin: 34, foot: 10 };
const R2 = Math.PI / 180;
const GROUND = 190;
const dirv = (a) => [Math.sin(a * R2), Math.cos(a * R2)];
const plus = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

function ik(root, target, a, b, bend) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  let d = Math.hypot(dx, dy) || 0.001;
  const ux = dx / d, uy = dy / d;
  d = Math.min(Math.max(d, Math.abs(a - b) + 0.5), a + b - 0.05);
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const off = Math.acos(Math.max(-1, Math.min(1, cos))) * bend;
  const c = Math.cos(off), s = Math.sin(off);
  return [[root[0] + a * (ux * c - uy * s), root[1] + a * (ux * s + uy * c)], [root[0] + ux * d, root[1] + uy * d]];
}

/** Pose -> Punkte (absolute Koordinaten). */
export function solve(p) {
  const front = p.view === 'front';
  const L = (k, side) => LEN[k] * (p.len?.[k + side] ?? 1);
  const loc = (q) => (p.anchor === 'hip' ? [q[0] - p.at[0], q[1] - p.at[1]] : q); // abs -> lokal
  const pts = {};
  const H = [0, 0];
  const td = dirv(p.torso);
  const S = plus(H, td, LEN.torso);
  const perp = [-td[1], td[0]];
  pts.H = H;
  pts.S = S;
  pts.HEAD = plus(S, dirv(p.torso + (p.neck || 0)), LEN.neck + LEN.head);
  pts.EYE = plus(plus(pts.HEAD, perp, 4.5), td, 1.5);
  for (const X of ['L', 'R']) {
    const sg = X === 'L' ? 1 : -1;
    const mir = front && X === 'R';
    const sh = front ? plus(S, perp, 13 * sg) : X === 'R' ? plus(S, [-3, 0]) : S;
    const hp = front ? plus(H, perp, 7 * sg) : X === 'R' ? plus(H, [-3, 0]) : H;
    pts['S' + X] = sh;
    pts['P' + X] = hp;
    // Arm
    const handSpec = p['hand' + X] ?? (p.handL && (mir ? [-p.handL[0], p.handL[1]] : p.handL));
    const relH = p['handRel' + X] ?? p.handRel ?? 'S';
    if (handSpec) {
      let t;
      if (relH === 'abs') {
        const l = loc(p['hand' + X] ?? p.handL);
        t = p['hand' + X] ? l : mir ? [-l[0], l[1]] : X === 'R' ? plus(l, [-3, 0]) : l;
      } else t = plus(relH === 'H' ? hp : sh, handSpec);
      const bend = p['bendArm' + X] ?? (mir ? -(p.bendArmL ?? 1) : p.bendArmL ?? 1);
      [pts['E' + X], pts['W' + X]] = ik(sh, t, L('uarm', X), L('farm', X), bend);
    } else {
      const rel = p.armRel ? p.torso - 180 : 0;
      let ua = p['uarm' + X] ?? (mir ? -p.uarmL : p.uarmL) ?? 0;
      let fa = p['farm' + X] ?? (mir ? -p.farmL : p.farmL) ?? 0;
      ua += mir ? -rel : rel;
      fa += mir ? -rel : rel;
      pts['E' + X] = plus(sh, dirv(ua), L('uarm', X));
      pts['W' + X] = plus(pts['E' + X], dirv(fa), L('farm', X));
    }
    // Bein
    const ank = p['ankle' + X] ?? (p.ankleL && X === 'R' && !p.thighR ? (front ? null : p.ankleL) : null);
    if (ank) {
      let t = loc(ank);
      if (!p['ankle' + X]) t = X === 'R' ? plus(t, [-3, 0]) : t;
      const bend = p['bendLeg' + X] ?? p.bendLegL ?? -1;
      [pts['K' + X], pts['A' + X]] = ik(hp, t, L('thigh', X), L('shin', X), bend);
    } else {
      const th = p['thigh' + X] ?? (mir ? -p.thighL : p.thighL) ?? 0;
      const shn = p['shin' + X] ?? (mir ? -p.shinL : p.shinL) ?? 0;
      pts['K' + X] = plus(hp, dirv(th), L('thigh', X));
      pts['A' + X] = plus(pts['K' + X], dirv(shn), L('shin', X));
    }
    const ft = p['foot' + X] ?? (mir ? -(p.footL ?? 90) : p.footL ?? (front ? 90 : 90));
    pts['T' + X] = plus(pts['A' + X], dirv(ft), LEN.foot * (front ? 0.5 : 1) * (p.len?.['foot' + X] ?? 1));
  }
  // verschieben, sodass der Anker an der gewünschten Stelle liegt
  const key = { hip: 'H', footL: 'AL', toeL: 'TL', kneeL: 'KL', handL: 'WL' }[p.anchor || 'footL'];
  const ref = key === 'H' ? [0, 0] : pts[key];
  const off = [p.at[0] - ref[0], p.at[1] - ref[1]];
  for (const k of Object.keys(pts)) pts[k] = plus(pts[k], off);
  return pts;
}

// ---------- Posen-Bibliothek ----------

const STAND = { anchor: 'footL', at: [100, 187], torso: 180, uarmL: 0, farmL: 0, thighL: 0, shinL: 0, footL: 90 };
const F = (o) => ({ ...STAND, ...o });
const FRONT = (o) => ({ view: 'front', anchor: 'hip', at: [100, 118], torso: 180, uarmL: 8, farmL: 4, thighL: 4, shinL: 0, footL: 90, ...o });
const SEAT_FRONT = (o) => FRONT({ at: [100, 150], thighL: 14, shinL: 0, len: { thighL: 0.3, thighR: 0.3 }, ...o });
const bench = (x1, x2, y) => [{ t: 'rect', x: x1, y, w: x2 - x1, h: 6, back: true }, { t: 'line', a: [x1 + 8, y + 6], b: [x1 + 8, GROUND], c: 'fix', w: 4, back: true }, { t: 'line', a: [x2 - 8, y + 6], b: [x2 - 8, GROUND], c: 'fix', w: 4, back: true }];
const plate = (p = 'WL', r = 15) => ({ t: 'plate', p: [p], r });
const db = (p = 'WL') => ({ t: 'db', p: [p] });
const cable = (to, from = 'WL') => ({ t: 'line', a: [from], b: to, c: 'cab', w: 1.5, back: true });
const seatAt = { t: 'line', a: ['H', -14, 8], b: ['H', 14, 8], c: 'fix', w: 6, back: true };
const backrest = { t: 'line', a: ['H', -9, 4], b: ['S', -9, 0], c: 'fix', w: 6, back: true };

const squat = (o, b) => [F({ armRel: true, uarmL: -25, farmL: 165, ...o }), F({ armRel: true, uarmL: -25, farmL: 165, torso: 140, thighL: 86, shinL: -28, ...o, ...b })];
const hingeTop = { anchor: 'hip', at: [104, 118], torso: 180, uarmL: 0, farmL: 0, ankleL: [106, 187] };
const benchLie = { anchor: 'hip', at: [62, 150], torso: 90, ankleL: [28, 187], bendLegL: 1 };
const seated = { anchor: 'hip', at: [90, 150], torso: 182, thighL: 90, shinL: 0, footL: 90 };

function cycleFrames() {
  const c = [104, 166], r = 15, out = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    out.push({
      anchor: 'hip', at: [84, 118], torso: 142, handL: [134, 98], handRel: 'abs', bendArmL: -1,
      ankleL: [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], ankleR: [c[0] - r * Math.cos(a), c[1] - r * Math.sin(a)],
      bendLegL: -1, bendLegR: -1, footL: 100, footR: 100,
    });
  }
  return out;
}

export const ANIMS = {
  squat: { frames: squat(), props: [{ t: 'plate', p: ['S', -8, 2], r: 13 }] },
  frontsquat: {
    frames: [F({ armRel: true, uarmL: 80, farmL: -135 }), F({ armRel: true, uarmL: 80, farmL: -135, torso: 162, thighL: 90, shinL: -32 })],
    props: [{ t: "plate", p: ["S", 12, 4], r: 12 }],
  },
  goblet: {
    frames: [F({ armRel: true, uarmL: 18, farmL: 168 }), F({ armRel: true, uarmL: 18, farmL: 168, torso: 160, thighL: 90, shinL: -32 })],
    props: [{ t: 'db', p: ['WL', 4, 0], big: true }],
  },
  hack: {
    frames: [F({ at: [112, 187], armRel: true, uarmL: -20, farmL: 165, torso: 196, thighL: -10, shinL: -10 }), F({ at: [112, 187], armRel: true, uarmL: -20, farmL: 165, torso: 200, thighL: 82, shinL: -36 })],
    props: [{ t: 'line', a: ['H', -8, 6], b: ['S', -8, -4], c: 'fix', w: 7, back: true }, { t: 'line', a: [80, GROUND], b: [150, GROUND - 4], c: 'fix', w: 4, back: true }],
  },
  legpress: {
    frames: [
      { anchor: 'hip', at: [66, 156], torso: -132, uarmL: 10, farmL: 60, ankleL: [114, 108], bendLegL: -1, footL: -140 },
      { anchor: 'hip', at: [66, 156], torso: -132, uarmL: 10, farmL: 60, ankleL: [102, 120], bendLegL: -1, footL: -140 },
    ],
    props: [
      { t: 'line', a: ['AL', -11, -11], b: ['AL', 9, 9], c: 'fix', w: 6 },
      { t: 'line', a: ['H', 6, 8], b: ['S', 7, 6], c: 'fix', w: 7, back: true },
      { t: 'line', a: [40, 168], b: [150, 60], c: 'cab', w: 1.5, back: true },
      { t: 'line', a: [30, 172], b: [110, 172], c: 'fix', w: 5, back: true },
    ],
  },
  deadlift: {
    frames: [{ ...hingeTop, at: [76, 146], torso: 122, ankleL: [106, 187] }, hingeTop],
    props: [plate('WL', 16)], dur: 1200,
  },
  rdl: { frames: [hingeTop, { ...hingeTop, at: [82, 123], torso: 132 }], props: [plate('WL', 16)], dur: 1300 },
  rdl_db: { frames: [hingeTop, { ...hingeTop, at: [82, 123], torso: 132 }], props: [db()], dur: 1300 },
  hipthrust: {
    frames: [
      { anchor: 'hip', at: [104, 172], torso: -118, handL: [4, -8], handRel: 'H', bendArmL: -1, ankleL: [150, 187], bendLegL: -1 },
      { anchor: 'hip', at: [110, 152], torso: -90, handL: [4, -8], handRel: 'H', bendArmL: -1, ankleL: [150, 187], bendLegL: -1 },
    ],
    props: [{ t: 'plate', p: ['H', 2, -14], r: 15 }, ...bench(36, 72, 158)],
  },
  hyperext: {
    frames: [
      { anchor: 'hip', at: [98, 116], torso: 35, armRel: true, uarmL: 25, farmL: 150, thighL: -52, shinL: -52, footL: 40 },
      { anchor: 'hip', at: [98, 116], torso: 124, armRel: true, uarmL: 25, farmL: 150, thighL: -52, shinL: -52, footL: 40 },
    ],
    props: [{ t: 'circle', p: [102, 124], r: 7 }, { t: 'circle', p: [47, 150], r: 5 }, { t: 'line', a: [102, 131], b: [80, GROUND], c: 'fix', w: 5, back: true }, { t: 'line', a: [47, 155], b: [56, GROUND], c: 'fix', w: 4, back: true }],
  },
  abductor: {
    frames: [SEAT_FRONT({ uarmL: 25, farmL: 5, thighL: 20 }), SEAT_FRONT({ uarmL: 25, farmL: 5, thighL: 72, len: { thighL: 0.6, thighR: 0.6 } })],
    props: [{ t: 'rect', x: 76, y: 156, w: 48, h: 6, back: true }, { t: 'circle', p: ['KL', 6, 4], r: 5 }, { t: 'circle', p: ['KR', -6, 4], r: 5 }],
  },
  lunge: {
    frames: [
      { anchor: 'hip', at: [96, 127], torso: 180, uarmL: 0, farmL: 0, ankleL: [130, 187], ankleR: [57, 183], footR: 45 },
      { anchor: 'hip', at: [97, 150], torso: 180, uarmL: 0, farmL: 0, ankleL: [130, 187], ankleR: [57, 183], footR: 45 },
    ],
    props: [db()],
  },
  bulgarian: {
    frames: [
      { anchor: 'hip', at: [102, 126], torso: 176, uarmL: 0, farmL: 0, ankleL: [135, 187], ankleR: [54, 156], footR: -95 },
      { anchor: 'hip', at: [98, 152], torso: 170, uarmL: 0, farmL: 0, ankleL: [135, 187], ankleR: [54, 156], footR: -95 },
    ],
    props: [db(), ...bench(28, 64, 162)],
  },
  legext: {
    frames: [{ ...seated, torso: 192, uarmL: 5, farmL: 40, shinL: 4, footL: 94 }, { ...seated, torso: 192, uarmL: 5, farmL: 40, shinL: 84, footL: 174 }],
    props: [seatAt, backrest, { t: 'circle', p: ['AL', 3, -2], r: 5 }, { t: 'line', a: [90, 160], b: [90, GROUND], c: 'fix', w: 5, back: true }],
  },
  legcurl_seated: {
    frames: [{ ...seated, torso: 190, uarmL: 5, farmL: 40, shinL: 84, footL: 174 }, { ...seated, torso: 190, uarmL: 5, farmL: 40, shinL: -12, footL: 80 }],
    props: [seatAt, backrest, { t: 'circle', p: ['KL', 0, -7], r: 5 }, { t: 'circle', p: ['AL', 0, 6], r: 5 }, { t: 'line', a: [90, 160], b: [90, GROUND], c: 'fix', w: 5, back: true }],
  },
  legcurl_lying: {
    frames: [
      { anchor: 'hip', at: [96, 150], torso: 90, uarmL: 20, farmL: 60, thighL: -90, shinL: -90, footL: 0 },
      { anchor: 'hip', at: [96, 150], torso: 90, uarmL: 20, farmL: 60, thighL: -90, shinL: -195, footL: -105 },
    ],
    props: [...bench(40, 160, 157), { t: 'circle', p: ['AL', 0, -7], r: 5 }],
  },
  calf: {
    frames: [F({ anchor: 'toeL', at: [116, 177], footL: 106, armRel: true, uarmL: -25, farmL: 165 }), F({ anchor: 'toeL', at: [116, 177], footL: 50, armRel: true, uarmL: -25, farmL: 165 })],
    props: [{ t: 'rect', x: 100, y: 178, w: 22, h: 12, back: true }, { t: 'line', a: ['S', -10, -2], b: ['S', 10, -2], c: 'fix', w: 7 }],
  },
  calf_seated: {
    frames: [
      { anchor: 'toeL', at: [128, 173], torso: 182, uarmL: 20, farmL: 60, thighL: 90, shinL: 0, footL: 106 },
      { anchor: 'toeL', at: [128, 173], torso: 182, uarmL: 20, farmL: 60, thighL: 90, shinL: 0, footL: 52 },
    ],
    props: [{ t: 'rect', x: 112, y: 174, w: 22, h: 16, back: true }, { t: 'line', a: ['H', -14, 8], b: ['H', 12, 8], c: 'fix', w: 6, back: true }, { t: 'line', a: ['KL', -10, -6], b: ['KL', 8, -6], c: 'fix', w: 6 }],
  },
  bench: {
    frames: [{ ...benchLie, handL: [4, -50], bendArmL: -1 }, { ...benchLie, handL: [-2, -10], bendArmL: -1 }],
    props: [plate('WL', 15), ...bench(40, 140, 156)],
  },
  bench_db: {
    frames: [{ ...benchLie, handL: [2, -50], bendArmL: -1 }, { ...benchLie, handL: [-2, -8], bendArmL: -1 }],
    props: [db(), ...bench(40, 140, 156)],
  },
  incline: {
    frames: [
      { anchor: 'hip', at: [70, 160], torso: 135, handL: [-4, -50], bendArmL: -1, ankleL: [36, 187], bendLegL: 1 },
      { anchor: 'hip', at: [70, 160], torso: 135, handL: [-6, -8], bendArmL: -1, ankleL: [36, 187], bendLegL: 1 },
    ],
    props: [plate('WL', 15), { t: 'line', a: ['H', 6, 7], b: ['S', 8, 6], c: 'fix', w: 7, back: true }, { t: 'line', a: [66, 168], b: [66, GROUND], c: 'fix', w: 5, back: true }],
  },
  incline_db: {
    frames: [
      { anchor: 'hip', at: [70, 160], torso: 135, handL: [-4, -50], bendArmL: -1, ankleL: [36, 187], bendLegL: 1 },
      { anchor: 'hip', at: [70, 160], torso: 135, handL: [-6, -6], bendArmL: -1, ankleL: [36, 187], bendLegL: 1 },
    ],
    props: [db(), { t: 'line', a: ['H', 6, 7], b: ['S', 8, 6], c: 'fix', w: 7, back: true }, { t: 'line', a: [66, 168], b: [66, GROUND], c: 'fix', w: 5, back: true }],
  },
  chestpress: {
    frames: [{ ...seated, torso: 186, handL: [10, 10], bendArmL: 1 }, { ...seated, torso: 186, handL: [48, 8], bendArmL: 1 }],
    props: [seatAt, backrest, { t: 'circle', p: ['WL'], r: 4, c: 'eq' }, { t: 'line', a: [90, 160], b: [90, GROUND], c: 'fix', w: 5, back: true }],
  },
  dips: {
    frames: [
      { anchor: 'hip', at: [104, 104], torso: 178, handL: [108, 108], handRel: 'abs', bendArmL: 1, thighL: 10, shinL: -70, footL: 0 },
      { anchor: 'hip', at: [99, 120], torso: 168, handL: [108, 108], handRel: 'abs', bendArmL: 1, thighL: 10, shinL: -70, footL: 0 },
    ],
    props: [{ t: 'line', a: [80, 110], b: [136, 110], c: 'fix', w: 5, back: true }, { t: 'line', a: [130, 110], b: [130, GROUND], c: 'fix', w: 4, back: true }, { t: 'line', a: [86, 110], b: [86, GROUND], c: 'fix', w: 4, back: true }],
  },
  pushup: {
    frames: [
      { anchor: 'footL', at: [35, 187], torso: 115, thighL: -65, shinL: -65, footL: 160, handL: [145, 187], handRel: 'abs', bendArmL: 1 },
      { anchor: 'footL', at: [35, 187], torso: 100, thighL: -80, shinL: -80, footL: 160, handL: [145, 187], handRel: 'abs', bendArmL: 1 },
    ],
  },
  ohp: { frames: [F({ handL: [12, 4], bendArmL: 1 }), F({ handL: [2, -48], bendArmL: 1 })], props: [plate('WL', 14)] },
  ohp_seated: {
    frames: [{ ...seated, handL: [6, -6], bendArmL: 1 }, { ...seated, handL: [2, -48], bendArmL: 1 }],
    props: [db(), seatAt, backrest, { t: 'line', a: [90, 160], b: [90, GROUND], c: 'fix', w: 5, back: true }],
  },
  ohp_machine: {
    frames: [{ ...seated, handL: [8, -6], bendArmL: 1 }, { ...seated, handL: [4, -46], bendArmL: 1 }],
    props: [{ t: 'circle', p: ['WL'], r: 4, c: 'eq' }, seatAt, backrest, { t: 'line', a: [90, 160], b: [90, GROUND], c: 'fix', w: 5, back: true }],
  },
  row: {
    frames: [
      { anchor: 'hip', at: [84, 130], torso: 120, handL: [0, 48], bendArmL: -1, ankleL: [102, 187] },
      { anchor: 'hip', at: [84, 130], torso: 120, handL: [-24, 22], bendArmL: -1, ankleL: [102, 187] },
    ],
    props: [plate('WL', 15)],
  },
  row_db: {
    frames: [
      { anchor: 'hip', at: [86, 128], torso: 110, handL: [0, 48], bendArmL: -1, handR: [150, 150], handRelR: 'abs', bendArmR: 1, ankleL: [118, 187], ankleR: [60, 187] },
      { anchor: 'hip', at: [86, 128], torso: 110, handL: [-22, 18], bendArmL: -1, handR: [150, 150], handRelR: 'abs', bendArmR: 1, ankleL: [118, 187], ankleR: [60, 187] },
    ],
    props: [db(), { t: 'rect', x: 132, y: 150, w: 50, h: 40, back: true }],
  },
  row_cable: {
    frames: [
      { anchor: 'hip', at: [66, 168], torso: 156, handL: [46, 10], bendArmL: -1, ankleL: [132, 168], bendLegL: 1, footL: 180 },
      { anchor: 'hip', at: [66, 168], torso: 186, handL: [14, 26], bendArmL: -1, ankleL: [132, 168], bendLegL: 1, footL: 180 },
    ],
    props: [cable([196, 162]), { t: 'line', a: [137, 152], b: [137, 184], c: 'fix', w: 5, back: true }, { t: 'rect', x: 40, y: 174, w: 54, h: 16, back: true }],
  },
  row_machine: {
    frames: [{ ...seated, torso: 160, handL: [44, 8], bendArmL: -1 }, { ...seated, torso: 160, handL: [6, 24], bendArmL: -1 }],
    props: [seatAt, { t: 'line', a: ['S', 12, 6], b: ['S', 2, 34], c: 'fix', w: 7, back: true }, { t: 'circle', p: ['WL'], r: 4, c: 'eq' }, { t: 'line', a: [90, 160], b: [90, GROUND], c: 'fix', w: 5, back: true }],
  },
  pullup: {
    frames: [
      FRONT({ at: [100, 124], handL: [122, 28], handRel: 'abs', bendArmL: 1, thighL: 4, shinL: -2, footL: 20, len: { shinL: 0.85, shinR: 0.85 } }),
      FRONT({ at: [100, 94], handL: [122, 28], handRel: 'abs', bendArmL: 1, thighL: 4, shinL: -2, footL: 20, len: { shinL: 0.85, shinR: 0.85 } }),
    ],
    props: [{ t: 'line', a: [58, 26], b: [142, 26], c: 'fix', w: 5, back: true }],
  },
  pulldown: {
    frames: [SEAT_FRONT({ handL: [130, 60], handRel: 'abs', bendArmL: -1 }), SEAT_FRONT({ handL: [130, 102], handRel: 'abs', bendArmL: -1 })],
    props: [{ t: 'line', a: ['WL'], b: ['WR'], c: 'eq', w: 4 }, { t: 'line', a: ['WL', -30, 0], b: [100, 0], c: 'cab', w: 1.5, back: true }, { t: 'rect', x: 76, y: 156, w: 48, h: 6, back: true }],
  },
  pulldown_narrow: {
    frames: [SEAT_FRONT({ handL: [107, 58], handRel: 'abs', bendArmL: -1 }), SEAT_FRONT({ handL: [116, 104], handRel: 'abs', bendArmL: -1 })],
    props: [{ t: 'line', a: ['WL'], b: ['WR'], c: 'eq', w: 4 }, { t: 'line', a: ['WL', -7, -2], b: [100, 0], c: 'cab', w: 1.5, back: true }, { t: 'rect', x: 76, y: 156, w: 48, h: 6, back: true }],
  },
  crossover: {
    frames: [FRONT({ handL: [150, 66], handRel: 'abs', bendArmL: 1 }), FRONT({ handL: [107, 138], handRel: 'abs', bendArmL: 1 })],
    props: [cable([186, 22]), cable([14, 22], 'WR'), { t: 'line', a: [190, 14], b: [190, GROUND], c: 'fix', w: 4, back: true }, { t: 'line', a: [10, 14], b: [10, GROUND], c: 'fix', w: 4, back: true }],
  },
  butterfly: {
    frames: [SEAT_FRONT({ uarmL: 90, farmL: 180, len: { thighL: 0.3, thighR: 0.3 } }), SEAT_FRONT({ uarmL: 90, farmL: 180, len: { thighL: 0.3, thighR: 0.3, uarmL: -0.4, uarmR: -0.4 } })],
    props: [{ t: 'line', a: ['EL'], b: ['WL'], c: 'eq', w: 3 }, { t: 'line', a: ['ER'], b: ['WR'], c: 'eq', w: 3 }, { t: 'rect', x: 76, y: 156, w: 48, h: 6, back: true }],
  },
  lateral: { frames: [FRONT({ uarmL: 12, farmL: 18 }), FRONT({ uarmL: 86, farmL: 94 })], props: [db('WL'), db('WR')] },
  lateral_cable: {
    frames: [FRONT({ uarmL: 10, farmL: 0, uarmR: 0, farmR: 0 }), FRONT({ uarmL: 86, farmL: 92, uarmR: 0, farmR: 0 })],
    props: [cable([16, 182]), { t: 'line', a: [12, 120], b: [12, GROUND], c: 'fix', w: 4, back: true }],
  },
  facepull: {
    frames: [F({ at: [92, 187], handL: [48, -6], bendArmL: -1 }), F({ at: [92, 187], handL: [8, -18], bendArmL: -1 })],
    props: [cable([196, 52]), { t: 'line', a: [196, 20], b: [196, GROUND], c: 'fix', w: 4, back: true }],
  },
  reverse_fly: {
    frames: [SEAT_FRONT({ uarmL: 90, farmL: 90, len: { thighL: 0.3, thighR: 0.3, uarmL: -0.4, uarmR: -0.4, farmL: -0.45, farmR: -0.45 } }), SEAT_FRONT({ uarmL: 88, farmL: 92 })],
    props: [{ t: 'circle', p: ['WL'], r: 4, c: 'eq' }, { t: 'circle', p: ['WR'], r: 4, c: 'eq' }, { t: 'rect', x: 76, y: 156, w: 48, h: 6, back: true }],
  },
  curl: { frames: [F({ uarmL: 4, farmL: 8 }), F({ uarmL: 8, farmL: 155 })], props: [db()] },
  curl_bar: { frames: [F({ uarmL: 4, farmL: 8 }), F({ uarmL: 8, farmL: 155 })], props: [plate('WL', 9)] },
  curl_cable: { frames: [F({ uarmL: 4, farmL: 10 }), F({ uarmL: 8, farmL: 155 })], props: [cable([152, 186])] },
  pushdown: {
    frames: [F({ torso: 172, uarmL: 10, farmL: 115 }), F({ torso: 172, uarmL: 10, farmL: 6 })],
    props: [cable([140, 2]), { t: 'line', a: [146, 0], b: [146, GROUND], c: 'fix', w: 4, back: true }],
  },
  overhead_tri: {
    frames: [F({ torso: 165, uarmL: 160, farmL: -25 }), F({ torso: 165, uarmL: 160, farmL: -195 })],
    props: [cable([8, 150]), { t: 'line', a: [4, 100], b: [4, GROUND], c: 'fix', w: 4, back: true }],
  },
  french: {
    frames: [{ ...benchLie, uarmL: 170, farmL: 175 }, { ...benchLie, uarmL: 170, farmL: 95 }],
    props: [plate('WL', 9), ...bench(40, 140, 156)],
  },
  cable_crunch: {
    frames: [
      { anchor: 'hip', at: [90, 150], torso: 165, armRel: true, uarmL: 160, farmL: -60, thighL: 0, shinL: -90, footL: -170 },
      { anchor: 'hip', at: [88, 150], torso: 100, armRel: true, uarmL: 160, farmL: -60, thighL: 0, shinL: -90, footL: -170 },
    ],
    props: [cable([130, 2]), { t: 'line', a: [136, 0], b: [136, GROUND], c: 'fix', w: 4, back: true }],
  },
  leg_raise: {
    frames: [
      { anchor: 'hip', at: [100, 120], torso: 180, handL: [100, 24], handRel: 'abs', bendArmL: 1, thighL: 0, shinL: 0, footL: 60 },
      { anchor: 'hip', at: [94, 116], torso: 186, handL: [100, 24], handRel: 'abs', bendArmL: 1, thighL: 92, shinL: 86, footL: 170 },
    ],
    props: [{ t: 'circle', p: [100, 22], r: 4 }, { t: 'line', a: [60, 22], b: [140, 22], c: 'cab', w: 1.5, back: true }],
  },
  pallof: {
    frames: [FRONT({ handL: [102, 94], handRel: 'abs', bendArmL: -1, thighL: 8 }), FRONT({ handL: [101, 104], handRel: 'abs', bendArmL: -1, thighL: 8 })],
    props: [cable([190, 96]), { t: 'line', a: [194, 40], b: [194, GROUND], c: 'fix', w: 4, back: true }],
  },
  rower: {
    frames: [
      { anchor: 'hip', at: [100, 178], torso: 150, handL: [48, 14], bendArmL: -1, ankleL: [132, 176], bendLegL: -1, footL: 170 },
      { anchor: 'hip', at: [80, 178], torso: 170, handL: [50, 16], bendArmL: -1, ankleL: [132, 176], bendLegL: -1, footL: 170 },
      { anchor: 'hip', at: [66, 178], torso: 200, handL: [14, 26], bendArmL: -1, ankleL: [132, 176], bendLegL: -1, footL: 170 },
    ],
    props: [
      { t: 'line', a: [30, 188], b: [176, 188], c: 'fix', w: 4, back: true },
      { t: 'line', a: ['H', -10, 7], b: ['H', 10, 7], c: 'fix', w: 6, back: true },
      { t: 'line', a: [138, 158], b: [140, 186], c: 'fix', w: 5, back: true },
      { t: 'circle', p: [170, 164], r: 13 },
      cable([160, 160]),
    ],
    dur: 650, hold: 60,
  },
  bike: {
    frames: cycleFrames(),
    props: [
      { t: 'line', a: [74, 125], b: [96, 125], c: 'fix', w: 6, back: true },
      { t: 'line', a: [86, 128], b: [104, 166], c: 'fix', w: 4, back: true },
      { t: 'line', a: [104, 166], b: [136, 100], c: 'fix', w: 4, back: true },
      { t: 'line', a: [128, 98], b: [142, 98], c: 'fix', w: 5, back: true },
      { t: 'line', a: [80, GROUND], b: [150, GROUND], c: 'fix', w: 5, back: true },
      { t: 'circle', p: [104, 166], r: 4 },
    ],
    dur: 220, hold: 0, ease: false,
  },
  walk: {
    frames: [
      { anchor: 'hip', at: [100, 108], torso: 176, uarmL: -22, farmL: -4, uarmR: 22, farmR: 50, thighL: 26, shinL: 4, footL: 96, thighR: -20, shinR: -40, footR: 60 },
      { anchor: 'hip', at: [100, 108], torso: 176, uarmL: 22, farmL: 50, uarmR: -22, farmR: -4, thighL: -20, shinL: -40, footL: 60, thighR: 26, shinR: 4, footR: 96 },
    ],
    props: [{ t: 'line', a: [30, 186], b: [176, 168], c: 'fix', w: 5, back: true }, { t: 'line', a: [150, 172], b: [150, 108], c: 'fix', w: 3, back: true }, { t: 'line', a: [150, 108], b: [124, 108], c: 'fix', w: 3, back: true }],
    dur: 650, hold: 0,
  },
  swing: {
    frames: [
      { anchor: 'hip', at: [74, 140], torso: 124, uarmL: -12, farmL: -18, ankleL: [100, 187] },
      { anchor: 'hip', at: [96, 118], torso: 182, uarmL: 92, farmL: 92, ankleL: [100, 187] },
    ],
    props: [{ t: 'kb', p: ['WL'] }], dur: 650, hold: 120,
  },
  wgs: {
    frames: [
      { anchor: 'hip', at: [98, 152], torso: 140, uarmL: 10, farmL: 10, uarmR: 8, farmR: 8, ankleL: [138, 187], ankleR: [58, 183], footR: 45 },
      { anchor: 'hip', at: [98, 152], torso: 150, uarmL: 175, farmL: 175, uarmR: 8, farmR: 8, ankleL: [138, 187], ankleR: [58, 183], footR: 45 },
    ],
    dur: 1500, hold: 600,
  },
  deep_squat: {
    frames: [F({ torso: 150, uarmL: 60, farmL: 140, thighL: 94, shinL: -32 }), F({ torso: 160, uarmL: 70, farmL: 150, thighL: 96, shinL: -34 })],
    dur: 1800, hold: 400,
  },
  passthrough: {
    frames: [F({ uarmL: 20, farmL: 20 }), F({ uarmL: 180, farmL: 180 }), F({ uarmL: 250, farmL: 250 }), F({ uarmL: 180, farmL: 180 })],
    props: [{ t: 'circle', p: ['WL'], r: 3, c: 'eq' }], dur: 900, hold: 150,
  },
  stretch: {
    frames: [F({ torso: 178 }), F({ torso: 62, uarmL: 0, farmL: 0 })],
    dur: 1800, hold: 1200,
  },
};

// ---------- Zeichnen ----------

const f1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f1(p[0])},${f1(p[1])}`;

function lerp(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerp(v, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = k in a && k in b ? lerp(a[k], b[k], t) : a[k] ?? b[k];
    return o;
  }
  return t < 0.5 ? a ?? b : b ?? a;
}

function resolve(ref, pts) {
  if (typeof ref[0] === 'string') {
    const p = pts[ref[0]];
    return [p[0] + (ref[1] || 0), p[1] + (ref[2] || 0)];
  }
  return ref;
}

function propSvg(pr, pts) {
  switch (pr.t) {
    case 'plate': {
      const p = resolve(pr.p, pts);
      return `<circle class="eq-fill" cx="${f1(p[0])}" cy="${f1(p[1])}" r="${pr.r}"/><circle class="eq-hub" cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.5"/>`;
    }
    case 'db': {
      const p = resolve(pr.p, pts);
      const r = pr.big ? 7 : 5.5;
      return `<rect class="eq-fill" x="${f1(p[0] - r)}" y="${f1(p[1] - r)}" width="${2 * r}" height="${2 * r}" rx="2.5"/>`;
    }
    case 'kb': {
      const p = resolve(pr.p, pts);
      return `<circle class="eq-fill" cx="${f1(p[0])}" cy="${f1(p[1] + 8)}" r="8"/>`;
    }
    case 'circle': {
      const p = resolve(pr.p, pts);
      return `<circle class="${pr.c === 'eq' ? 'eq-fill' : 'fix-fill'}" cx="${f1(p[0])}" cy="${f1(p[1])}" r="${pr.r}"/>`;
    }
    case 'rect':
      return `<rect class="fix-fill" x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}" rx="2"/>`;
    case 'line': {
      const a = resolve(pr.a, pts), b = resolve(pr.b, pts);
      return `<line class="${pr.c || 'fix'}" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke-width="${pr.w || 4}"/>`;
    }
  }
  return '';
}

/** Ein Bild (SVG-Inhalt) für eine Pose. */
export function frameSvg(anim, pose) {
  const pts = solve(pose);
  const front = pose.view === 'front';
  const props = anim.props ?? [];
  const limb = (cls, ...ps) => `<polyline class="${cls}" points="${ps.map(pt).join(' ')}"/>`;
  const side = (X, cls) => limb(cls + ' leg', pts['P' + X], pts['K' + X], pts['A' + X], pts['T' + X]) + limb(cls + ' arm', pts['S' + X], pts['E' + X], pts['W' + X]);
  return [
    `<line class="ground" x1="0" y1="${GROUND + 1}" x2="200" y2="${GROUND + 1}"/>`,
    ...props.filter((p) => p.back).map((p) => propSvg(p, pts)),
    front ? '' : side('R', 'fig far'),
        front ? `<polygon class="body" points="${[pts.PL, pts.SL, pts.SR, pts.PR].map(pt).join(' ')}"/>` : limb('fig torso', pts.H, pts.S),
    `<circle class="head" cx="${f1(pts.HEAD[0])}" cy="${f1(pts.HEAD[1])}" r="${LEN.head}"/>`,
    front ? "" : `<circle class="eye" cx="${f1(pts.EYE[0])}" cy="${f1(pts.EYE[1])}" r="1.8"/>`,
    front ? side('R', 'fig') : '',
    side('L', 'fig'),
    ...props.filter((p) => !p.back).map((p) => propSvg(p, pts)),
  ].join('');
}

export const hasAnim = (key) => !!ANIMS[key];

/** Platzhalter-SVG; startAnims() erweckt es zum Leben. */
export function animSvg(key, { label = '' } = {}) {
  const a = ANIMS[key];
  if (!a) return '';
  return `<svg class="anim" data-anim="${key}" viewBox="0 0 200 200" role="img" aria-label="${label ? `Animation: ${label}` : 'Bewegungsanimation'}">${frameSvg(a, a.frames[0])}</svg>`;
}

/** Pose zum Zeitpunkt t (ms) – für Tests und Animation. */
export function poseAt(anim, t) {
  const fr = anim.frames;
  const dur = anim.dur ?? 1100, hold = anim.hold ?? 350;
  const seg = dur + hold;
  const n = fr.length;
  const total = seg * n;
  const tt = ((t % total) + total) % total;
  const i = Math.floor(tt / seg);
  const local = tt - i * seg;
  if (local < hold) return fr[i];
  let k = (local - hold) / dur;
  if (anim.ease !== false) k = (1 - Math.cos(Math.PI * k)) / 2;
  return lerp(fr[i], fr[(i + 1) % n], k);
}

/** Alle Animationen in root starten (laufen, solange sie im Dokument sind; Antippen = Pause). */
export function startAnims(root) {
  const els = [...root.querySelectorAll('svg[data-anim]')];
  if (!els.length) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const el of els) {
    if (el._running) continue;
    el._running = true;
    const anim = ANIMS[el.dataset.anim];
    let paused = false, last = performance.now(), clock = 0;
    el.addEventListener('click', () => { paused = !paused; el.classList.toggle('paused', paused); });
    const step = (now) => {
      if (!el.isConnected) { el._running = false; return; }
      if (!paused) clock += (now - last) * (reduce ? 0.5 : 1);
      last = now;
      el.innerHTML = frameSvg(anim, poseAt(anim, clock));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
