'use strict';

/**
 * What the MCP may see and change inside a PIN-protected section/tab.
 *
 * The adapter keeps protected content in the server-side vault and leaves an empty
 * stub in `config.dashboard` (lib/security/dashboardVault.js). This server runs
 * INSIDE the adapter, so the vault is reachable in-process — but "can open the
 * file" is not "may hand it out". Two gates, both of them here:
 *
 *   1. STRUCTURE WITHOUT CONTENT, always: a locked tab answers with id, type and
 *      gridPos per widget — enough to correct heights, tidy positions and unify
 *      layouts — and never with options, datapoints or titles. Measurements are
 *      computed from the REAL content server-side and only their numbers come out,
 *      which is why aura_measure keeps working on a locked tab.
 *   2. WRITING NEEDS A RELEASE, made in AURA itself: an admin switches „über MCP
 *      bearbeitbar“ on for that view in the editor, and it is stored in the vault
 *      next to the PIN hash. So no PIN is ever typed into a chat, and what was
 *      released stays visible in the editor and in aura_dashboard.
 *
 * aura_write_tab is refused even on a released view: it replaces the whole tab,
 * and here that would mean replacing what nobody in the conversation has seen.
 *
 * Releases live in the vault (0600, admin-only API) and NOT in the config state on
 * purpose: `config.dashboard` is writable by any connected socket client, so a
 * release stored there would be a release anybody could grant.
 */

/** Only ever the adapter's own vault — never a path from a request. */
function vaultOf(adapter) {
    return adapter && adapter.vault ? adapter.vault : null;
}

/** The vault's section map, or `{}` when there is no vault (dev, tests). */
function vaultSections(adapter) {
    const vault = vaultOf(adapter);
    if (!vault) {
        return {};
    }
    try {
        const data = vault.load();
        return (data && data.sections) || {};
    } catch {
        return {};
    }
}

/**
 * The vault key a locked tab's content sits under, plus where inside the entry.
 *
 * A section PIN subsumes the tabs inside it (splitDashboard), so a tab locked by
 * its section is addressed by the SECTION key and found by id in `content.tabs`.
 *
 * @param {object} tab an `allTabs` entry (carries pinScope + sectionId)
 */
function viewKeyOf(tab) {
    if (!tab || !tab.pinLocked) {
        return null;
    }
    return tab.pinScope === 'section'
        ? { key: `section:${tab.sectionId}`, scope: 'section', tabId: tab.id }
        : { key: `tab:${tab.sectionId}:${tab.id}`, scope: 'tab', tabId: tab.id };
}

/** True when an admin released this view for MCP editing. */
function isReleased(entry) {
    return !!(entry && entry.mcpWrite === true);
}

/**
 * Everything this server knows about one locked tab.
 *
 * `available` false means the vault has no entry for it — the view is protected and
 * nothing more can be said, which is the honest answer for a dev server without an
 * adapter or a vault that was reset.
 *
 * @returns {{available: boolean, key: string|null, scope: string|null, tabId: string|null,
 *            released: boolean, widgets: object[]}}
 */
function lockedView(adapter, tab) {
    const at = viewKeyOf(tab);
    const none = {
        available: false,
        key: at && at.key,
        scope: at && at.scope,
        tabId: at && at.tabId,
        released: false,
        widgets: [],
    };
    if (!at) {
        return none;
    }
    const entry = vaultSections(adapter)[at.key];
    if (!entry || !entry.content) {
        return none;
    }
    let widgets = null;
    if (at.scope === 'tab') {
        widgets = entry.content.widgets;
    } else {
        const inner = (entry.content.tabs || []).find((t) => t && t.id === at.tabId);
        widgets = inner && inner.widgets;
    }
    if (!Array.isArray(widgets)) {
        return none;
    }
    return { available: true, key: at.key, scope: at.scope, tabId: at.tabId, released: isReleased(entry), widgets };
}

/**
 * id, type and gridPos — nothing else, ever.
 *
 * Deliberately a whitelist: an "everything except options" filter would hand out
 * `datapoint`, `title` and whatever field a widget grows next. Positions and sizes
 * are what the geometry work needs and they say nothing about what is displayed.
 */
