'use strict';

/**
 * Unit tests for the update check (issue #617).
 *
 * Covered: reading the latest version out of the activated ioBroker repositories,
 * the semver comparison that keeps a beta installation from being told to
 * "update" to the older stable it came from, the opt-in frontend notice and its
 * once-per-version guarantee, and the `updateInfo` sendTo command.
 *
 * main.js is loaded with @iobroker/adapter-core stubbed out, so the adapter class
 * can be instantiated without a running js-controller.
 */

const assert = require('assert');

// ── Stub @iobroker/adapter-core before main.js pulls it in ────────────────────
class FakeAdapter {
    constructor(options) {
        this.name = options.name;
        this.namespace = 'aura.0';
        this.log = { info() {}, warn() {}, error() {}, debug() {} };
    }
    on() {}
}
const corePath = require.resolve('@iobroker/adapter-core');
require.cache[corePath] = {
    id: corePath,
    filename: corePath,
    loaded: true,
    exports: { Adapter: FakeAdapter },
};

const createAdapter = require('../main.js');

/**
 * Adapter with an in-memory state store and a fake system.config /
 * system.repositories pair. `repos` maps a repository name to the version it
 * offers for aura; `active` is what system.config.common.activeRepo holds.
 */
function makeAdapter({ installed = '0.54.2', repos = {}, active = 'stable', config = {}, language = 'de' } = {}) {
    const a = createAdapter({});
    const states = new Map();

    a.config = config;
    a._installedVersion = installed;
    a.getStateAsync = async (id) => (states.has(id) ? states.get(id) : null);
    a.setStateAsync = async (id, val, ack) => {
        if (val && typeof val === 'object' && 'val' in val) {
            states.set(id, { val: val.val, ack: !!val.ack });
        } else {
            states.set(id, { val, ack: !!ack });
        }
    };
    a.getForeignObjectAsync = async (id) => {
        if (id === 'system.config') return { common: { activeRepo: active, language } };
        if (id === 'system.repositories') {
            const out = {};
            for (const [name, version] of Object.entries(repos)) {
                // `null` stands for a repository that has never been fetched.
                out[name] = { json: version === null ? null : { aura: { version } } };
            }
            return { native: { repositories: out } };
        }
        return null;
    };
    a._replies = [];
    a.sendTo = (_from, _command, result) => {
        a._replies.push(result);
    };

    a._val = (id) => (states.has(id) ? states.get(id).val : undefined);
    a._history = () => JSON.parse(String(a._val('messages.history') ?? '[]'));
    a._last = () => JSON.parse(String(a._val('messages.lastMessage') || '{}'));
    return a;
}

