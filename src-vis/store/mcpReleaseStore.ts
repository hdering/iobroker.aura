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
    /** Replace the whole map — what a /vault read yields. */
    setAll: (flags: Record<string, boolean>) => void;
    /** Optimistic single update after the switch was flipped. */
    set: (key: string, enabled: boolean) => void;
}

export const useMcpReleaseStore = create<McpReleaseState>((set) => ({
    flags: {},
    setAll: (flags) => set({ flags }),
    set: (key, enabled) => set((s) => ({ flags: { ...s.flags, [key]: enabled } })),
}));
