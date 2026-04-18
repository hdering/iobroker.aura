import type { DatapointEntry } from '../hooks/useDatapointList';
import type { WidgetType } from '../types';

export interface DetectedWidget {
  datapoint: DatapointEntry;
  type: WidgetType;
  title: string;
  unit?: string;
  score: number;
}

// ── widget type detection ──────────────────────────────────────────────────

export function detectType(dp: DatapointEntry): { type: WidgetType; unit?: string } {
  const role = (dp.role ?? '').toLowerCase();
  const name = dp.name.toLowerCase();
  const unit = dp.unit ?? '';

  if (role.includes('thermostat') || role.includes('temp.set') || name.includes('solltemp') || name.includes('setpoint'))
    return { type: 'thermostat' };
  if (role.includes('temperature') || name.includes('temperatur') || unit === '°C')
    return { type: 'value', unit: unit || '°C' };
  // Shutters / blinds before generic level check
  if (role.includes('level.blind') || role.includes('level.roller') || role === 'blind' || role === 'roller')
    return { type: 'dimmer', unit: '%' };
  if (role.includes('level.dimmer') || role.includes('level.brightness') || name.includes('dimmer') || name.includes('helligkeit'))
    return { type: 'dimmer' };
  if (unit === 'W' || unit === 'VA' || role.includes('value.power'))
    return { type: 'value', unit };
  if (unit === 'kWh' || role.includes('value.energy'))
    return { type: 'value', unit };
  if (unit === '%' && (role.includes('level') || name.includes('rollade') || name.includes('rollo') || name.includes('jalousie') || name.includes('shutter') || name.includes('blind')))
    return { type: 'dimmer', unit: '%' };
  if (unit === '%' && (role.includes('humid') || name.includes('feuchte')))
    return { type: 'value', unit: '%' };
  if (dp.type === 'boolean' || role.includes('switch') || role.includes('button'))
    return { type: 'switch' };
  if (dp.type === 'number')
    return { type: 'value', unit: unit || undefined };

  return { type: 'value' };
}

// ── scoring ────────────────────────────────────────────────────────────────

/**
 * Normalise for matching:
 * – lowercase + trim
 * – German umlauts → ascii digraphs (ä→ae, ö→oe, ü→ue, ß→ss)
 *   so "Rolläden" and "rollaeden" both become "rollaeden".
 */
