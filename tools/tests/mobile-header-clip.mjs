// Der Abschnittstitel darf in der Mobile-Ansicht nicht oben abgeschnitten werden.
//
//   npm run dev            (oder AURA_BASE setzen)
//   node tools/tests/mobile-header-clip.mjs
//
// Der Abschnittstitel zeichnet keine Karte und schneidet nichts ab: bei wenigen
// Rasterzeilen ragt sein zentrierter Text oben und unten aus der Box. Im Desktop-Raster
// ist dieser Überstand einfach sichtbar, die Mobile-Spalte liegt aber in einem Scroller —
// beim obersten Widget verschwand alles über der Scrollbox, der Titel sah aus, als
// schneide ihn die Tab-Leiste ab.
//
// Gemessen statt geschätzt: für jeden Vorfahren mit overflow != visible wird geprüft, ob
// die Titelzeile über dessen Oberkante hinausragt. Dazu die Gegenprobe, dass eine bewusst
// hohe Kopfzeile ihre Höhe behält und der Inhalt darin zentriert bleibt.
import { chromium } from 'playwright';

const BASE = process.env.AURA_BASE ?? 'http://localhost:5173';
// Unter dem Default-Breakpoint (600), damit der Dashboard-Mobile-Zweig greift.
const VIEWPORT = { width: 420, height: 800 };

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${BASE}/?shot=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__auraShot?.ready, { timeout: 30000 });

/** Kopfzeile ganz oben, darunter ein normales Widget (wie in einer echten Ansicht). */
async function show({ rows, layout, subtitle, scale = 1 }) {
    await page.evaluate(
        ([rows, layout, subtitle, scale]) => {
            document.documentElement.style.setProperty('--font-scale', String(scale));
            window.__auraShot.mock({ 'demo.t1': 21.5 });
            window.__auraShot.mockServerState({ 'demo.t1': 21.5 });
            window.__auraShot.showWidgets([
                {
                    id: 'hdr',
                    type: 'header',
                    title: 'Wohnzimmer',
                    layout,
                    gridPos: { x: 0, y: 0, w: 12, h: rows },
                    options: subtitle ? { subtitle } : {},
                },
                {
                    id: 'below',
                    type: 'value',
                    title: 'Temperatur',
                    datapoint: 'demo.t1',
                    gridPos: { x: 0, y: rows, w: 12, h: 4 },
                    options: {},
                },
            ]);
        },
        [rows, layout, subtitle, scale],
    );
    await page.waitForTimeout(350);
}

/**
 * Geometrie der Kopfzeile:
 *   clipTop  - wie weit die Titelzeile über die Oberkante des nächsten clippenden
 *              Vorfahren hinausragt (null = nichts abgeschnitten)
 *   boxH     - Höhe der Widget-Box im Stapel
 *   padTop   - Abstand Boxoberkante -> Inhaltsoberkante (Zentrierung)
 *   padBot   - Abstand Inhaltsunterkante -> Boxunterkante
 *   overlaps - ragt der Inhalt in das Widget darunter?
 */
const headerGeometry = () =>
    page.evaluate(() => {
        const box = document.querySelector('[data-aura-widget="hdr"]');
        const row = box?.querySelector('.aura-widget-row');
        const title = box?.querySelector('.aura-widget-title');
        const below = document.querySelector('[data-aura-widget="below"]');
        if (!box || !row || !title) return null;
        const bb = box.getBoundingClientRect();
        const rb = row.getBoundingClientRect();
        const tb = title.getBoundingClientRect();
        // Der Zeilencontainer ist h-full und deckt die Box ab; für die Zentrierung zählt
        // der tatsächlich gezeichnete Inhalt (Titelblock + Untertitel).
        const kids = [...row.children].map((el) => el.getBoundingClientRect());
        const inkTop = Math.min(...kids.map((k) => k.top));
        const inkBot = Math.max(...kids.map((k) => k.bottom));
        const r1 = (n) => Math.round(n * 10) / 10;

        let clipTop = null;
        for (let p = title.parentElement; p; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
            const over = p.getBoundingClientRect().top - tb.top;
            if (over > 0 && (clipTop === null || over > clipTop)) clipTop = r1(over);
        }
        return {
            clipTop,
            boxH: r1(bb.height),
            padTop: r1(inkTop - bb.top),
            padBot: r1(bb.bottom - inkBot),
            overlaps: below ? rb.bottom > below.getBoundingClientRect().top + 0.5 : false,
        };
    });

// ── Kein Abschnitt: der Titel darf in keiner Konstellation abgeschnitten werden ────────
const CASES = [
    // [Name, Zeilen, Variante, Untertitel, Schriftskalierung]
    ['1 Zeile + Untertitel', 1, 'default', 'Erdgeschoss', 1],
    ['1 Zeile ohne Untertitel', 1, 'default', '', 1],
    ['1 Zeile kompakt', 1, 'compact', '', 1],
    ['1 Zeile minimal', 1, 'minimal', '', 1],
    ['2 Zeilen + Untertitel', 2, 'default', 'Erdgeschoss', 1],
    ['1 Zeile + Untertitel @1.3', 1, 'default', 'Erdgeschoss', 1.3],
    ['1 Zeile + Untertitel @1.6', 1, 'default', 'Erdgeschoss', 1.6],
    ['2 Zeilen + Untertitel @1.6', 2, 'default', 'Erdgeschoss', 1.6],
];

for (const [name, rows, layout, subtitle, scale] of CASES) {
    await show({ rows, layout, subtitle, scale });
    const g = await headerGeometry();
    if (!g) {
        check(`${name}: Kopfzeile gerendert`, false, 'keine .aura-widget-row');
        continue;
    }
    check(`${name}: nicht oben abgeschnitten`, g.clipTop === null, `${g.clipTop}px über der Scrollbox`);
    check(`${name}: kein Überstand in das Widget darunter`, !g.overlaps);
}

// ── Gegenprobe: eine bewusst hohe Kopfzeile behält ihre Höhe und bleibt zentriert ──────
await show({ rows: 6, layout: 'default', subtitle: 'Erdgeschoss', scale: 1 });
const tall = await headerGeometry();
// 6 Zeilen à gridRowHeight 20 + 5 Abstände à 10
check('hohe Kopfzeile behält ihre Rasterhöhe', tall?.boxH === 170, `${tall?.boxH}px statt 170px`);
check(
    'hohe Kopfzeile bleibt vertikal zentriert',
    !!tall && Math.abs(tall.padTop - tall.padBot) <= 1,
    `oben ${tall?.padTop}px, unten ${tall?.padBot}px`,
);
check('hohe Kopfzeile nicht abgeschnitten', tall?.clipTop === null, `${tall?.clipTop}px über der Scrollbox`);

// ── Und im Desktop-Raster bleibt alles wie gehabt ──────────────────────────────────────
await page.setViewportSize({ width: 1280, height: 900 });
await show({ rows: 1, layout: 'default', subtitle: 'Erdgeschoss', scale: 1 });
const desktop = await headerGeometry();
check('Desktop: Kopfzeile behält ihre Rasterhöhe', desktop?.boxH === 20, `${desktop?.boxH}px statt 20px`);
check('Desktop: nicht abgeschnitten', desktop?.clipTop === null, `${desktop?.clipTop}px über der Scrollbox`);

check('keine Seitenfehler', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
if (failed.length) {
    console.log('\nFehlgeschlagen:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    process.exit(1);
}
