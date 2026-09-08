#!/usr/bin/env node
/**
 * Integration test for the server-side security API (lib/security/apiHandler.js),
 * driven over a real http.Server with a temp on-disk vault — no adapter, no
 * ioBroker. Covers admin setup/login/change, the Bearer-gated vault read and the
 * PIN unlock incl. the brute-force lockout.
 *
 *   npm run test:security-api
 */

import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSecurityApi } = require('../../lib/security/apiHandler.js');
const { generateServerSecret } = require('../../lib/security/authCore.js');
const vaultMod = require('../../lib/security/dashboardVault.js');

let pass = 0;
const ok = (cond, msg) => {
    assert.ok(cond, msg);
    pass++;
};

// ── temp vault seeded with one protected section (PIN 1234) ──────────────────
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-secapi-'));
const vault = new vaultMod.VaultFile(dir);
{
    const config = {
        layouts: [
            {
                id: 'l1',
                slug: 'default',
                sections: [
                    {
                        id: 'sLocked',
                        name: 'Musik',
                        slug: 'musik',
                        pin: '1234',
                        tabs: [{ id: 't', name: 'A', slug: 'a', widgets: [{ id: 'wSecret', type: 'gauge' }] }],
                    },
                ],
            },
        ],
    };
    const { protected: prot } = vaultMod.splitDashboard(config);
    const data = vaultMod.DEFAULT_VAULT();
    data.serverSecret = generateServerSecret();
    data.sections = vaultMod.buildVaultSections(prot).sections;
    vault.save(data);
}

const api = createSecurityApi({ vault, log: { info() {}, warn() {}, error() {} } });
const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    if (parsedUrl.pathname.startsWith('/api/aura/')) {
        api.handle(req, res, parsedUrl);
        return;
    }
    res.writeHead(404);
    res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/api/aura`;

const call = async (method, route, { body, token } = {}) => {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}/${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try {
        json = await res.json();
    } catch {
        /* no body */
    }
    return { status: res.status, json };
};

try {
    // ── admin setup / login ──────────────────────────────────────────────────
    let r = await call('GET', 'admin/status');
    ok(r.status === 200 && r.json.configured === false, 'status: not configured before setup');

    r = await call('POST', 'admin/setup', { body: { password: '12' } });
    ok(r.status === 400, 'setup rejects too-short password');

    r = await call('POST', 'admin/setup', { body: { password: 'letmein' } });
    ok(r.status === 200 && r.json.token, 'setup returns an admin token');
    let adminToken = r.json.token;

    r = await call('GET', 'admin/status');
    ok(r.status === 200 && r.json.configured === true, 'status: configured after setup');

    r = await call('POST', 'admin/setup', { body: { password: 'again' } });
    ok(r.status === 409, 'setup refused once configured');

    r = await call('POST', 'admin/login', { body: { password: 'wrong' } });
    ok(r.status === 401, 'login rejects wrong password');

    r = await call('POST', 'admin/login', { body: { password: 'letmein' } });
    ok(r.status === 200 && r.json.token, 'login returns a token for the right password');
    adminToken = r.json.token;

    // ── vault read is Bearer-gated ───────────────────────────────────────────
    r = await call('GET', 'vault');
    ok(r.status === 401, 'vault read without token → 401');

    r = await call('GET', 'vault', { token: 'not.a.valid.token' });
    ok(r.status === 401, 'vault read with a forged token → 401');

    r = await call('GET', 'vault', { token: adminToken });
    ok(r.status === 200 && r.json.sections['section:sLocked'], 'vault read with admin token returns sections');
    const secMeta = r.json.sections['section:sLocked'];
    ok(
        secMeta.content.tabs[0].widgets[0].id === 'wSecret',
        'vault content carries the protected widgets (for the editor)',
    );
    ok(!('pin' in secMeta) && !('hash' in secMeta), 'vault read never exposes the PIN or its hash');

    // ── admin change ─────────────────────────────────────────────────────────
    r = await call('POST', 'admin/change', { token: adminToken, body: { newPassword: 'newpass' } });
    ok(r.status === 200, 'admin can change the password');
    r = await call('POST', 'admin/login', { body: { password: 'newpass' } });
    ok(r.status === 200, 'login works with the new password');
    r = await call('POST', 'admin/login', { body: { password: 'letmein' } });
    ok(r.status === 401, 'old password no longer works');

    // ── PIN unlock ───────────────────────────────────────────────────────────
    r = await call('POST', 'pin/unlock', { body: { key: 'section:sLocked', pin: '0000' } });
    ok(r.status === 401, 'unlock rejects the wrong PIN');

    r = await call('POST', 'pin/unlock', { body: { key: 'section:sLocked', pin: '1234' } });
    ok(r.status === 200 && r.json.unlockToken, 'unlock accepts the right PIN and returns a token');
    ok(r.json.content.tabs[0].widgets[0].id === 'wSecret', 'unlock returns the protected content');

    r = await call('POST', 'pin/unlock', { body: { key: 'section:doesNotExist', pin: '1234' } });
    ok(r.status === 401, 'unlock for an unknown key → 401 (no oracle)');

    // ── brute-force lockout (fresh key so the earlier success did not reset) ──
    const bruteKey = 'section:sLocked';
    // First wipe attempts by a correct unlock, then 5 misses → 6th blocked.
    await call('POST', 'pin/unlock', { body: { key: bruteKey, pin: '1234' } });
    for (let i = 0; i < 5; i++) {
        const miss = await call('POST', 'pin/unlock', { body: { key: bruteKey, pin: '9999' } });
        ok(miss.status === 401, `miss ${i + 1} returns 401`);
    }
    r = await call('POST', 'pin/unlock', { body: { key: bruteKey, pin: '9999' } });
    ok(r.status === 429 && r.json.retryAfter > 0, 'sixth miss is locked out (429 with retryAfter)');
    // Even the CORRECT pin is refused while locked out.
    r = await call('POST', 'pin/unlock', { body: { key: bruteKey, pin: '1234' } });
    ok(r.status === 429, 'correct PIN also blocked during lockout window');

    // ── unknown route → JSON 404 (never the SPA) ─────────────────────────────
    r = await call('GET', 'nope');
    ok(r.status === 404 && r.json && r.json.error, 'unknown endpoint → JSON 404');
} finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`security-api: ${pass} checks passed`);
