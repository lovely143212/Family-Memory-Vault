/**
 * Offline encrypted document vault.
 *
 * Strategy:
 * - For each (user, document) we encrypt the file bytes with AES-GCM 256.
 * - The per-document key is derived from a per-user passphrase stored in
 *   IndexedDB via PBKDF2 (200k iterations, SHA-256, random salt).
 * - The encrypted blob, IV, salt, and document metadata live in IndexedDB.
 *
 * This protects cached files from casual on-device inspection. It is not
 * a substitute for full-disk encryption.
 */

const DB_NAME = "family-vault-offline";
const DB_VERSION = 1;
const STORE_DOCS = "docs";
const STORE_META = "meta";

type StoredDoc = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  mime_type: string;
  document_number: string | null;
  expiry_date: string | null;
  cached_at: number;
  iv: ArrayBuffer;
  salt: ArrayBuffer;
  cipher: ArrayBuffer;
  size: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        const store = db.createObjectStore(STORE_DOCS, { keyPath: "id" });
        store.createIndex("user", "user_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "k" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = run(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

async function getOrCreatePassphrase(userId: string): Promise<string> {
  const key = `pp:${userId}`;
  const existing = await tx<{ k: string; v: string } | undefined>(STORE_META, "readonly", (s) => s.get(key) as IDBRequest<{ k: string; v: string } | undefined>);
  if (existing?.v) return existing.v;
  const rand = crypto.getRandomValues(new Uint8Array(32));
  const v = btoa(String.fromCharCode(...rand));
  await tx(STORE_META, "readwrite", (s) => s.put({ k: key, v }));
  return v;
}

async function deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(passphrase);
  const base = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type CacheInput = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  mime_type: string;
  document_number: string | null;
  expiry_date: string | null;
  bytes: ArrayBuffer;
};

export async function cacheDocument(input: CacheInput): Promise<void> {
  const passphrase = await getOrCreatePassphrase(input.user_id);
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
  const key = await deriveKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, input.bytes);
  const record: StoredDoc = {
    id: input.id,
    user_id: input.user_id,
    title: input.title,
    category: input.category,
    mime_type: input.mime_type,
    document_number: input.document_number,
    expiry_date: input.expiry_date,
    cached_at: Date.now(),
    iv,
    salt,
    cipher,
    size: input.bytes.byteLength,
  };
  await tx(STORE_DOCS, "readwrite", (s) => s.put(record));
}

export async function getCachedBlob(userId: string, id: string): Promise<{ blob: Blob; meta: StoredDoc } | null> {
  const rec = (await tx<StoredDoc | undefined>(STORE_DOCS, "readonly", (s) => s.get(id) as IDBRequest<StoredDoc | undefined>)) ?? null;
  if (!rec || rec.user_id !== userId) return null;
  const passphrase = await getOrCreatePassphrase(userId);
  const key = await deriveKey(passphrase, rec.salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: rec.iv }, key, rec.cipher);
  return { blob: new Blob([plain], { type: rec.mime_type }), meta: rec };
}

export async function listCached(userId: string): Promise<StoredDoc[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_DOCS, "readonly");
    const idx = t.objectStore(STORE_DOCS).index("user");
    const req = idx.getAll(userId);
    req.onsuccess = () => resolve(req.result as StoredDoc[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeCached(id: string): Promise<void> {
  await tx(STORE_DOCS, "readwrite", (s) => s.delete(id));
}

export async function isCached(id: string): Promise<boolean> {
  const rec = await tx<StoredDoc | undefined>(STORE_DOCS, "readonly", (s) => s.get(id) as IDBRequest<StoredDoc | undefined>);
  return !!rec;
}