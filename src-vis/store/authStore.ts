import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminStatus, adminSetup, adminLogin, adminChange } from '../utils/pinApi';

/**
 * Admin authentication — now verified server-side (main.js /api/aura/admin/*).
 *
 * The old FNV-1a-in-the-browser check is gone: it stored a reversible, socket-
 * readable hash and the "login" was a client-side flag anyone could flip. The
 * password is now scrypt-checked on the adapter host; on success the server hands
 * back a signed session token, which is all this store keeps. Admin API calls
 * (vault read, config save) carry it as a Bearer token.
 */

interface AuthState {
    /** Whether an admin password has been set on the server (null = not yet checked). */
    configured: boolean | null;
    statusLoaded: boolean;
    /** Signed admin session token from the server, or null when logged out. */
    token: string | null;
    sessionActive: boolean;
    setStatus: (configured: boolean) => void;
    setSession: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            configured: null,
            statusLoaded: false,
            token: null,
            sessionActive: false,
            setStatus: (configured) => set({ configured, statusLoaded: true }),
            // A token is the session; the server enforces its expiry, so a stale one
            // simply fails the next admin call and bounces back to the login page.
            setSession: (token) => set({ token, sessionActive: !!token }),
        }),
        { name: 'aura-auth', partialize: (s) => ({ token: s.token, sessionActive: s.sessionActive }) },
    ),
);

/** Ask the server whether an admin password exists yet. Call on the login page. */
export async function loadAdminStatus(): Promise<void> {
    const { configured } = await adminStatus();
    useAuthStore.getState().setStatus(configured);
}

/** First-run: set the admin password on the server and start a session. */
export async function setupAdmin(password: string): Promise<boolean> {
    const res = await adminSetup(password);
    if (!res) return false;
    useAuthStore.getState().setSession(res.token);
    useAuthStore.getState().setStatus(true);
    return true;
}

/** Verify the password server-side; on success keep the returned session token. */
export async function loginWithPin(password: string): Promise<boolean> {
    const res = await adminLogin(password);
    if (!res) return false;
    useAuthStore.getState().setSession(res.token);
    return true;
}

/** Change the admin password (requires an active session). */
export async function changeAdmin(newPassword: string): Promise<boolean> {
    const token = useAuthStore.getState().token;
    if (!token) return false;
    return adminChange(token, newPassword);
}

/** The current admin Bearer token, or null. Used by admin-only API calls. */
export function adminToken(): string | null {
    return useAuthStore.getState().token;
}

export function logout(): void {
    useAuthStore.getState().setSession(null);
}
