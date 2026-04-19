/**
 * db.ts — IndexedDB persistence backbone for studio-os-chat v3
 *
 * Stores:
 *   sessions         — SessionRecord
 *   messages         — MessageRecord
 *   settings         — key/value
 *   fileRoots        — FileRootRecord
 *   files            — FileRecord
 *   chunks           — ChunkRecord
 *   terms            — TermRecord
 *   promptAssets     — PromptAssetRecord   (v3)
 *   promptRelations  — PromptRelationRecord (v3)
 *
 * v2: adds exportedAt + exportPath indexes to sessions
 * v3: adds promptAssets + promptRelations stores
 */

import type {
  SessionRecord,
  MessageRecord,
  FileRootRecord,
  FileRecord,
  ChunkRecord,
  TermRecord,
  OSMDIndex,
  PromptAssetRecord,
  PromptHistoryItem,
  PromptRelationRecord,
  PromotePromptInput,
} from "./types";

const DB_NAME = "studio-os-chat-v3";
const DB_VERSION = 3;

export const EXPORT_INDEX_SETTINGS_KEY = "__chat_export_index__";

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("updatedAt", "updatedAt");
        s.createIndex("titleLower", "titleLower");
        s.createIndex("exportedAt", "exportedAt");
        s.createIndex("exportPath", "exportPath");
      } else {
        const t = (e.target as IDBOpenDBRequest).transaction;
        const s = t?.objectStore("sessions");
        if (s && !s.indexNames.contains("exportedAt")) s.createIndex("exportedAt", "exportedAt");
        if (s && !s.indexNames.contains("exportPath")) s.createIndex("exportPath", "exportPath");
      }

      if (!db.objectStoreNames.contains("messages")) {
        const m = db.createObjectStore("messages", { keyPath: "id" });
        m.createIndex("sessionId", "sessionId");
        m.createIndex("sessionId_createdAt", ["sessionId", "createdAt"]);
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("fileRoots")) {
        db.createObjectStore("fileRoots", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("files")) {
        const f = db.createObjectStore("files", { keyPath: "id" });
        f.createIndex("rootId", "rootId");
        f.createIndex("pathLower", "pathLower");
        f.createIndex("ext", "ext");
        f.createIndex("updatedAt", "updatedAt");
      }

      if (!db.objectStoreNames.contains("chunks")) {
        const c = db.createObjectStore("chunks", { keyPath: "id" });
        c.createIndex("fileId", "fileId");
      }

      if (!db.objectStoreNames.contains("terms")) {
        const t = db.createObjectStore("terms", { keyPath: ["term", "chunkId"] });
        t.createIndex("term", "term");
        t.createIndex("chunkId", "chunkId");
      }

      if (!db.objectStoreNames.contains("promptAssets")) {
        const p = db.createObjectStore("promptAssets", { keyPath: "id" });
        p.createIndex("sessionId", "sessionId");
        p.createIndex("sourceMessageId", "sourceMessageId");
        p.createIndex("createdAt", "createdAt");
        p.createIndex("updatedAt", "updatedAt");
        p.createIndex("starred", "starred");
        p.createIndex("pinned", "pinned");
        p.createIndex("archived", "archived");
        p.createIndex("rating", "rating");
        p.createIndex("provider", "provider");
        p.createIndex("model", "model");
      }

      if (!db.objectStoreNames.contains("promptRelations")) {
        const r = db.createObjectStore("promptRelations", { keyPath: "id" });
        r.createIndex("fromPromptAssetId", "fromPromptAssetId");
        r.createIndex("toPromptAssetId", "toPromptAssetId");
        r.createIndex("type", "type");
        r.createIndex("createdAt", "createdAt");
      }
    };

    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

// ── Generic helpers ───────────────────────────────────────────────────────────

function tx(db: IDBDatabase, stores: string | string[], mode: IDBTransactionMode = "readonly"): IDBTransaction {
  return db.transaction(stores, mode);
}

