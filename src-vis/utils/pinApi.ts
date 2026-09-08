/**
 * Client for Aura's server-side security API (main.js → lib/security/apiHandler).
 *
 * Everything secret — the admin password, a section/tab PIN — is verified on the
 * adapter host, not here: these calls send the plaintext once over the (same-
 * origin) connection and get back a signed token or the unlocked content. The
 * frontend never holds a PIN or a password hash. Served on the Aura origin, so
 * plain relative URLs; in the vite dev server (which is not the adapter) these
 * 404 and the UI degrades to "not configured" / "unlock failed".
 */

const API_BASE = '/api/aura';

export interface UnlockResult {
    content: unknown;
    pinRelock: 'leave' | 'session';
    unlockToken: string;
}

async function request(
    method: string,
    route: string,
    opts: { body?: unknown; token?: string } = {},
): Promise<{ status: number; json: any }> {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    try {
        const res = await fetch(`${API_BASE}/${route}`, {
            method,
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
        let json: any = null;
        try {
            json = await res.json();
        } catch {
            /* empty body */
        }
        return { status: res.status, json };
    } catch {
        // Network error (e.g. dev server without the adapter behind it).
        return { status: 0, json: null };
    }
}

export async function adminStatus(): Promise<{ configured: boolean }> {
    const { status, json } = await request('GET', 'admin/status');
    return { configured: status === 200 && !!json?.configured };
}

export async function adminSetup(password: string): Promise<{ token: string } | null> {
    const { status, json } = await request('POST', 'admin/setup', { body: { password } });
    return status === 200 && json?.token ? { token: json.token } : null;
}

export async function adminLogin(password: string): Promise<{ token: string } | null> {
    const { status, json } = await request('POST', 'admin/login', { body: { password } });
    return status === 200 && json?.token ? { token: json.token } : null;
}

export async function adminChange(token: string, newPassword: string): Promise<boolean> {
    const { status } = await request('POST', 'admin/change', { body: { newPassword }, token });
    return status === 200;
}

export interface VaultSectionMeta {
    scope: 'section' | 'tab';
    name: string;
    pinRelock: 'leave' | 'session';
    content: any;
}

export async function vaultRead(token: string): Promise<Record<string, VaultSectionMeta> | null> {
    const { status, json } = await request('GET', 'vault', { token });
    return status === 200 && json?.sections ? json.sections : null;
}

export type UnlockOutcome =
    | { ok: true; result: UnlockResult }
    | { ok: false; reason: 'wrong' | 'ratelimited' | 'error'; retryAfter?: number };

export async function pinUnlock(key: string, pin: string): Promise<UnlockOutcome> {
    const { status, json } = await request('POST', 'pin/unlock', { body: { key, pin } });
    if (status === 200 && json)
        return {
            ok: true,
            result: { content: json.content, pinRelock: json.pinRelock, unlockToken: json.unlockToken },
        };
    if (status === 429) return { ok: false, reason: 'ratelimited', retryAfter: json?.retryAfter };
    if (status === 401) return { ok: false, reason: 'wrong' };
    return { ok: false, reason: 'error' };
}
