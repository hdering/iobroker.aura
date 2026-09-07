// Verifies the configurable popup inner padding (issue #621) against the dev server.
//
//   npm run dev            (or set AURA_BASE)
//   node tools/tests/popup-padding.mjs
//
// Why: a popup left ~43 px unused on each side of a list row — 15 px reserved
// scrollbar lane + 12 px popup body padding + the widget card's own padding — no
// matter how wide the widget was dragged. On a phone that is a quarter of the row.
// Two things are asserted here:
//
//   1. The padding resolves through click action > popup view > global default
//      (12 px, the historical `p-3`), clamped to MAX_POPUP_PADDING.
//   2. The scrollbar lane (`scrollbar-gutter: stable both-edges`) is only reserved
//      while the body really scrolls — a popup that fits keeps those ~30 px.
//
// Popups are opened through the datapoint triggers (__auraShot.dpTriggers) exactly
// like popup-background.mjs: the trigger host carries a full click action, so every
// level can be exercised without building a dashboard around it. A false→true edge
// opens the popup, so each case re-arms the datapoint. The global level has no
// screenshot-harness setter and sits in the same `??` chain — the Admin page writes
// it through the store like every other global popup setting.
import { chromium } from 'playwright';

const BASE = process.env.AURA_BASE ?? 'http://localhost:5174';
const DP = 'demo.popupPadTrigger';
const VIEW_ID = 'pv-pad-test';
const DEFAULT_PAD = 12;
const MAX_PAD = 40;

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const eq = (name, got, want) => check(name, got === want, `gemessen ${got}, erwartet ${want}`);

/** `rows` list rows on one datapoint — enough of them and the popup has to scroll. */
function listWidget(rows) {
    return {
        id: 'pw-list',
        type: 'list',
        title: 'Liste',
        datapoint: '',
        gridPos: { x: 0, y: 0, w: 4, h: 4 },
        options: {
            entries: Array.from({ length: rows }, (_, i) => ({ id: 'demo.value', label: `Punkt ${i + 1}` })),
        },
    };
}

function trigger(options) {
    return {
        id: 'pt-pad',
        name: 'Innenabstand',
        enabled: true,
        clause: { datapoint: DP, operator: 'true', value: '' },
        host: {
            id: 'ptw-pad',
            type: 'value',
            title: 'Popup',
            datapoint: DP,
            gridPos: { x: 0, y: 0, w: 1, h: 1 },
            options,
        },
        resetDp: false,
    };
}

const view = (padding, rows = 3) => [
    { id: VIEW_ID, name: 'Padding-Test', widgets: [listWidget(rows)], ...(padding === undefined ? {} : { padding }) },
];
const viewAction = { clickAction: { kind: 'popup-view', viewId: VIEW_ID } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${BASE}/?shot=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__auraShot?.ready, { timeout: 30000 });

const settle = () => page.waitForTimeout(450);

/** Arm the trigger with `options` + `views`, drive the DP false→true, measure. */
async function open(options, views) {
    await page.keyboard.press('Escape');
    await settle();
    await page.evaluate(
        ([dp, rule, vs]) => {
            window.__auraShot.mock({ 'demo.value': { val: 21.5, unit: '°C' }, [dp]: false });
            window.__auraShot.popupViews(vs);
            window.__auraShot.dpTriggers([rule]);
        },
        [DP, trigger(options), views],
    );
    await settle();
    await page.evaluate((dp) => window.__auraShot.mock({ [dp]: true }), DP);
    await settle();
    return page.evaluate(() => {
        const backdrop = document.querySelector('[data-aura-click-popup]');
        if (!backdrop) return null;
        const scroller = backdrop.querySelector('.overflow-auto');
        const body = scroller?.firstElementChild?.firstElementChild;
        const rect = (el) => el.getBoundingClientRect();
        return {
            // Popup body padding — what the setting controls.
            pad: body ? Math.round(parseFloat(getComputedStyle(body).paddingLeft)) : -1,
            // Reserved scrollbar lane on the left edge of the scroller.
            lane: body ? Math.round(rect(body).left - rect(scroller).left) : -1,
            gutter: scroller ? getComputedStyle(scroller).scrollbarGutter : '',
            scrolls: scroller ? scroller.scrollHeight - scroller.clientHeight > 1 : false,
        };
    });
}

// ── 1. Nothing configured → the historical 12 px ──────────────────────────────
const plain = await open(viewAction, view(undefined));
check('Popup öffnet', !!plain);
eq('ohne Einstellung bleibt es bei 12 px', plain.pad, DEFAULT_PAD);

// ── 2. A view setting wins over the default ───────────────────────────────────
eq('View-Einstellung schlägt den Standard', (await open(viewAction, view(24))).pad, 24);

// ── 3. The click action wins over the view ────────────────────────────────────
eq('Klick-Aktion schlägt die View', (await open({ ...viewAction, popupPadding: 4 }, view(24))).pad, 4);

// ── 4. Zero really is zero, and over-large values are clamped ─────────────────
eq('0 px lässt die Widgets bis an den Rand', (await open({ ...viewAction, popupPadding: 0 }, view(24))).pad, 0);
eq('zu große Werte werden gekappt', (await open({ ...viewAction, popupPadding: 999 }, view(0))).pad, MAX_PAD);

// ── 5. The scrollbar lane costs nothing while the popup fits ──────────────────
const short = await open({ ...viewAction, popupPadding: 0 }, view(0, 2));
check('kurzes Popup scrollt nicht', !short.scrolls);
eq('kein reservierter Scrollbar-Streifen', short.lane, 0);
eq('kein scrollbar-gutter am kurzen Popup', short.gutter, 'auto');

// ── 6. …and comes back as soon as the body scrolls ────────────────────────────
await page.setViewportSize({ width: 1280, height: 420 });
const tall = await open({ ...viewAction, popupPadding: 0 }, view(0, 40));
check('langes Popup scrollt', tall.scrolls);
check('Scrollbar-Streifen wieder reserviert', tall.lane > 0, `${tall.lane} px`);
eq('scrollbar-gutter am langen Popup', tall.gutter, 'stable both-edges');

check('keine Seitenfehler', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Checks ok`);
process.exit(failed.length ? 1 : 0);