function put(store: IDBObjectStore, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function del(store: IDBObjectStore, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function get<T>(store: IDBObjectStore, key: IDBValidKey): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
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

function getAllByIndex<T>(store: IDBObjectStore, indexName: string, query: IDBValidKey | IDBKeyRange): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.index(indexName).getAll(query);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function getByIndex<T>(store: IDBObjectStore, indexName: string, query: IDBValidKey | IDBKeyRange): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const req = store.index(indexName).get(query);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function putSession(session: SessionRecord): Promise<void> {
  const db = await openDb();
  const t = tx(db, "sessions", "readwrite");
  await put(t.objectStore("sessions"), { ...session, titleLower: session.title.toLowerCase() });
}

export async function listSessions(): Promise<SessionRecord[]> {
  const db = await openDb();
  const t = tx(db, "sessions");
  const rows = await getAll<SessionRecord & { titleLower: string }>(t.objectStore("sessions"));
  return rows.map(({ titleLower: _tl, ...rest }) => rest as SessionRecord).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function renameSession(sessionId: string, title: string, titleSource: "auto" | "manual" = "manual"): Promise<void> {
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

export async function updateSessionExportRef(
  sessionId: string,
  exportRef: { artifactId: string; exportPath: string; exportedAt: number; exportFormat: "osmd@1" }
): Promise<void> {
  const db = await openDb();
  const t = tx(db, "sessions", "readwrite");
  const store = t.objectStore("sessions");
  const existing = await get<SessionRecord>(store, sessionId);
  if (!existing) return;
  await put(store, {
    ...existing,
    exportArtifactId: exportRef.artifactId,
    exportPath: exportRef.exportPath,
    exportedAt: exportRef.exportedAt,
    exportFormat: exportRef.exportFormat,
  });
}

/**
 * deleteSession — removes the session record and all its messages from IndexedDB.
 * Cascade deletes messages by sessionId index.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openDb();
  // Delete all messages for this session first
  const msgTx = tx(db, "messages", "readwrite");
  const msgStore = msgTx.objectStore("messages");
  const messages = await getAllByIndex<MessageRecord>(msgStore, "sessionId", IDBKeyRange.only(sessionId));
  await Promise.all(messages.map((m) => del(msgStore, m.id)));
  // Delete the session record
  const sesTx = tx(db, "sessions", "readwrite");
  await del(sesTx.objectStore("sessions"), sessionId);
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
  const rows = await getAllByIndex<MessageRecord>(t.objectStore("messages"), "sessionId", IDBKeyRange.only(sessionId));
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function attachPromptAssetToMessage(messageId: string, promptAssetId: string): Promise<void> {
  const db = await openDb();
  const t = tx(db, "messages", "readwrite");
  const store = t.objectStore("messages");
  const existing = await get<MessageRecord>(store, messageId);
  if (!existing) return;
  await put(store, { ...existing, promptAssetId });
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

export async function getExportIndex<T = OSMDIndex>(): Promise<T | null> {
  return getSetting<T>(EXPORT_INDEX_SETTINGS_KEY);
}

export async function putExportIndex(value: unknown): Promise<void> {
  await putSetting(EXPORT_INDEX_SETTINGS_KEY, value);
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
  await put(t.objectStore("files"), { ...file, pathLower: file.path.toLowerCase() });
}

export async function listFilesByRoot(rootId: string): Promise<FileRecord[]> {
  const db = await openDb();
  const t = tx(db, "files");
  return getAllByIndex<FileRecord>(t.objectStore("files"), "rootId", IDBKeyRange.only(rootId));
}

export async function listAllFiles(): Promise<FileRecord[]> {
  const db = await openDb();
  const t = tx(db, "files");
  return getAll<FileRecord>(t.objectStore("files"));
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
  const rows = await getAllByIndex<ChunkRecord>(t.objectStore("chunks"), "fileId", IDBKeyRange.only(fileId));
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
  return getAllByIndex<TermRecord>(t.objectStore("terms"), "term", IDBKeyRange.only(term));
}

// ── Prompt assets ─────────────────────────────────────────────────────────────

export async function putPromptAsset(asset: PromptAssetRecord): Promise<void> {
  const db = await openDb();
  const t = tx(db, "promptAssets", "readwrite");
  await put(t.objectStore("promptAssets"), asset);
}

export async function getPromptAsset(id: string): Promise<PromptAssetRecord | null> {
  const db = await openDb();
  const t = tx(db, "promptAssets");
  return get<PromptAssetRecord>(t.objectStore("promptAssets"), id);
}

export async function getPromptAssetBySourceMessageId(messageId: string): Promise<PromptAssetRecord | null> {
  const db = await openDb();
  const t = tx(db, "promptAssets");
  return getByIndex<PromptAssetRecord>(t.objectStore("promptAssets"), "sourceMessageId", IDBKeyRange.only(messageId));
}

export async function listPromptAssets(): Promise<PromptAssetRecord[]> {
  const db = await openDb();
  const t = tx(db, "promptAssets");
  const rows = await getAll<PromptAssetRecord>(t.objectStore("promptAssets"));
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listStarredPromptAssets(): Promise<PromptAssetRecord[]> {
  const db = await openDb();
  const t = tx(db, "promptAssets");
  const rows = await getAllByIndex<PromptAssetRecord>(t.objectStore("promptAssets"), "starred", IDBKeyRange.only(true));
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listPinnedPromptAssets(): Promise<PromptAssetRecord[]> {
  const db = await openDb();
  const t = tx(db, "promptAssets");
  const rows = await getAllByIndex<PromptAssetRecord>(t.objectStore("promptAssets"), "pinned", IDBKeyRange.only(true));
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function updatePromptAsset(
  id: string,
  patch: Partial<Omit<PromptAssetRecord, "id" | "sourceMessageId" | "sessionId" | "createdAt" | "promotedAt">>
): Promise<void> {
  const db = await openDb();
  const t = tx(db, "promptAssets", "readwrite");
  const store = t.objectStore("promptAssets");
  const existing = await get<PromptAssetRecord>(store, id);
  if (!existing) return;
  await put(store, { ...existing, ...patch, updatedAt: Date.now() });
}

export async function promotePromptToAsset(input: PromotePromptInput): Promise<PromptAssetRecord> {
  const existing = await getPromptAssetBySourceMessageId(input.sourceMessageId);
  const now = Date.now();

  const asset: PromptAssetRecord = existing
    ? {
        ...existing,
        responseMessageId: input.responseMessageId ?? existing.responseMessageId,
        promptText: input.promptText || existing.promptText,
        updatedAt: now,
        starred: input.starred ?? existing.starred,
        pinned: input.pinned ?? existing.pinned,
        rating: input.rating ?? existing.rating,
        tags: input.tags ?? existing.tags,
        notes: input.notes ?? existing.notes,
        provider: input.provider ?? existing.provider,
        model: input.model ?? existing.model,
        inputTokenCount: input.inputTokenCount ?? existing.inputTokenCount,
        inputTokenEstimate: input.inputTokenEstimate ?? existing.inputTokenEstimate,
        outputTokenCount: input.outputTokenCount ?? existing.outputTokenCount,
        outputTokenEstimate: input.outputTokenEstimate ?? existing.outputTokenEstimate,
        usageSource: input.usageSource ?? existing.usageSource,
        latencyMs: input.latencyMs ?? existing.latencyMs,
      }
    : {
        id: crypto.randomUUID(),
        sourceMessageId: input.sourceMessageId,
        sessionId: input.sessionId,
        responseMessageId: input.responseMessageId,
        promptText: input.promptText,
        createdAt: now,
        updatedAt: now,
        promotedAt: now,
        starred: input.starred ?? false,
        pinned: input.pinned ?? false,
        archived: false,
        rating: input.rating,
        tags: input.tags ?? [],
        notes: input.notes,
        provider: input.provider,
        model: input.model,
        inputTokenCount: input.inputTokenCount,
        inputTokenEstimate: input.inputTokenEstimate,
        outputTokenCount: input.outputTokenCount,
        outputTokenEstimate: input.outputTokenEstimate,
        usageSource: input.usageSource ?? "unknown",
        latencyMs: input.latencyMs,
      };

  await putPromptAsset(asset);
  await attachPromptAssetToMessage(input.sourceMessageId, asset.id);
  return asset;
}

// ── Prompt relations ──────────────────────────────────────────────────────────

export async function putPromptRelation(relation: PromptRelationRecord): Promise<void> {
  const db = await openDb();
  const t = tx(db, "promptRelations", "readwrite");
  await put(t.objectStore("promptRelations"), relation);
}

export async function listPromptRelationsForAsset(assetId: string): Promise<PromptRelationRecord[]> {
  const db = await openDb();
  const t = tx(db, "promptRelations");
  const store = t.objectStore("promptRelations");
  const [fromRows, toRows] = await Promise.all([
    getAllByIndex<PromptRelationRecord>(store, "fromPromptAssetId", IDBKeyRange.only(assetId)),
    getAllByIndex<PromptRelationRecord>(store, "toPromptAssetId", IDBKeyRange.only(assetId)),
  ]);
  return [...fromRows, ...toRows].sort((a, b) => a.createdAt - b.createdAt);
}

// ── Prompt history ────────────────────────────────────────────────────────────

export async function listAllUserPrompts(): Promise<PromptHistoryItem[]> {
  const [sessions, assets, db] = await Promise.all([listSessions(), listPromptAssets(), openDb()]);
  const sessionMap = new Map<string, string>(sessions.map((s) => [s.id, s.title]));
  const assetByMsgId = new Map<string, PromptAssetRecord>(assets.map((a) => [a.sourceMessageId, a]));
  const allMessages = await getAll<MessageRecord>(tx(db, "messages").objectStore("messages"));
  return allMessages
    .filter((m) => m.role === "user")
    .map((m) => {
      const asset = assetByMsgId.get(m.id);
      return {
        messageId: m.id,
        sessionId: m.sessionId,
        promptText: m.content,
        createdAt: m.createdAt,
        sessionTitle: sessionMap.get(m.sessionId) ?? "Untitled",
        provider: m.provider ?? asset?.provider,
        model: m.model ?? asset?.model,
        assetId: asset?.id ?? m.promptAssetId,
        starred: asset?.starred,
        pinned: asset?.pinned,
        rating: asset?.rating,
      } satisfies PromptHistoryItem;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function searchUserPrompts(query: string): Promise<PromptHistoryItem[]> {
  const all = await listAllUserPrompts();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return all;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return all.filter((item) => {
    const hay = `${item.promptText} ${item.sessionTitle} ${item.provider ?? ""} ${item.model ?? ""}`.toLowerCase();
    return tokens.every((tok) => hay.includes(tok));
  });
}

// ── Full-text search ──────────────────────────────────────────────────────────

export async function searchChunksByTerms(queryTerms: string[], limit: number): Promise<Array<{ chunk: ChunkRecord; score: number }>> {
  if (!queryTerms.length) return [];
  const db = await openDb();
  const chunkScores = new Map<string, number>();
  for (const term of queryTerms) {
    const termRecords = await getTermChunks(term);
    for (const tr of termRecords) {
      chunkScores.set(tr.chunkId, (chunkScores.get(tr.chunkId) ?? 0) + tr.tf);
    }
  }
  if (!chunkScores.size) return [];
  const sorted = [...chunkScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
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
