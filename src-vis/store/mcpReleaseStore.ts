import { create } from 'zustand';

/**
 * Which PIN-protected views are released for the MCP server to edit.
 *
 * RAM only, like unlockContentStore: the flags live in the server-side vault
 * (`security.json`, admin API only) and are pulled with the protected content
 * after the admin logged in. Keeping a copy in a persisted store would put a
 * permission flag into `config.dashboard`, which any connected socket client can
 * write — the release would then be one that anybody could grant themselves.
 *
 * Keys are the vault keys: `section:<sectionId>` / `tab:<sectionId>:<tabId>`.
 */
interface McpReleaseState {
    flags: Record<string, boolean>;
    /**
     * Releases flipped for a view the vault does not know yet — a PIN that was
     * typed but not saved. The vault only gets an entry once the adapter redacts
     * the saved config, so the switch would otherwise have to stay hidden until
     * the next save; it is applied from AdminLayout as soon as the entry appears.
     */
    pending: Record<string, boolean>;
    /** Replace the whole map — what a /vault read yields. Leaves `pending` alone. */
    setAll: (flags: Record<string, boolean>) => void;
    /** Optimistic single update after the switch was flipped. */
    set: (key: string, enabled: boolean) => void;
    setPending: (key: string, enabled: boolean) => void;
    clearPending: (key: string) => void;
    /** Forget a view entirely — its PIN was removed. */
    forget: (key: string) => void;
}

function without<T>(map: Record<string, T>, key: string): Record<string, T> {
    if (!(key in map)) return map;
    const next = { ...map };
    delete next[key];
    return next;
}

export const useMcpReleaseStore = create<McpReleaseState>((set) => ({
    flags: {},
    pending: {},
    setAll: (flags) => set({ flags }),
    set: (key, enabled) => set((s) => ({ flags: { ...s.flags, [key]: enabled } })),
    setPending: (key, enabled) => set((s) => ({ pending: { ...s.pending, [key]: enabled } })),
    clearPending: (key) => set((s) => ({ pending: without(s.pending, key) })),
    forget: (key) => set((s) => ({ flags: without(s.flags, key), pending: without(s.pending, key) })),
}));
