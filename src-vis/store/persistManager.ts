import type { StateStorage } from 'zustand/middleware';
import { setStateDirect, getStateDirect } from '../hooks/useIoBroker';

const IOBROKER_CONFIG_KEY = 'aura.0.config.dashboard';
const IOBROKER_BACKUP_KEY = 'aura.0.config.dashboard_backup';
const SYNC_STORE_KEYS = ['aura-dashboard', 'aura-theme', 'aura-groups', 'aura-config', 'aura-global-settings', 'aura-group-defs'] as const;

export const BACKUP_TS_KEY = '_ts';

// Configurable max number of backups to keep (default 5, set by AdminLayout on mount)
let maxBackups = 5;

/** Call once on admin startup to sync the user-configured backup count. */
export function configureBackup(opts: { maxBackups: number }): void {
  maxBackups = Math.max(1, Math.min(20, opts.maxBackups));
}

// All writes from managed stores go here instead of directly to localStorage
const pending = new Map<string, string>();
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

export function subscribeDirty(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function isDirty(): boolean {
  return pending.size > 0;
}

// Timestamp of last saveToIoBroker call — used to block useConfigSync from
// overwriting local state before ioBroker has processed the new value.
let savedAt = 0;
export function isSavingRecently(): boolean { return Date.now() - savedAt < 5000; }

/** Immediately commit one key from pending to localStorage without leaving it dirty. */
export function flushKey(key: string): void {
  const value = pending.get(key);
  if (value !== undefined) {
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn('[persistManager] localStorage quota exceeded for key:', key);
    }
    pending.delete(key);
    notify();
  }
}

/** Flush buffered writes to localStorage.
 *  Keys that exceed the quota are kept in pending so saveToIoBroker() can still
 *  read the latest data — they do NOT prevent the ioBroker sync from succeeding. */
export function saveAll(): void {
  pending.forEach((val, key) => {
    try {
      localStorage.setItem(key, val);
      pending.delete(key);
    } catch {
      console.warn('[persistManager] localStorage quota exceeded for key:', key, '— will sync to ioBroker only');
    }
  });
  notify();
}

/** Discard buffered writes and restore in-memory store state from localStorage.
 *  Pass the rehydrate functions of all managed stores. */
export function revertAll(rehydrateFns: Array<() => void>): void {
  pending.clear();
  rehydrateFns.forEach((fn) => fn());
  notify();
}

/** Read the current backup list from ioBroker, prepend a new entry, trim to
 *  maxBackups, and write back.  Runs fire-and-forget — errors are silenced.
 *  aura-group-defs is excluded from backup entries: it can be very large
 *  (base64 images) and is still present in the main config state. */
async function writeBackup(payload: Record<string, unknown>): Promise<void> {
  try {
    const state = await getStateDirect(IOBROKER_BACKUP_KEY);
    let backups: Array<Record<string, unknown>> = [];
    if (state?.val) {
      const raw = String(state.val);
      // Skip parsing if backup is large (old format with aura-group-defs in every
      // entry can reach 50 MB+). Parsing that much JSON blocks the main thread for
      // ~10 s. Discard once; subsequent backups are small and fast.
      if (raw.length < 500_000) {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (Array.isArray(parsed.backups)) {
            // Strip aura-group-defs from any existing entries (old format migration)
            backups = (parsed.backups as Array<Record<string, unknown>>).map((e) => {
              const { 'aura-group-defs': _gd, ...rest } = e;
              return rest;
            });
          } else if (parsed[BACKUP_TS_KEY]) {
            const { 'aura-group-defs': _gd, ...rest } = parsed;
            backups = [rest];
          }
        } catch { /* start fresh */ }
      }
    }
    // Exclude aura-group-defs to keep backup entries small
    const { 'aura-group-defs': _gd, ...backupPayload } = payload;
    const entry = { [BACKUP_TS_KEY]: new Date().toISOString(), ...backupPayload };
    backups = [entry, ...backups].slice(0, maxBackups);
    setStateDirect(IOBROKER_BACKUP_KEY, JSON.stringify({ backups }), true);
  } catch { /* socket not connected – silently skip */ }
}

/**
 * Write all managed store blobs to ioBroker so any browser connecting to
 * the same ioBroker instance gets the current config.
 * Must be called AFTER saveAll() so localStorage is up-to-date.
 *
 * @param backup  When true (default), also appends a timestamped backup entry.
 *                Pass false for auto-saves to avoid reading/writing the full
 *                backup array (potentially MBs) on every auto-save tick.
 */
export function saveToIoBroker({ backup = true }: { backup?: boolean } = {}): void {
  savedAt = Date.now();
  const payload: Record<string, unknown> = {};
  SYNC_STORE_KEYS.forEach((key) => {
    // pending takes priority: covers keys that couldn't be written to localStorage due to quota.
    // Keep values as raw JSON strings — avoids an expensive JSON.parse + re-stringify cycle
    // for large stores (e.g. aura-group-defs with base64 images).
    // All consumers (useConfigSync, AdminLayout, applyBackupEntry) handle string values.
    payload[key] = pending.get(key) ?? localStorage.getItem(key) ?? null;
  });
  // Keys that couldn't go to localStorage are now going to ioBroker — clear them from pending
  SYNC_STORE_KEYS.forEach((key) => { if (pending.has(key)) { pending.delete(key); } });
  notify();
  try {
    setStateDirect(IOBROKER_CONFIG_KEY, JSON.stringify(payload));
    if (backup) void writeBackup(payload);
  } catch { /* socket not yet connected – silently skip */ }
}

/** Custom Zustand storage: reads directly from localStorage, writes to buffer */
export const managedStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    // If the serialized value is identical to what's already in localStorage
    // (e.g. during store hydration / default-field merges), don't mark as dirty.
    if (localStorage.getItem(name) === value) {
      pending.delete(name);
      return;
    }
    pending.set(name, value);
    notify();
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    pending.delete(name);
    notify();
  },
};