(async () => {
    // ── A newer repository version is an available update ────────────────────
    {
        const a = makeAdapter({ installed: '0.54.2', repos: { stable: '0.55.0' } });
        const info = await a._checkForUpdate();
        assert.strictEqual(info.updateAvailable, true);
        assert.strictEqual(info.latest, '0.55.0');
        assert.strictEqual(info.installed, '0.54.2');
        assert.strictEqual(info.repo, 'stable');
        assert.ok(info.checkedAt > 0, 'the check stamps its time');
        console.log('✓ a newer repository version is reported as available');
    }

    // ── Same or older repository version is not an update ────────────────────
    // The second case is the everyday GitHub install: the working copy is ahead
    // of whatever the repository lists.
    {
        const same = await makeAdapter({ installed: '0.55.0', repos: { stable: '0.55.0' } })._checkForUpdate();
        assert.strictEqual(same.updateAvailable, false, 'equal versions');
        assert.strictEqual(same.latest, '0.55.0', 'the repo version is still reported');

        const ahead = await makeAdapter({ installed: '0.56.0', repos: { stable: '0.55.0' } })._checkForUpdate();
        assert.strictEqual(ahead.updateAvailable, false, 'installed is ahead of the repo');
        console.log('✓ an equal or older repository version is not an update');
    }

    // ── Prereleases order below their release ────────────────────────────────
    {
        const fromStable = await makeAdapter({
            installed: '0.55.0-beta.1',
            repos: { stable: '0.54.2' },
        })._checkForUpdate();
        assert.strictEqual(fromStable.updateAvailable, false, 'a beta must not be downgraded to the older stable');

        const nextBeta = await makeAdapter({
            installed: '0.55.0-beta.1',
            repos: { beta: '0.55.0-beta.2' },
            active: 'beta',
        })._checkForUpdate();
        assert.strictEqual(nextBeta.updateAvailable, true, 'the next beta is an update');

        const release = await makeAdapter({
            installed: '0.55.0-beta.2',
            repos: { stable: '0.55.0' },
        })._checkForUpdate();
        assert.strictEqual(release.updateAvailable, true, 'the finished release beats its own beta');
        console.log('✓ prereleases order below their release');
    }

    // ── Several activated repositories: the highest offer wins ───────────────
    {
        const a = makeAdapter({
            installed: '0.54.2',
            repos: { stable: '0.54.2', beta: '0.56.0' },
            active: ['stable', 'beta'],
        });
        const info = await a._checkForUpdate();
        assert.strictEqual(info.latest, '0.56.0');
        assert.strictEqual(info.repo, 'beta');

        // A repository the user has not activated is ignored.
        const only = await makeAdapter({
            installed: '0.54.2',
            repos: { stable: '0.54.2', beta: '0.56.0' },
            active: 'stable',
        })._checkForUpdate();
        assert.strictEqual(only.updateAvailable, false, 'the deactivated beta repo must not leak in');
        console.log('✓ the highest offer among the activated repositories wins');
    }

    // ── Nothing usable in the repository is not an error ─────────────────────
    {
        const never = await makeAdapter({ repos: { stable: null } })._checkForUpdate();
        assert.strictEqual(never.latest, null, 'a repository that was never fetched');
        assert.strictEqual(never.updateAvailable, false);

        const junk = await makeAdapter({ repos: { stable: 'nightly' } })._checkForUpdate();
        assert.strictEqual(junk.latest, null, 'an unparsable version');

        const empty = await makeAdapter({ repos: {} })._checkForUpdate();
        assert.strictEqual(empty.latest, null, 'no repositories at all');
        console.log('✓ an empty or unusable repository object is handled quietly');
    }

    // ── The frontend notice is off unless it is switched on ──────────────────
    {
        const off = makeAdapter({ installed: '0.54.2', repos: { stable: '0.55.0' } });
        await off._checkForUpdate();
        assert.strictEqual(off._val('messages.lastMessage'), undefined, 'no message without the opt-in');
        assert.deepStrictEqual(off._history(), [], 'and nothing in the archive');
        console.log('✓ the frontend notice stays silent by default');
    }

    // ── Switched on: exactly one message per new version ─────────────────────
    {
        const a = makeAdapter({
            installed: '0.54.2',
            repos: { stable: '0.55.0' },
            config: { updateNotify: true },
        });
        await a._checkForUpdate();
        const msg = a._last();
        assert.strictEqual(msg.id, 'aura-update-0.55.0');
        assert.strictEqual(msg.severity, 'info');
        assert.ok(msg.text.includes('0.55.0') && msg.text.includes('0.54.2'), 'names both versions');
        assert.strictEqual(a._history().length, 1);

        // A second check finds the same version — the archive is the memory, so
        // it must not raise the notice again (an adapter restart included).
        await a._checkForUpdate();
        assert.strictEqual(a._history().length, 1, 'no duplicate for the same version');
        assert.strictEqual(a._last().id, 'aura-update-0.55.0', 'and no second toast');
        console.log('✓ a new version is announced exactly once');
    }

    // ── A newer version replaces the obsolete notice ─────────────────────────
    {
        const a = makeAdapter({
            installed: '0.54.2',
            repos: { stable: '0.55.0' },
            config: { updateNotify: true },
        });
        await a._checkForUpdate();
        a.getForeignObjectAsync = async (id) =>
            id === 'system.repositories'
                ? { native: { repositories: { stable: { json: { aura: { version: '0.56.0' } } } } } }
                : { common: { activeRepo: 'stable', language: 'de' } };
        await a._checkForUpdate();
        const history = a._history();
        assert.strictEqual(history.length, 1, 'the notice for 0.55.0 is gone');
        assert.strictEqual(history[0].id, 'aura-update-0.56.0');
        console.log('✓ a newer version replaces the obsolete notice');
    }

    // ── The notice speaks the system language ────────────────────────────────
    {
        const en = makeAdapter({
            installed: '0.54.2',
            repos: { stable: '0.55.0' },
            config: { updateNotify: true },
            language: 'en',
        });
        await en._checkForUpdate();
        assert.strictEqual(en._last().title, 'Update available');

        const de = makeAdapter({
            installed: '0.54.2',
            repos: { stable: '0.55.0' },
            config: { updateNotify: true },
            language: 'de',
        });
        await de._checkForUpdate();
        assert.strictEqual(de._last().title, 'Update verfügbar');
        console.log('✓ the notice speaks the system language');
    }

    // ── sendTo updateInfo serves the cache and can be forced ─────────────────
    {
        const a = makeAdapter({ installed: '0.54.2', repos: { stable: '0.55.0' } });
        await a.onMessage({ command: 'updateInfo', from: 'system.adapter.admin.0', callback: 1, message: {} });
        assert.strictEqual(a._replies.length, 1);
        assert.strictEqual(a._replies[0].updateAvailable, true);
        assert.strictEqual(a._replies[0].latest, '0.55.0');

        // Without `refresh` the cached verdict is served, even after the repo moved.
        a.getForeignObjectAsync = async (id) =>
            id === 'system.repositories'
                ? { native: { repositories: { stable: { json: { aura: { version: '0.57.0' } } } } } }
                : { common: { activeRepo: 'stable', language: 'de' } };
        await a.onMessage({ command: 'updateInfo', from: 'system.adapter.admin.0', callback: 2, message: {} });
        assert.strictEqual(a._replies[1].latest, '0.55.0', 'cached');

        await a.onMessage({
            command: 'updateInfo',
            from: 'system.adapter.admin.0',
            callback: 3,
            message: { refresh: true },
        });
        assert.strictEqual(a._replies[2].latest, '0.57.0', 'refreshed');
        console.log('✓ sendTo updateInfo serves the cache and can be forced');
    }

    console.log('\nAll update check tests passed.');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
