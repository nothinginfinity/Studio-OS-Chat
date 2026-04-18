/**
 * db.ts — IndexedDB persistence backbone for studio-os-chat v3
 *
 * Object stores:
 *   sessions   — SessionRecord, indexed by updatedAt + titleLower
 *   messages   — MessageRecord, indexed by sessionId + createdAt
 *   settings   — key/value pairs
 *   fileRoots  — FileRootRecord
 *   files      — FileRecord, indexed by rootId, pathLower, ext, updatedAt
 *   chunks     — ChunkRecord, indexed by fileId
 *   terms      — TermRecord, compound key [term, chunkId], indexed by term + chunkId
 */

import type {
  SessionRecord,
  MessageRecord,
  FileRootRecord,
  FileRecord,
  ChunkRecord,
  TermRecord,
  SearchResult
} from "./types";

const DB_NAME = "studio-os-chat-v3";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // sessions
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("updatedAt", "updatedAt");
        s.createIndex("titleLower", "titleLower");
      }

      // messages
      if (!db.objectStoreNames.contains("messages")) {
        const m = db.createObjectStore("messages", { keyPath: "id" });
        m.createIndex("sessionId", "sessionId");
        m.createIndex("sessionId_createdAt", ["sessionId", "createdAt"]);
      }

      // settings
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      // fileRoots
      if (!db.objectStoreNames.contains("fileRoots")) {
        db.createObjectStore("fileRoots", { keyPath: "id" });
      }

      // files
      if (!db.objectStoreNames.contains("files")) {
        const f = db.createObjectStore("files", { keyPath: "id" });
        f.createIndex("rootId", "rootId");
        f.createIndex("pathLower", "pathLower");
        f.createIndex("ext", "ext");
        f.createIndex("updatedAt", "updatedAt");
      }

      // chunks
      if (!db.objectStoreNames.contains("chunks")) {
        const c = db.createObjectStore("chunks", { keyPath: "id" });
        c.createIndex("fileId", "fileId");
      }

      // terms
      if (!db.objectStoreNames.contains("terms")) {
        const t = db.createObjectStore("terms", { keyPath: ["term", "chunkId"] });
        t.createIndex("term", "term");
        t.createIndex("chunkId", "chunkId");
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Generic helpers ───────────────────────────────────────────────────────────

function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode = "readonly"
): IDBTransaction {
  return db.transaction(stores, mode);
}

