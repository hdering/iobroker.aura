// Abschnittstitel: Untertitel in allen Stilen, Akzentstrich über den ganzen Textblock,
// Stil "framed" als vollwertige Widget-Karte.
//
//   npm run dev            (oder AURA_BASE setzen)
//   node tools/tests/header-subtitle.mjs
//
// Zwei Fehlerbilder, beide hier festgenagelt:
//   1. Der Akzentstrich lag im "default"-Stil INNERHALB der Titelzeile, der Untertitel
//      war deren Geschwister — der Strich endete also über dem Untertitel.
//   2. "compact" und "minimal" rendern den Untertitel gar nicht, obwohl der Editor das
//      Feld und den Schalter "Untertitel" für jeden Stil anbietet.
// Dazu der neue Stil "framed": WidgetFrame nimmt dem Abschnittstitel sonst Karte,
// Rahmen und Innenabstand weg — bei "framed" muss genau das erhalten bleiben.
//
// Gemessen statt geschätzt: Rechtecke von Strich, Titel und Untertitel, und für die
// Karte die berechneten Stile gegen ein echtes Widget statt gegen feste Pixelwerte.
import { chromium } from 'playwright';

const BASE = process.env.AURA_BASE ?? 'http://localhost:5173';
const SUBTITLE = 'Erdgeschoss';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${BASE}/?shot=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__auraShot?.ready, { timeout: 30000 });

async function show({ layout, subtitle, titleAlign = 'left', showSubtitle = true, rows = 4 }) {
    await page.evaluate(
        ([layout, subtitle, titleAlign, showSubtitle, rows]) => {
            window.__auraShot.showWidgets([
                {
                    id: 'hdr',
                    type: 'header',
                    title: 'Wohnzimmer',
                    layout,
                    gridPos: { x: 0, y: 0, w: 12, h: rows },
                    options: { titleAlign, showSubtitle, ...(subtitle ? { subtitle } : {}) },
                },
            ]);
        },
        [layout, subtitle, titleAlign, showSubtitle, rows],
    );
    await page.waitForTimeout(300);
}

const geometry = () =>
    page.evaluate(() => {
        const widget = document.querySelector('.aura-widget-type-header');
        const row = widget?.querySelector('.aura-widget-row');
        const rule = row?.querySelector('.rounded-full');
        const title = widget?.querySelector('.aura-widget-title');
        const sub = widget?.querySelector('.aura-widget-value');
        if (!widget || !row) return null;
        const r1 = (n) => Math.round(n * 10) / 10;
        const rect = (el) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { top: r1(b.top), bottom: r1(b.bottom), left: r1(b.left), right: r1(b.right) };
        };
        return {
            widget: rect(widget),
            rule: rect(rule),
            title: rect(title),
            sub: rect(sub),
            subText: sub ? (sub.textContent || '').trim() : null,
            // Der sichtbare Textblock: alles, was in der Zeile gezeichnet wird, ohne den Strich.
            titleAlignCss: sub ? getComputedStyle(sub).textAlign : null,
        };
    });

// ── 1. Der Untertitel erscheint in jedem Stil ─────────────────────────────────────────
for (const layout of ['default', 'compact', 'minimal', 'framed']) {
    await show({ layout, subtitle: SUBTITLE });
    const g = await geometry();
    check(`${layout}: Untertitel wird angezeigt`, g?.subText === SUBTITLE, `gefunden: ${JSON.stringify(g?.subText)}`);
    check(
        `${layout}: Untertitel steht unter dem Titel`,
        !!g?.sub && !!g?.title && g.sub.top >= g.title.bottom - 1,
        `Titel bis ${g?.title?.bottom}, Untertitel ab ${g?.sub?.top}`,
    );
    check(
        `${layout}: Untertitel liegt im Widget`,
        !!g?.sub && g.sub.bottom <= g.widget.bottom + 0.5 && g.sub.top >= g.widget.top - 0.5,
        `Widget ${g?.widget?.top}..${g?.widget?.bottom}, Untertitel ${g?.sub?.top}..${g?.sub?.bottom}`,
    );

    // Der Schalter muss ihn weiterhin ausblenden können.
    await show({ layout, subtitle: SUBTITLE, showSubtitle: false });
    const off = await geometry();
    check(`${layout}: "Untertitel anzeigen" aus blendet ihn aus`, off?.sub === null);

    // Und ohne Text bleibt es beim reinen Titel.
    await show({ layout, subtitle: '' });
    const empty = await geometry();
    check(`${layout}: ohne Untertiteltext bleibt es beim Titel`, empty?.sub === null);
}

