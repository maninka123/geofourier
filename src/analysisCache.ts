export const labCachePrefix = "forma-lab-v6-";
export const curveCachePrefix = "forma-studio-curve-v4-";
const memory = new Map<string, unknown>();
let database: Promise<IDBDatabase | undefined> | undefined;
let generation = 0;
function removeLegacyCaches() {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i),
    );
    keys
      .filter((key) => key && /^forma-(lab|studio-curve)-v\d+-/.test(key))
      .forEach((key) => localStorage.removeItem(key!));
  } catch {
    /* Storage may be disabled. */
  }
}
function remember(key: string, value: unknown) {
  memory.delete(key);
  memory.set(key, value);
  if (memory.size > 32) memory.delete(memory.keys().next().value!);
}
function openDatabase() {
  return (database ||= new Promise<IDBDatabase | undefined>((resolve) => {
    try {
      const request = indexedDB.open("forma-analysis", 1);
      request.onupgradeneeded = () =>
        request.result
          .createObjectStore("results", { keyPath: "key" })
          .createIndex("savedAt", "savedAt");
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
        // Obsolete calculation caches are disposable; presets and favourites stay untouched.
        removeLegacyCaches();
      };
      request.onerror = () => resolve(undefined);
      request.onblocked = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  }));
}
export async function readAnalysisCache<T>(
  key: string,
): Promise<T | undefined> {
  const version = generation;
  if (memory.has(key)) return memory.get(key) as T;
  const db = await openDatabase();
  if (!db || version !== generation) return;
  return new Promise((resolve) => {
    try {
      const request = db
        .transaction("results", "readonly")
        .objectStore("results")
        .get(key);
      request.onsuccess = () => {
        if (version !== generation) {
          resolve(undefined);
          return;
        }
        const value = request.result?.value as T | undefined;
        if (value !== undefined) remember(key, value);
        resolve(value);
      };
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}
export async function writeAnalysisCache(
  key: string,
  value: unknown,
): Promise<boolean> {
  const version = generation;
  remember(key, value);
  const db = await openDatabase();
  if (!db || version !== generation) return false;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction("results", "readwrite"),
        store = transaction.objectStore("results");
      store.put({ key, value, savedAt: Date.now() });
      const count = store.count();
      count.onsuccess = () => {
        let excess = count.result - 12;
        if (excess <= 0) return;
        const cursor = store.index("savedAt").openKeyCursor();
        cursor.onsuccess = () => {
          if (cursor.result && excess > 0) {
            store.delete(cursor.result.primaryKey);
            excess--;
            cursor.result.continue();
          }
        };
      };
      transaction.oncomplete = () => resolve(true);
      transaction.onabort = () => resolve(false);
      transaction.onerror = (event) => {
        event.preventDefault();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}
export async function clearAnalysisCache(): Promise<boolean> {
  generation++;
  memory.clear();
  removeLegacyCaches();
  const db = await openDatabase();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction("results", "readwrite");
      transaction.objectStore("results").clear();
      transaction.oncomplete = () => resolve(true);
      transaction.onabort = () => resolve(false);
      transaction.onerror = (event) => {
        event.preventDefault();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}