function put(store: IDBObjectStore, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function getAllByIndex<T>(
  store: IDBObjectStore,
  indexName: string,
  query: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.index(indexName).getAll(query);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function putSession(session: SessionRecord): Promise<void> {
  const db = await openDb();
  const t = tx(db, "sessions", "readwrite");
  await put(t.objectStore("sessions"), {
    ...session,
    titleLower: session.title.toLowerCase()
  });
}

export async function listSessions(): Promise<SessionRecord[]> {
  const db = await openDb();
  const t = tx(db, "sessions");
  const rows = await getAll<SessionRecord & { titleLower: string }>(
    t.objectStore("sessions")
  );
  return rows
    .map(({ titleLower: _tl, ...rest }) => rest as SessionRecord)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function renameSession(
  sessionId: string,
  title: string,
  titleSource: "auto" | "manual" = "manual"
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = tx(db, "sessions", "readwrite");
    const store = t.objectStore("sessions");
    const req = store.get(sessionId);
    req.onsuccess = () => {
      const existing = req.result;
      if (!existing) return resolve();
      const updated = { ...existing, title, titleSource, titleLower: title.toLowerCase() };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function putMessages(messages: MessageRecord[]): Promise<void> {
  if (!messages.length) return;
  const db = await openDb();
  const t = tx(db, "messages", "readwrite");
  const store = t.objectStore("messages");
  await Promise.all(messages.map((m) => put(store, m)));
}

export async function listMessages(sessionId: string): Promise<MessageRecord[]> {
  const db = await openDb();
  const t = tx(db, "messages");
  const rows = await getAllByIndex<MessageRecord>(
    t.objectStore("messages"),
    "sessionId",
    IDBKeyRange.only(sessionId)
  );
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, "settings").objectStore("settings").get(key);
    req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
    req.onerror = () => reject(req.error);
  });
}

export async function putSetting(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const t = tx(db, "settings", "readwrite");
  await put(t.objectStore("settings"), { key, value });
}

// ── File roots ────────────────────────────────────────────────────────────────

export async function putFileRoot(root: FileRootRecord): Promise<void> {
  const db = await openDb();
  const t = tx(db, "fileRoots", "readwrite");
  await put(t.objectStore("fileRoots"), root);
}

export async function listFileRoots(): Promise<FileRootRecord[]> {
  const db = await openDb();
  const t = tx(db, "fileRoots");
  return getAll<FileRootRecord>(t.objectStore("fileRoots"));
}

// ── Files ─────────────────────────────────────────────────────────────────────

export async function putFile(file: FileRecord): Promise<void> {
  const db = await openDb();
  const t = tx(db, "files", "readwrite");
  await put(t.objectStore("files"), {
    ...file,
    pathLower: file.path.toLowerCase()
  });
}

export async function listFilesByRoot(rootId: string): Promise<FileRecord[]> {
  const db = await openDb();
  const t = tx(db, "files");
  return getAllByIndex<FileRecord>(t.objectStore("files"), "rootId", IDBKeyRange.only(rootId));
}

// ── Chunks ────────────────────────────────────────────────────────────────────

export async function putChunks(chunks: ChunkRecord[]): Promise<void> {
  if (!chunks.length) return;
  const db = await openDb();
  const t = tx(db, "chunks", "readwrite");
  const store = t.objectStore("chunks");
  await Promise.all(chunks.map((c) => put(store, c)));
}

export async function listChunksByFile(fileId: string): Promise<ChunkRecord[]> {
  const db = await openDb();
  const t = tx(db, "chunks");
  const rows = await getAllByIndex<ChunkRecord>(
    t.objectStore("chunks"),
    "fileId",
    IDBKeyRange.only(fileId)
  );
  return rows.sort((a, b) => a.ordinal - b.ordinal);
}

// ── Terms ─────────────────────────────────────────────────────────────────────

export async function putTerms(terms: TermRecord[]): Promise<void> {
  if (!terms.length) return;
  const db = await openDb();
  const t = tx(db, "terms", "readwrite");
  const store = t.objectStore("terms");
  await Promise.all(terms.map((term) => put(store, term)));
}

export async function getTermChunks(term: string): Promise<TermRecord[]> {
  const db = await openDb();
  const t = tx(db, "terms");
  return getAllByIndex<TermRecord>(
    t.objectStore("terms"),
    "term",
    IDBKeyRange.only(term)
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchChunksByTerms(
  queryTerms: string[],
  limit: number
): Promise<Array<{ chunk: ChunkRecord; score: number }>> {
  if (!queryTerms.length) return [];

  const db = await openDb();

  // Gather TF scores per chunk for each query term
  const chunkScores = new Map<string, number>();

  for (const term of queryTerms) {
    const termRecords = await getTermChunks(term);
    for (const tr of termRecords) {
      chunkScores.set(tr.chunkId, (chunkScores.get(tr.chunkId) ?? 0) + tr.tf);
    }
  }

  if (!chunkScores.size) return [];

  // Fetch the top-scoring chunks
  const sorted = [...chunkScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const results: Array<{ chunk: ChunkRecord; score: number }> = [];

  for (const [chunkId, score] of sorted) {
    const chunk = await new Promise<ChunkRecord | null>((resolve, reject) => {
      const req = tx(db, "chunks").objectStore("chunks").get(chunkId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (chunk) results.push({ chunk, score });
  }

  return results;
}
