/**
 * quotaGuard.ts — Phase 5 C-3
 *
 * IndexedDB persistence + storage quota guard.
 *
 * API:
 *   requestPersistentStorage()  — calls navigator.storage.persist() once per session
 *   getStorageEstimate()        — returns { usage, quota, usedFraction, usedMB, quotaMB }
 *   checkQuotaBeforeIngest()    — returns { ok, message } — call before large ingests
 *   useStorageQuota()           — React hook: polls quota every `intervalMs` ms
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StorageEstimate {
  /** Bytes used */
  usage: number;
  /** Bytes available */
  quota: number;
  /** usage / quota (0–1) */
  usedFraction: number;
  /** usage in MB (2 dp) */
  usedMB: number;
  /** quota in MB (2 dp) */
  quotaMB: number;
  /** true if storage.persist() has been granted */
  persisted: boolean;
}

export interface QuotaCheckResult {
  ok: boolean;
  /** Human-readable message — empty string when ok */
  message: string;
  estimate: StorageEstimate | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Warn when storage is above this fraction (80%) */
export const QUOTA_WARN_FRACTION = 0.8;

/** Reject ingest when storage is above this fraction (90%) */
export const QUOTA_REJECT_FRACTION = 0.9;

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Request persistent storage (durable across browser cache eviction).
 * Safe to call multiple times — only fires the permission request once.
 * Returns true if granted, false if denied or API unavailable.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator?.storage?.persist) return false;
  try {
    const granted = await navigator.storage.persist();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Read current storage estimate from the browser.
 * Returns null if the API is unavailable (e.g. in test environments).
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator?.storage?.estimate) return null;
  try {
    const [raw, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted?.() ?? Promise.resolve(false),
    ]);
    const usage = raw.usage ?? 0;
    const quota = raw.quota ?? 1;
    return {
      usage,
      quota,
      usedFraction: usage / quota,
      usedMB: Math.round((usage / 1024 / 1024) * 100) / 100,
      quotaMB: Math.round((quota / 1024 / 1024) * 100) / 100,
      persisted,
    };
  } catch {
    return null;
  }
}

/**
 * Check whether there is enough quota to proceed with an ingest.
 * Returns { ok: true } when safe, { ok: false, message } when at risk.
 */
export async function checkQuotaBeforeIngest(): Promise<QuotaCheckResult> {
  const estimate = await getStorageEstimate();
  if (!estimate) return { ok: true, message: "", estimate: null };

  if (estimate.usedFraction >= QUOTA_REJECT_FRACTION) {
    return {
      ok: false,
      message: `Storage is ${Math.round(estimate.usedFraction * 100)}% full ` +
        `(${estimate.usedMB} MB of ${estimate.quotaMB} MB used). ` +
        `Please remove some indexed sources before adding more files.`,
      estimate,
    };
  }

  if (estimate.usedFraction >= QUOTA_WARN_FRACTION) {
    return {
      ok: true,
      message: `Storage is ${Math.round(estimate.usedFraction * 100)}% full ` +
        `(${estimate.usedMB} MB of ${estimate.quotaMB} MB). ` +
        `Consider removing unused sources soon.`,
      estimate,
    };
  }

  return { ok: true, message: "", estimate };
}

// ── React hook ────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

/**
 * React hook: returns live StorageEstimate, refreshes every `intervalMs` ms.
 * Also calls requestPersistentStorage() on first mount.
 *
 * @param intervalMs  Poll interval in ms (default: 30 000 = 30 s)
 */
export function useStorageQuota(intervalMs = 30_000): StorageEstimate | null {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const est = await getStorageEstimate();
      if (mounted) setEstimate(est);
    }

    // Request persistence on first mount (best-effort)
    requestPersistentStorage();
    refresh();

    const timer = setInterval(refresh, intervalMs);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return estimate;
}
