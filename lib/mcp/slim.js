'use strict';

/**
 * Keeps an embedded image out of a JSON answer.
 *
 * Reported from use: `aura_tab` on a perfectly ordinary tab answered with 943 KB,
 * of which 918 KB were ONE group definition — a `data:image/png;base64,…` on a
 * group background. The twelve widgets everybody actually wanted were 16 KB. For
 * an MCP client that tab is simply not readable: the answer has to be redirected
 * into a file and filtered locally before anything can be done with it.
 *
 * Nothing about the image is useful to a model. It cannot look at it, cannot
 * change it and cannot check it — it is a blob that has to survive a round trip
 * unchanged, which is exactly what a patch tool (aura_update_widget) does without
 * ever seeing it. So the value is replaced by its head plus a marker saying how
 * big it was and how to get it whole.
 *
 * The marker is deliberately loud and machine-recognisable: writing a trimmed
 * payload back would destroy the image, so every write tool refuses a payload
 * that still carries one (`findTrimMark`).
 */

/**
 * The head kept in place, so the value is still recognisable as what it is
 * (`data:image/png;base64,…`) rather than as an empty string.
 */
const HEAD = 48;

/**
 * Above this a string is trimmed. 400 characters is longer than any id, title,
 * template or CSS value in a widget and far below any embedded file.
 */
const MAX_STRING = 400;

/** What a trimmed value carries. Never produced by the frontend. */
const TRIM_MARK = '[AURA-gekürzt';

/** Human-readable size, so the answer says what it left out. */
function sizeOf(chars) {
    return chars > 900000 ? `${(chars / 1048576).toFixed(1)} MB` : `${Math.round(chars / 1024)} KB`;
}

/**
 * Replace every over-long string, in place of nothing else.
 *
 * @param {*} value any JSON value
 * @param {{trimmed: number, chars: number, keys: Set<string>}} stats collected as it walks
 * @param {string} [key] the field the value sits in, for the report
 * @returns {*} the same shape with the long strings replaced
 */
function slimValue(value, stats, key) {
    if (typeof value === 'string') {
        if (value.length <= MAX_STRING) {
            return value;
        }
        stats.trimmed += 1;
        stats.chars += value.length;
        if (key) {
            stats.keys.add(key);
        }
        return `${value.slice(0, HEAD)}${TRIM_MARK}: ${sizeOf(value.length)}, mit images="full" abrufbar]`;
    }
    if (Array.isArray(value)) {
        return value.map((v, i) => slimValue(v, stats, key ? `${key}[${i}]` : String(i)));
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = slimValue(v, stats, k);
        }
        return out;
    }
    return value;
}

/**
 * One JSON payload, with the embedded files trimmed unless asked otherwise.
 *
 * @param {*} value the payload
 * @param {{images?: string}} [opts] images "full" hands it over untouched
 * @returns {{value: *, trimmed: number, note: string}}
 */
function slimPayload(value, opts) {
    if (opts && opts.images === 'full') {
        return { value, trimmed: 0, note: '' };
    }
    const stats = { trimmed: 0, chars: 0, keys: new Set() };
    const slim = slimValue(value, stats, '');
    if (!stats.trimmed) {
        return { value, trimmed: 0, note: '' };
    }
    return {
        value: slim,
        trimmed: stats.trimmed,
        note:
            `${stats.trimmed} eingebettete Datei(en) mit zusammen ${sizeOf(stats.chars)} sind gekürzt ` +
            `(${[...stats.keys].slice(0, 4).join(', ')}) — für ein Modell ist eine data:-URI ohnehin nicht ` +
            'lesbar. So gekürzt DARF der Payload nicht zurückgeschrieben werden (die Schreib-Werkzeuge weisen ' +
            'ihn ab): mit aura_update_widget nur die Felder patchen, die sich ändern — die Datei bleibt dann ' +
            'unangetastet. Wirklich vollständig braucht es images="full".',
    };
}

/**
 * Does this raw payload still carry a trimmed value?
 *
 * @param {string} raw the JSON as it came in
 * @returns {boolean}
 */
function findTrimMark(raw) {
    return typeof raw === 'string' && raw.includes(TRIM_MARK);
}

const TRIM_REFUSAL =
    'Der Payload enthält gekürzte Daten ' +
    `("${TRIM_MARK}…"). So geschrieben wäre die eingebettete Datei (Bild, Hintergrund) verloren. ` +
    'Entweder nur die geänderten Felder mit aura_update_widget / aura_update_widgets patchen — dann bleibt ' +
    'die Datei unberührt — oder die Vorlage mit images="full" neu lesen und unverändert übernehmen.';

module.exports = { MAX_STRING, TRIM_MARK, TRIM_REFUSAL, findTrimMark, slimPayload, slimValue };
