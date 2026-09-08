#!/usr/bin/env node
// ── PIN panel of the admin editor ────────────────────────────────────────────
// The two things the panel got wrong: „Über MCP bearbeitbar“ only appeared for a
// view the vault already knew (so after typing a PIN it stayed hidden until the
// next save + reload), and a PIN that WAS set could not be taken back — the input
// shows empty for a server-side PIN, so the old hint „Feld leeren entfernt den
// Schutz“ described a gesture that does not exist.
//
//   npm run dev            (or set AURA_BASE)
//   node tools/tests/pin-editor-ui.mjs
//
// Runs against the dev server with `?shot=1`: the layout is seeded through the
// screenshot harness (screenshotMode → nothing is persisted to the instance) and
// the admin session is faked in localStorage, which is what the dev server does
// anyway when no adapter answers /api/aura.
import { chromium } from 'playwright';

const BASE = process.env.AURA_BASE ?? 'http://localhost:5173';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
};
const eq = (name, got, want) =>
    check(
        name,
        JSON.stringify(got) === JSON.stringify(want),
        `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`,
    );

const widget = (id) => ({
    id,
    type: 'info',
    title: id,
    datapoint: '',
    layout: 'default',
    gridPos: { x: 0, y: 0, w: 10, h: 6 },
    options: { showTitle: true },
});

// tFree → no PIN · tKeep → the KEEP sentinel the editor holds for a PIN that
// lives in the server vault (what mergeProtectedContent leaves behind).
const LAYOUT = {
    id: 'l-pinedit',
    name: 'PinEdit',
    slug: 'pinedit',
    activeSectionId: 'sec1',
    sections: [
        {
            id: 'sec1',
            name: 'Bereich',
            slug: 'bereich',
            activeTabId: 'tFree',
            tabs: [
                { id: 'tFree', name: 'Frei', slug: 'frei', widgets: [widget('wFree')] },
                { id: 'tKeep', name: 'Gesperrt', slug: 'gesperrt', pin: '__aura_keep__', widgets: [widget('wKeep')] },
            ],
        },
    ],
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, ignoreHTTPSErrors: true });
await ctx.addInitScript(() => {
    localStorage.setItem(
        'aura-auth',
        JSON.stringify({ state: { token: 'dev-local', sessionActive: true }, version: 0 }),
    );
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${BASE}/?shot=1#/admin/editor`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__auraShot?.ready, { timeout: 40000 });
await page.evaluate((l) => window.__auraShot.seed({ layouts: [l] }), LAYOUT);
await page.waitForTimeout(600);

const input = page.locator('.aura-pin-input');
const mcp = page.locator('.aura-pin-mcp');
const remove = page.locator('.aura-pin-remove');
const visible = async (loc) =>
    loc
        .first()
        .isVisible()
        .catch(() => false);

/** Open the settings panel of one tab (the gear next to its name in the tab list). */
const openTabPanel = async (name) => {
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('body').click({ position: { x: 3, y: 3 } });
    await page.waitForTimeout(150);
    const row = page.locator('.aura-tab-manage-row', { hasText: name }).first();
    await row.locator('button:has(svg.lucide-settings)').first().click();
    await page.waitForTimeout(250);
};

try {
    // ── a tab without a PIN ──────────────────────────────────────────────────
    await openTabPanel('Frei');
    eq('panel of an unprotected tab shows the PIN field', await visible(input), true);
    eq('… and no MCP release switch', await visible(mcp), false);
    eq('… and nothing to remove', await visible(remove), false);

    // ── typing a PIN, nothing saved yet ──────────────────────────────────────
    await input.first().fill('4321');
    await page.waitForTimeout(200);
    eq('typing a PIN shows the MCP release right away', await visible(mcp), true);
    eq('… and the remove button', await visible(remove), true);
    check(
        'the MCP hint text is the one the panel promises',
        (await mcp.first().innerText()).includes('Über MCP bearbeitbar'),
        await mcp.first().innerText(),
    );

    // ── the switch may be flipped before the vault knows the view ────────────
    await mcp.locator('button').first().click();
    await page.waitForTimeout(300);
    check(
        'a release flipped before the first save is parked, not refused',
        (await mcp.first().innerText()).includes('Speichern'),
        await mcp.first().innerText(),
    );
    eq(
        'the parked release is remembered for the view',
        await page.evaluate(() => Object.keys(window.__auraShot.mcpPending?.() ?? {})),
        ['tab:sec1:tFree'],
    );

    // ── removing the PIN again ───────────────────────────────────────────────
    await remove.first().click();
    await page.waitForTimeout(250);
    eq('remove clears the PIN', await input.first().inputValue(), '');
    eq('… hides the MCP release', await visible(mcp), false);
    eq('… and its own button', await visible(remove), false);
    eq(
        '… and drops the parked release with it',
        await page.evaluate(() => Object.keys(window.__auraShot.mcpPending?.() ?? {})),
        [],
    );
    eq('… while the tab keeps its widgets', await page.evaluate(() => window.__auraShot.tabPin('sec1', 'tFree')), {
        widgets: 1,
    });

    // ── a tab whose PIN lives in the server vault ────────────────────────────
    await openTabPanel('Gesperrt');
    eq('a server-side PIN shows an empty field (the code never comes back)', await input.first().inputValue(), '');
    eq('… but the MCP release is there', await visible(mcp), true);
    eq('… and so is the remove button', await visible(remove), true);
    await remove.first().click();
    await page.waitForTimeout(250);
    eq(
        'removing it clears pin AND the stub marker, widgets untouched',
        await page.evaluate(() => window.__auraShot.tabPin('sec1', 'tKeep')),
        { widgets: 1 },
    );
    eq(
        'the vault entry is queued for the next save, not dropped now',
        await page.evaluate(() => window.__auraShot.queuedVaultRemovals()),
        ['tab:sec1:tKeep'],
    );
} finally {
    check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
    await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
