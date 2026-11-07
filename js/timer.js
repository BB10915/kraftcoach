// Pausentimer-Signale (Ton, Vibration) und Bildschirm-wach-halten.

let ctx = null;

/** Muss einmal durch eine Nutzeraktion (Tipp) passieren, sonst blockieren iOS/Android den Ton. */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

export function beep({ sound = true, vibrate = true } = {}) {
  if (vibrate) navigator.vibrate?.([250, 120, 250, 120, 400]);
  if (!sound || !ctx) return;
  const t0 = ctx.currentTime;
  [0, 0.25, 0.5].forEach((dt, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.22);
  });
}

let lock = null;
let wantLock = false;
export async function keepAwake(on) {
  wantLock = on;
  try {
    if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantLock) keepAwake(true);
});
