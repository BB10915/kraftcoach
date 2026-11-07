// Datenhaltung: IndexedDB im Browser + In-Memory-Kopie für schnelle Berechnungen.

const DB_NAME = 'kraftcoach';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS = {
  profile: {
    goal: 'Allgemeine Fitness: Kraft im Mittelpunkt, dazu etwas Kondition und Beweglichkeit',
    experience: 'fortgeschritten', // anfaenger | wiedereinsteiger | fortgeschritten
    daysPerWeek: '3–4',
    bodyweight: 80,
    equipment: ['lh', 'kh', 'ma', 'kz', 'kg', 'kb', 'ca'],
    notes: '', // Einschränkungen / Wünsche, z. B. "kein Kreuzheben"
    warmupMin: 5,
    finisher: true,
  },
  ai: {
    apiKey: '',
    model: 'gemini-3.6-flash',
    enabled: true,
  },
  training: {
    defaultMin: 50,
    restCompound: 150,
    restIsolation: 90,
    sound: true,
    vibrate: true,
    wakeLock: true,
  },
};

export const S = {
  settings: structuredCloneSafe(DEFAULT_SETTINGS),
  sessions: [], // sortiert nach date aufsteigend
  sets: [],
};

function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over ?? base;
  const out = { ...base };
  for (const k of Object.keys(over ?? {})) {
    out[k] = typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

let dbp = null;
function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sets')) {
        const s = db.createObjectStore('sets', { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function wrap(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function tx(stores, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then((r) => (result = r), reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const sortSessions = () => S.sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
const sortSets = () => S.sets.sort((a, b) => a.ts - b.ts);

export async function load() {
  await tx(['kv', 'sessions', 'sets'], 'readonly', async (t) => {
    const settings = await wrap(t.objectStore('kv').get('settings'));
    S.settings = deepMerge(DEFAULT_SETTINGS, settings ?? {});
    S.sessions = await wrap(t.objectStore('sessions').getAll());
    S.sets = await wrap(t.objectStore('sets').getAll());
  });
  sortSessions();
  sortSets();
}

export async function saveSettings(next = S.settings) {
  S.settings = next;
  await tx(['kv'], 'readwrite', (t) => t.objectStore('kv').put(JSON.parse(JSON.stringify(next)), 'settings'));
}

export async function putSession(sess) {
  const i = S.sessions.findIndex((s) => s.id === sess.id);
  if (i >= 0) S.sessions[i] = sess;
  else S.sessions.push(sess);
  sortSessions();
  await tx(['sessions'], 'readwrite', (t) => t.objectStore('sessions').put(JSON.parse(JSON.stringify(sess))));
}

export async function deleteSession(id) {
  const setIds = S.sets.filter((x) => x.sessionId === id).map((x) => x.id);
  S.sessions = S.sessions.filter((s) => s.id !== id);
  S.sets = S.sets.filter((x) => x.sessionId !== id);
  await tx(['sessions', 'sets'], 'readwrite', (t) => {
    t.objectStore('sessions').delete(id);
    for (const sid of setIds) t.objectStore('sets').delete(sid);
  });
}

export async function putSet(set) {
  const i = S.sets.findIndex((x) => x.id === set.id);
  if (i >= 0) S.sets[i] = set;
  else S.sets.push(set);
  sortSets();
  await tx(['sets'], 'readwrite', (t) => t.objectStore('sets').put({ ...set }));
}

export async function deleteSet(id) {
  S.sets = S.sets.filter((x) => x.id !== id);
  await tx(['sets'], 'readwrite', (t) => t.objectStore('sets').delete(id));
}

export const setsOf = (sessionId) => S.sets.filter((x) => x.sessionId === sessionId);
export const sessionById = (id) => S.sessions.find((s) => s.id === id);
export const activeSession = () => S.sessions.find((s) => s.status === 'active');
export const doneSessions = () => S.sessions.filter((s) => s.status === 'done');

// ---------- Backup ----------

export function exportData({ includeKey = false } = {}) {
  const settings = JSON.parse(JSON.stringify(S.settings));
  if (!includeKey) settings.ai.apiKey = '';
  return {
    app: 'kraftcoach',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    sessions: S.sessions,
    sets: S.sets,
  };
}

export function validateBackup(data) {
  if (!data || data.app !== 'kraftcoach') return 'Das ist keine KraftCoach-Sicherung.';
  if (!Array.isArray(data.sessions) || !Array.isArray(data.sets)) return 'Die Datei ist unvollständig.';
  if (data.sessions.some((s) => !s.id || !s.date)) return 'Einheiten in der Datei sind fehlerhaft.';
  if (data.sets.some((x) => !x.id || !x.sessionId || !x.exerciseId)) return 'Sätze in der Datei sind fehlerhaft.';
  return null;
}

/** mode: 'replace' ersetzt alles, 'merge' ergänzt fehlende Einträge. */
export async function importData(data, mode = 'replace') {
  const keepKey = S.settings.ai.apiKey;
  await tx(['kv', 'sessions', 'sets'], 'readwrite', (t) => {
    const ss = t.objectStore('sessions');
    const st = t.objectStore('sets');
    if (mode === 'replace') {
      ss.clear();
      st.clear();
    }
    for (const s of data.sessions) ss.put(s);
    for (const x of data.sets) st.put(x);
    if (mode === 'replace' && data.settings) {
      const merged = deepMerge(DEFAULT_SETTINGS, data.settings);
      if (!merged.ai.apiKey) merged.ai.apiKey = keepKey; // Schlüssel nicht verlieren
      t.objectStore('kv').put(merged, 'settings');
    }
  });
  await load();
}

export async function wipeAll() {
  await tx(['kv', 'sessions', 'sets'], 'readwrite', (t) => {
    t.objectStore('kv').clear();
    t.objectStore('sessions').clear();
    t.objectStore('sets').clear();
  });
  await load();
}