function norm(s: string): string {
  return s.toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/**
 * Maps ioBroker roles (normalised) → list of normalised topic tokens that
 * represent this role. Used when no enum is assigned to a DP.
 */
const ROLE_TOPIC_MAP: Array<[string, string[]]> = [
  ['level.blind',       ['rollaeden', 'shutter', 'blind', 'jalousie', 'rollo', 'beschattung', 'markise']],
  ['level.roller',      ['rollaeden', 'shutter', 'blind', 'rollo']],
  ['blind',             ['rollaeden', 'shutter', 'blind']],
  ['level.dimmer',      ['licht', 'dimmer', 'helligkeit', 'hell', 'bright']],
  ['level.brightness',  ['licht', 'dimmer', 'hell', 'bright']],
  ['switch',            ['licht', 'steckdose', 'steckdosen', 'schalter']],
  ['sensor.window',     ['sicherheit', 'fenster', 'window']],
  ['sensor.door',       ['sicherheit', 'tuer', 'door']],
  ['motion',            ['sicherheit', 'bewegung', 'motion']],
  ['sensor.motion',     ['sicherheit', 'bewegung', 'motion']],
  ['sensor.alarm',      ['sicherheit', 'alarm']],
  ['value.temperature', ['temperatur', 'heizung', 'klima', 'temp']],
  ['temperature',       ['temperatur', 'heizung', 'klima']],
  ['thermostat',        ['heizung', 'temperatur', 'klima']],
  ['value.power',       ['energie', 'verbrauch', 'strom', 'power']],
  ['value.energy',      ['energie', 'verbrauch', 'strom']],
  ['value.humidity',    ['klima', 'feuchte', 'humidity', 'luftfeuchtigkeit']],
];

/**
 * Normalised topic key → synonyms to search in DP name / role / id.
 * Keys are already normalised (no umlauts).
 * Prefix matching is used, so "steckdosen" will hit key "steckdose".
 */
const ROLE_KEYWORDS: Record<string, string[]> = {
  licht:        ['light', 'lamp', 'lampe', 'led', 'leuchte', 'beleuchtung', 'dimmer', 'bulb', 'switch', 'hell', 'bright'],
  heizung:      ['heiz', 'heat', 'thermostat', 'radiator', 'boiler', 'solltemp', 'setpoint', 'warmwasser'],
  temperatur:   ['temp', 'temperature', 'celsius', 'grad', 'klima'],
  steckdose:    ['socket', 'outlet', 'plug', 'stecker', 'dose', 'schuko'],
  rollaeden:    ['shutter', 'blind', 'rolladen', 'rollaeden', 'rollo', 'jalousie', 'vorhang', 'curtain', 'markise', 'beschattung'],
  energie:      ['energy', 'power', 'strom', 'verbrauch', 'watt', 'kwh', 'leistung', 'zaehler', 'meter'],
  sicherheit:   ['security', 'alarm', 'door', 'window', 'motion', 'contact', 'tuer', 'fenster', 'bewegung', 'rauch', 'smoke', 'einbruch'],
  klima:        ['climate', 'ac', 'klima', 'luft', 'humidity', 'feuchte', 'lueftung', 'ventil', 'luftfeuchtigkeit'],
};

/** Enum-label match (highest confidence – user explicitly tagged the DP). */
function enumScore(labels: string[], topic: string): number {
  const t = norm(topic);
  for (const label of labels) {
    const l = norm(label);
    if (l === t) return 1.0;
    if (l.includes(t) || t.includes(l)) return 0.85;
  }
  return 0;
}

function keywordScore(dp: DatapointEntry, topic: string): number {
  const t    = norm(topic);
  const name = norm(dp.name);
  const id   = norm(dp.id);
  const role = norm(dp.role ?? '');

  // 1 – direct match in name or role
  if (name.includes(t) || role.includes(t)) return 0.75;

  // 2 – match in id segment or full id
  if (id.split('.').some((seg) => seg === t)) return 0.7;
  if (id.includes(t)) return 0.6;

  // 3 – role-based topic matching
  //     e.g. role "level.blind" → topic "rollaeden" scores 0.7
  for (const [rolePattern, topics] of ROLE_TOPIC_MAP) {
    if (role.includes(norm(rolePattern))) {
      if (topics.some((tp) => t === tp || t.startsWith(tp) || tp.startsWith(t))) {
        return 0.7;
      }
    }
  }

  // 4 – synonym lookup (with prefix matching so "steckdosen" → "steckdose")
  const synonymKey = Object.keys(ROLE_KEYWORDS).find((k) => {
    const nk = norm(k);
    return nk === t || t.startsWith(nk) || nk.startsWith(t);
  });
  const synonyms = synonymKey ? ROLE_KEYWORDS[synonymKey] : [];
  for (const s of synonyms) {
    const sn = norm(s);
    if (name.includes(sn) || role.includes(sn) || id.includes(sn)) return 0.65;
  }

  // 5 – reverse synonym lookup (topic is itself a synonym of another entry)
  for (const [, syns] of Object.entries(ROLE_KEYWORDS)) {
    const normSyns = syns.map(norm);
    if (normSyns.some((s) => t === s || t.startsWith(s) || s.startsWith(t))) {
      if (normSyns.some((s) => name.includes(s) || role.includes(s) || id.includes(s))) {
        return 0.5;
      }
    }
  }

  return 0;
}

export function scoreDatapoint(dp: DatapointEntry, topic: string): number {
  // 1. Function enum (highest confidence – user explicitly tagged it)
  const funcScore = enumScore(dp.funcs, topic);
  if (funcScore > 0) return funcScore;

  // 2. Room enum
  const roomScore = enumScore(dp.rooms, topic);
  if (roomScore > 0) return roomScore;

  // 3. Role / name / id keyword fallback
  return keywordScore(dp, topic);
}

// ── title helper ───────────────────────────────────────────────────────────

function cleanTitle(dp: DatapointEntry): string {
  if (dp.name && dp.name !== dp.id.split('.').pop()) return dp.name;
  const segs = dp.id.split('.');
  return segs.slice(-2).join(' › ');
}

// ── topic search ───────────────────────────────────────────────────────────

export function detectWidgets(
  datapoints: DatapointEntry[],
  topic: string,
  maxItems = 500,
): DetectedWidget[] {
  const results: DetectedWidget[] = [];
  for (const dp of datapoints) {
    const score = scoreDatapoint(dp, topic);
    if (score === 0) continue;
    const { type, unit } = detectType(dp);
    results.push({ datapoint: dp, type, title: cleanTitle(dp), unit, score });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, maxItems);
}

// ── homepage auto-detection ────────────────────────────────────────────────

const HOMEPAGE_CATEGORIES = [
  { topic: 'temperatur', max: 4, label: 'Temperatur' },
  { topic: 'licht',      max: 5, label: 'Licht' },
  { topic: 'energie',    max: 3, label: 'Energie' },
  { topic: 'heizung',    max: 3, label: 'Heizung' },
  { topic: 'klima',      max: 2, label: 'Klima' },
  { topic: 'rollaeden',  max: 3, label: 'Rolläden' },
  { topic: 'sicherheit', max: 3, label: 'Sicherheit' },
];

export interface HomepageCategory {
  label: string;
  widgets: DetectedWidget[];
}

export function detectHomepage(datapoints: DatapointEntry[]): {
  sections: HomepageCategory[];
  allWidgets: DetectedWidget[];
} {
  const seen = new Set<string>();
  const sections: HomepageCategory[] = [];

  const clockWidget: DetectedWidget = {
    datapoint: { id: '__clock__', name: 'Uhrzeit', rooms: [], funcs: [] },
    type: 'clock',
    title: 'Uhrzeit',
    score: 1,
  };
  sections.push({ label: 'Uhrzeit', widgets: [clockWidget] });
  seen.add('__clock__');

  for (const { topic, max, label } of HOMEPAGE_CATEGORIES) {
    const found = detectWidgets(datapoints, topic, max * 10)
      .filter((w) => !seen.has(w.datapoint.id))
      .slice(0, max);
    if (found.length === 0) continue;
    found.forEach((w) => seen.add(w.datapoint.id));
    sections.push({ label, widgets: found });
  }

  return { sections, allWidgets: sections.flatMap((s) => s.widgets) };
}