function skeletonOf(widgets) {
    return (Array.isArray(widgets) ? widgets : [])
        .filter((w) => w && typeof w === 'object')
        .map((w) => {
            const out = { id: w.id, type: w.type };
            if (w.gridPos && typeof w.gridPos === 'object') {
                const gp = w.gridPos;
                out.gridPos = { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
            }
            // A group's children live in a separate definition, so the group widget
            // is the only place where the skeleton would otherwise lose the fact
            // that there IS something nested here.
            if (w.options && typeof w.options.defId === 'string') {
                out.groupChildren = true;
            }
            return out;
        });
}

/**
 * Write widgets back into a locked view's vault entry.
 *
 * Keeps ONE undo copy in the vault itself (`contentPrev`): the normal backup path
 * writes into the adapter's files namespace, which every socket client can read, so
 * protected content must not go there — and without any undo a bad write into a
 * view nobody can see would be unrecoverable.
 *
 * The running frontend keeps the copy it got at unlock time, so a change shows up
 * there after the next unlock (or a reload) — the callers say so.
 *
 * @param {object} adapter
 * @param {{key: string, scope: string, tabId: string}} at from lockedView
 * @param {object[]} widgets
 */
function writeLockedWidgets(adapter, at, widgets) {
    const vault = vaultOf(adapter);
    if (!vault) {
        throw new Error('Kein PIN-Tresor vorhanden — geschützte Inhalte lassen sich hier nicht schreiben.');
    }
    const data = vault.load();
    const entry = data.sections && data.sections[at.key];
    if (!entry || !entry.content) {
        throw new Error(`Der PIN-Tresor kennt „${at.key}“ nicht (mehr).`);
    }
    entry.contentPrev = JSON.parse(JSON.stringify(entry.content));
    if (at.scope === 'tab') {
        entry.content.widgets = widgets;
    } else {
        entry.content.tabs = (entry.content.tabs || []).map((t) =>
            t && t.id === at.tabId ? Object.assign({}, t, { widgets }) : t,
        );
    }
    vault.save(data);
}

/**
 * Put the real widgets of every RELEASED protected view into `layouts`, in place.
 *
 * This is the only door: a tool that works on the model (locateWidget and the
 * widget tools behind it) sees a released view like any other tab and nothing at
 * all of one that was not released — the fail-closed default is "the stub stays
 * empty", so a tool that never heard of PINs cannot change protected content.
 *
 * @returns {{key: string, scope: string, tabId: string, label: string}[]} what was filled in
 */
function hydrateReleased(adapter, layouts) {
    const sections = vaultSections(adapter);
    if (!Object.keys(sections).length) {
        return [];
    }
    const filled = [];
    for (const layout of layouts || []) {
        for (const section of layout.sections || []) {
            const secEntry = section.pinProtected ? sections[`section:${section.id}`] : null;
            for (const tab of section.tabs || []) {
                const entry = secEntry || (tab.pinProtected ? sections[`tab:${section.id}:${tab.id}`] : null);
                if (!entry || !isReleased(entry) || !entry.content) {
                    continue;
                }
                const widgets = secEntry
                    ? ((entry.content.tabs || []).find((t) => t && t.id === tab.id) || {}).widgets
                    : entry.content.widgets;
                if (!Array.isArray(widgets)) {
                    continue;
                }
                tab.widgets = JSON.parse(JSON.stringify(widgets));
                filled.push({
                    key: secEntry ? `section:${section.id}` : `tab:${section.id}:${tab.id}`,
                    scope: secEntry ? 'section' : 'tab',
                    tabId: tab.id,
                    label: `${layout.name} / ${section.name} / ${tab.name}`,
                });
            }
        }
    }
    return filled;
}

/**
 * The counterpart, called by writeDashboard for EVERY write: a protected stub goes
 * into the socket-readable state empty, and the widgets it picked up on the way
 * (a released view someone edited) go into the vault instead.
 *
 * Being in the one write path rather than in each tool is the point — a write path
 * that forgets this would either leak protected widgets into the state or drop the
 * change on the floor. Widgets on a stub that is NOT released are dropped without
 * a vault write: nothing legitimate puts them there.
 *
 * @returns {{layouts: object[], flushed: string[], refused: string[]}}
 */
function flushHydrated(adapter, layouts) {
    const sections = vaultSections(adapter);
    const flushed = [];
    const refused = [];
    let touched = false;
    const out = (layouts || []).map((layout) => ({
        ...layout,
        sections: (layout.sections || []).map((section) => {
            const secKey = section.pinProtected ? `section:${section.id}` : null;
            return {
                ...section,
                tabs: (section.tabs || []).map((tab) => {
                    const key = secKey || (tab.pinProtected ? `tab:${section.id}:${tab.id}` : null);
                    if (!key || !(tab.widgets || []).length) {
                        return tab;
                    }
                    touched = true;
                    const entry = sections[key];
                    if (!entry || !isReleased(entry)) {
                        refused.push(key);
                        return { ...tab, widgets: [] };
                    }
                    const at = { key, scope: secKey ? 'section' : 'tab', tabId: tab.id };
                    const before =
                        at.scope === 'tab'
                            ? entry.content.widgets
                            : ((entry.content.tabs || []).find((t) => t && t.id === tab.id) || {}).widgets;
                    if (JSON.stringify(before) !== JSON.stringify(tab.widgets)) {
                        writeLockedWidgets(adapter, at, tab.widgets);
                        flushed.push(key);
                    }
                    return { ...tab, widgets: [] };
                }),
            };
        }),
    }));
    return { layouts: touched ? out : layouts, flushed, refused };
}

/** Turn the release for one view on or off. Used by the admin API, not by a tool. */
function setRelease(vault, key, enabled) {
    const data = vault.load();
    const entry = data.sections && data.sections[key];
    if (!entry) {
        return { error: `Der PIN-Tresor kennt „${key}“ nicht.` };
    }
    if (enabled) {
        entry.mcpWrite = true;
    } else {
        delete entry.mcpWrite;
    }
    vault.save(data);
    return { key, mcpWrite: isReleased(entry) };
}

/** Said once per answer that shows a skeleton, so the gap is never a guess. */
const STRUCTURE_NOTE =
    'Nur die Struktur: Id, Typ und gridPos. Optionen, Titel und Datenpunkte bleiben im PIN-Tresor — dieser ' +
    'Payload ist deshalb NICHT als Eingabe für aura_write_tab geeignet. Damit gehen Höhen, Positionen und ' +
    'Raster-Aufräumarbeiten (aura_measure, aura_rendered, aura_compact); alles Inhaltliche nicht.';

/** The refusal a write gets while the view is not released. */
function releaseHint(label) {
    return (
        `${label} ist PIN-geschützt und nicht für den MCP freigegeben. Schreiben ist hier absichtlich ` +
        'gesperrt: der Inhalt liegt im Tresor, und ein Schreibzugriff würde etwas ersetzen, das in diesem ' +
        'Gespräch niemand gesehen hat.\n' +
        'Freigeben in AURA selbst — im Admin-Editor beim Bereich/Tab den Schalter „Über MCP bearbeitbar“ ' +
        'einschalten (nur mit Admin-Anmeldung, gilt bis er wieder aus ist). Die PIN wird dafür nicht ' +
        'gebraucht und gehört nicht in den Chat.\n' +
        'Ohne Freigabe geht die Struktur: aura_tab zeigt Id, Typ und gridPos, aura_measure und aura_rendered ' +
        'rechnen damit.'
    );
}

/** aura_write_tab, on a locked view, is refused even after a release. */
function writeTabRefusal(label) {
    return (
        `${label} ist PIN-geschützt — aura_write_tab bleibt hier gesperrt, auch mit Freigabe: es ersetzt den ` +
        'ganzen Tab auf einmal, und was dabei wegfällt, ist genau der Inhalt, der hier nicht zu sehen ist. ' +
        'Einzelne Widgets ändern (aura_update_widget / aura_update_widgets), Positionen mit aura_compact — ' +
        'das trifft nur, was benannt wurde.'
    );
}

module.exports = {
    STRUCTURE_NOTE,
    flushHydrated,
    hydrateReleased,
    isReleased,
    lockedView,
    releaseHint,
    setRelease,
    skeletonOf,
    vaultSections,
    viewKeyOf,
    writeLockedWidgets,
    writeTabRefusal,
};
