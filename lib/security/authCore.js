'use strict';

/**
 * Server-side crypto primitives for Aura's PIN / admin protection.
 *
 * Everything that has to stay a secret (the admin password, a section/tab PIN) is
 * only ever *verified* here, on the adapter host — the plaintext never has to be
 * shipped to the browser, and only a salted scrypt hash is stored at rest. The
 * frontend used FNV-1a client-side because the dashboard is served over plain
 * HTTP (no `crypto.subtle` outside a secure context); moving the check to the
 * Node process removes that constraint entirely.
 *
 * Pure module: no fs, no adapter, no state — so tools/tests/security-core.mjs can
 * bundle and drive it directly.
 */

const crypto = require('node:crypto');

// scrypt is deliberately expensive so a stolen hash file resists offline guessing.
// N=16384 (~16 ms/derivation here) is a sane interactive cost; raise N (power of
// two) if the host can spare it. A 4-digit PIN is still only 10 000 candidates —
// the online brute-force defence is the rate-limit in the endpoint, not the KDF.
const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Constant-time string compare that never throws and never short-circuits on length. */
function timingSafeEqualStr(a, b) {
    const ba = Buffer.from(String(a == null ? '' : a), 'utf8');
    const bb = Buffer.from(String(b == null ? '' : b), 'utf8');
    // timingSafeEqual requires equal length; hash the inputs to a fixed width so a
    // length mismatch does not itself leak through an early return.
    const ha = crypto.createHash('sha256').update(ba).digest();
    const hb = crypto.createHash('sha256').update(bb).digest();
    return crypto.timingSafeEqual(ha, hb);
}

/** Derive a fresh salted scrypt hash for a secret. Returns `{ salt, hash }` (hex). */
function hashSecret(plain) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString('hex');
    return { salt, hash };
}

/** `true` when `plain` reproduces `hash` under `salt`. Timing-safe, never throws. */
function verifySecret(plain, salt, hash) {
    if (!salt || !hash) return false;
    let derived;
    try {
        derived = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString('hex');
    } catch {
        return false;
    }
    return timingSafeEqualStr(derived, hash);
}

// ── compact signed tokens (admin session + per-view unlock grant) ───────────────
// A token is `<b64url(payload)>.<b64url(hmacSHA256(payload))>`. Self-contained and
// stateless: the server keeps only the signing secret, not a session table.

function b64url(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
    return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Sign `payload` (plus an `exp` set `ttlMs` from now) with `secret`. */
function signToken(payload, secret, ttlMs) {
    const body = { ...payload, exp: Date.now() + ttlMs };
    const p = b64url(JSON.stringify(body));
    const sig = b64url(crypto.createHmac('sha256', secret).update(p).digest());
    return `${p}.${sig}`;
}

/** Verify + decode a token. Returns the payload, or `null` if forged or expired. */
function verifyToken(token, secret) {
    if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
    const dot = token.indexOf('.');
    const p = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!p || !sig) return null;
    const expected = b64url(crypto.createHmac('sha256', secret).update(p).digest());
    if (!timingSafeEqualStr(sig, expected)) return null;
    let body;
    try {
        body = JSON.parse(b64urlDecode(p).toString('utf8'));
    } catch {
        return null;
    }
    if (!body || typeof body.exp !== 'number' || body.exp < Date.now()) return null;
    return body;
}

/** A random hex secret for signing tokens (generated once, then persisted). */
function generateServerSecret() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    timingSafeEqualStr,
    hashSecret,
    verifySecret,
    signToken,
    verifyToken,
    generateServerSecret,
    SCRYPT_PARAMS,
};
