/**
 * Views whose PIN the admin removed — dropped from the server-side vault after
 * the next successful save.
 *
 * Why not right away: as long as a view is protected, the vault holds the ONLY
 * copy of its content (`config.dashboard` carries a redacted stub). The editor
 * has the real content in memory, so removing the PIN there is safe — but until
 * that content has been written back to the state, dropping the vault entry would
 * put it one „Verwerfen“ away from gone. So the click clears the PIN locally, the
 * save writes the content in plaintext, and only then does the vault forget.
 *
 * A plain module-level set, not a store: nothing renders from it.
 */
import { vaultRemove } from './pinApi';

const queued = new Set<string>();

/** The PIN of this view was removed in the editor. */
export function queueVaultRemoval(key: string): void {
    queued.add(key);
}

/** A new PIN was typed for this view after all — keep its (fresh) vault entry. */
export function unqueueVaultRemoval(key: string): void {
    queued.delete(key);
}

/**
 * Called right after a save went out. Without an admin token nothing is dropped
 * and the keys stay queued for the next save — the entry is inert either way
 * (the config no longer marks the view as protected).
 */
export function flushVaultRemovals(token: string | null): void {
    if (!queued.size || !token) return;
    const keys = [...queued];
    queued.clear();
    for (const key of keys) void vaultRemove(token, key);
}

/** Tests only. */
export function queuedVaultRemovals(): string[] {
    return [...queued];
}
