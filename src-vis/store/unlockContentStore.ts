import { create } from 'zustand';
import type { PinRelock } from '../utils/pinLock';

/**
 * The protected content the server handed back after a successful /pin/unlock,
 * kept in memory only (a reload re-locks, exactly like pinStore). App merges it
 * over the redacted stub so the real widgets render once a view is unlocked.
 *
 * Lifecycle mirrors pinStore: `retain(activeKeys)` drops every `leave`-mode entry
 * that is not part of the view on screen, so a re-locked view's widgets leave the
 * browser again rather than lingering.
 */
interface UnlockEntry {
    content: unknown;
    relock: PinRelock;
}

interface UnlockContentState {
    content: Record<string, UnlockEntry>;
    setContent: (key: string, content: unknown, relock: PinRelock) => void;
    clear: (key: string) => void;
    retain: (activeKeys: string[]) => void;
    clearAll: () => void;
}

export const useUnlockContentStore = create<UnlockContentState>((set) => ({
    content: {},
    setContent: (key, content, relock) => set((s) => ({ content: { ...s.content, [key]: { content, relock } } })),
    clear: (key) =>
        set((s) => {
            if (!(key in s.content)) return s;
            const next = { ...s.content };
            delete next[key];
            return { content: next };
        }),
    retain: (activeKeys) =>
        set((s) => {
            const keep = new Set(activeKeys);
            const stale = Object.keys(s.content).filter((k) => s.content[k].relock === 'leave' && !keep.has(k));
            if (!stale.length) return s;
            const next = { ...s.content };
            stale.forEach((k) => delete next[k]);
            return { content: next };
        }),
    clearAll: () => set({ content: {} }),
}));