// ── 2. Der Akzentstrich umfasst Titel UND Untertitel ──────────────────────────────────
for (const layout of ['default', 'compact', 'framed']) {
    await show({ layout, subtitle: SUBTITLE });
    const g = await geometry();
    check(`${layout}: Akzentstrich vorhanden`, !!g?.rule);
    check(
        `${layout}: Strich reicht bis unter den Untertitel`,
        !!g?.rule && !!g?.sub && g.rule.bottom + 0.5 >= g.sub.bottom,
        `Strich bis ${g?.rule?.bottom}, Untertitel bis ${g?.sub?.bottom}`,
    );
    check(
        `${layout}: Strich beginnt nicht unter dem Titel`,
        !!g?.rule && !!g?.title && g.rule.top <= g.title.top + 0.5,
        `Strich ab ${g?.rule?.top}, Titel ab ${g?.title?.top}`,
    );
    check(
        `${layout}: Strich steht links vom Text`,
        !!g?.rule && !!g?.title && g.rule.right <= g.title.left,
        `Strich endet bei ${g?.rule?.right}, Titel ab ${g?.title?.left}`,
    );
}

// Ohne Untertitel darf der Strich im default-Stil nicht plötzlich länger sein als der Titel.
await show({ layout: 'default', subtitle: '' });
const bare = await geometry();
check(
    'default ohne Untertitel: Strich bleibt auf Titelhöhe',
    !!bare?.rule && !!bare?.title && Math.abs(bare.rule.bottom - bare.title.bottom) <= 1,
    `Strich bis ${bare?.rule?.bottom}, Titel bis ${bare?.title?.bottom}`,
);

// ── 3. Titelausrichtung: nur der default-Stil kennt sie, dort folgt der Untertitel ─────
for (const align of ['center', 'right']) {
    await show({ layout: 'default', subtitle: SUBTITLE, titleAlign: align });
    const g = await geometry();
    check(`default/${align}: Untertitel folgt der Ausrichtung`, g?.titleAlignCss === align, `${g?.titleAlignCss}`);
    check(`default/${align}: kein Akzentstrich`, g?.rule === null);
}
// compact/minimal zeichnen den Titel immer links — ein zentrierter Untertitel darunter
// wäre nur schief, die Option greift dort nicht.
for (const layout of ['compact', 'minimal']) {
    await show({ layout, subtitle: SUBTITLE, titleAlign: 'center' });
    const g = await geometry();
    check(`${layout}: Ausrichtung wirkt nicht auf den Untertitel`, g?.titleAlignCss === 'start', `${g?.titleAlignCss}`);
}

// ── 4. Der Stil "framed" sieht aus wie ein normales Widget ────────────────────────────
// Gegen ein echtes Widget gemessen, nicht gegen feste Pixelwerte: Karte, Rahmen, Radius,
// Schatten und Innenabstand müssen identisch sein, sonst fällt der Abschnitt aus der Reihe.
const cardStyle = () =>
    page.evaluate(() => {
        const el = document.querySelector('.aura-widget');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
            background: cs.backgroundColor,
            borderWidth: cs.borderTopWidth,
            borderColor: cs.borderTopColor,
            radius: cs.borderTopLeftRadius,
            shadow: cs.boxShadow,
            padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
            padVar: cs.getPropertyValue('--aura-widget-pad').trim(),
        };
    });

const showPlainWidget = async () => {
    await page.evaluate(() => {
        window.__auraShot.mock({ 'demo.t1': 21.5 });
        window.__auraShot.mockServerState({ 'demo.t1': 21.5 });
        window.__auraShot.showWidgets([
            {
                id: 'hdr',
                type: 'value',
                title: 'Wohnzimmer',
                datapoint: 'demo.t1',
                gridPos: { x: 0, y: 0, w: 12, h: 5 },
                options: {},
            },
        ]);
    });
    await page.waitForTimeout(300);
};

for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => window.__auraShot.setTheme(t), theme);
    await showPlainWidget();
    const plain = await cardStyle();
    await show({ layout: 'framed', subtitle: SUBTITLE, rows: 5 });
    const framed = await cardStyle();
    for (const key of ['background', 'borderWidth', 'borderColor', 'radius', 'shadow', 'padding', 'padVar']) {
        check(
            `framed/${theme}: ${key} wie ein normales Widget`,
            framed?.[key] === plain?.[key],
            `${framed?.[key]} vs ${plain?.[key]}`,
        );
    }

    // Und die anderen Stile bleiben rahmenlos.
    await show({ layout: 'default', subtitle: SUBTITLE, rows: 5 });
    const bare = await cardStyle();
    check(
        `default/${theme}: weiterhin ohne Karte`,
        bare?.borderWidth === '0px' && bare?.shadow === 'none',
        `${bare?.borderWidth} / ${bare?.shadow}`,
    );
}
await page.evaluate(() => window.__auraShot.setTheme('light'));

check('keine Seitenfehler', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} ok`);
if (failed.length) {
    console.log('\nFehlgeschlagen:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    process.exit(1);
}
