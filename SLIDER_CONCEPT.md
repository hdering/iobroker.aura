# Slider-Widget („Schieberegler") — Umsetzungskonzept

Neues Widget `slider` für das ioBroker-`vis`-Adapter-Frontend. Generischer
numerischer Schieberegler: schreibt einen skalaren Wert auf einen
Datenpunkt — mit konfigurierbarem Min/Max, Step, Orientierung, Farbe und
optionalem „Commit-on-Release". Im `custom`-Layout lassen sich neben dem
Slider frei platzierbare Aktions-Buttons (Start/Stop/Weiter/…) einbauen.

Konventionen orientieren sich 1:1 am bestehenden `DimmerWidget` (Slider-
Mechanik, `nodrag`, displayLevel-Pattern) und am `MediaplayerWidget`
(Custom-Grid-Slots, Action-Editor).

**Deutscher Name:** „Schieberegler" (label), `Regler` (shortLabel).
Type-Literal bleibt englisch: `'slider'`.

---

## 1. Typen & Registry

### 1.1 `src-vis/types/index.ts`

```ts
export type WidgetType =
  | …
  | 'slider';
```

`WidgetLayout` muss nicht erweitert werden (`'default' | 'custom'`
reichen).

### 1.2 `src-vis/widgetRegistry.tsx`

Neuer Eintrag — Position **direkt nach `dimmer`** (gleiche `widgetGroup:
'control'`, ähnliches Konzept):

```ts
{
  type: 'slider',
  label: 'Schieberegler',  shortLabel: 'Regler',
  Icon: SlidersHorizontal, iconName: 'SlidersHorizontal', color: '#0ea5e9',
  defaultW: 8,             defaultH: 4,
  addMode: 'datapoint',    widgetGroup: 'control',
  mock: { t: 'Lautstärke', v: '50', u: '%' },
}
```

`SlidersHorizontal` ist bereits in der Lucide-Import-Zeile vorhanden
(wird auch von `dimmer` verwendet).

---

## 2. Datenmodell — `WidgetConfig.options`

`config.datapoint` ist der primäre Wert-DP (read+write, numerisch).

```ts
options: {
  // ── Slider-Verhalten ─────────────────────────────────────────────────
  orientation?:    'horizontal' | 'vertical';   // Default: 'horizontal'
  sliderThickness?: number;   // px – Track-Breite; Default: 6
  sliderLength?:    number;   // px – feste Länge (vertikal: Höhe);
                              //      undefined = 100 % vom Container
  min?:             number;   // Default: 0
  max?:             number;   // Default: 100
  step?:            number;   // Default: 1
  color?:           string;   // CSS-Farbe für Track-Fill; Default: var(--accent)
  commitOnRelease?: boolean;  // Default: false (live schreiben)

  // ── Anzeige ──────────────────────────────────────────────────────────
  unit?:           string;    // optional, z. B. '%', '°C'
  showValue?:      boolean;   // Default: true
  showUnit?:       boolean;   // Default: true
  showMinMax?:     boolean;   // Default: false (Skala-Labels an Slider-Enden)
  iconSize?:       number;    // Default: 24

  // ── Aktions-Buttons (variable Liste) ─────────────────────────────────
  actions?: Array<{
    id:    string;            // intern (Date.now())
    icon:  string;            // Lucide-Icon-Name (Play, Pause, Square,
                              //   SkipForward, RotateCcw, Plus, Minus, …)
    label?: string;           // optional (Tooltip)
    dp:    string;            // Ziel-DP
    value?: string | number | boolean;  // zu schreibender Wert (default: true)
  }>;

  // ── Sonstiges ────────────────────────────────────────────────────────
  customGrid?: CustomGrid;    // 9-Zellen-Grid für layout='custom' (siehe §4.2)
}
```

**Step-Handling:** `Math.round(raw / step) * step` beim Schreiben (analog
Mediaplayer-Volume).

**Commit-on-Release:** Bei `commitOnRelease=true` wird im
`onChange`-Handler nur ein lokaler `pendingValue` gesetzt; geschrieben
wird in `onPointerUp` / `onMouseUp` / `onTouchEnd` / `onKeyUp`. Bei
`false` wird in `onChange` direkt `setState` aufgerufen.

---

## 3. Komponente — `src-vis/components/widgets/SliderWidget.tsx`

### 3.1 Skelett

```tsx
import { useMemo, useState, useRef, useEffect } from 'react';
import { useDatapoint } from '../../hooks/useDatapoint';
import { useIoBroker } from '../../hooks/useIoBroker';
import type { WidgetProps } from '../../types';
import { getWidgetIcon } from '../../utils/widgetIconMap';
import { CustomGridView } from './CustomGridView';
import { StatusBadges } from './StatusBadges';
import { useStatusFields } from '../../hooks/useStatusFields';

export function SliderWidget({ config }: WidgetProps) {
  const o      = config.options ?? {};
  const layout = config.layout ?? 'default';
  const { setState } = useIoBroker();

  const min  = (o.min  as number) ?? 0;
  const max  = (o.max  as number) ?? 100;
  const step = (o.step as number) ?? 1;
  const orientation = (o.orientation as 'horizontal' | 'vertical') ?? 'horizontal';
  const thickness   = (o.sliderThickness as number) ?? 6;
  const color       = (o.color as string) ?? 'var(--accent)';
  const commitOnRelease = !!o.commitOnRelease;
  const unit        = (o.unit as string) ?? '';

  const showValue  = o.showValue  !== false;
  const showUnit   = o.showUnit   !== false;
  const showMinMax = !!o.showMinMax;

  const { value: rawVal } = useDatapoint(config.datapoint);
  const numericVal = typeof rawVal === 'number' ? rawVal
                   : Number.isFinite(Number(rawVal)) ? Number(rawVal) : min;

  // Lokaler State nur für commitOnRelease
  const [pending, setPending] = useState<number | null>(null);
  const displayVal = pending ?? numericVal;

  const writeStepped = (v: number) => {
    const stepped = Math.round(v / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    setState(config.datapoint, clamped);
  };

  const onSliderChange = (v: number) => {
    if (commitOnRelease) setPending(v);
    else writeStepped(v);
  };
  const onSliderRelease = () => {
    if (commitOnRelease && pending != null) {
      writeStepped(pending);
      setPending(null);
    }
  };

  const triggerAction = (a: NonNullable<typeof o.actions>[number]) => {
    setState(a.dp, a.value ?? true);
  };

  const { battery, reach, batteryIcon, reachIcon, statusBadges } = useStatusFields(config);

  const SliderEl = (
    <SliderControl
      value={displayVal} min={min} max={max} step={step}
      orientation={orientation} thickness={thickness} color={color}
      onChange={onSliderChange} onRelease={onSliderRelease}
    />
  );

  const ActionRow = ({ actions }: { actions: typeof o.actions }) => (
    <div className="flex items-center gap-1 flex-wrap">
      {(actions ?? []).map((a) => {
        const Icon = getWidgetIcon(a.icon);
        return (
          <button key={a.id} type="button" className="nodrag …"
                  title={a.label ?? a.icon}
                  onClick={() => triggerAction(a)}>
            {Icon && <Icon size={18} />}
          </button>
        );
      })}
    </div>
  );

  // ── CUSTOM ────────────────────────────────────────────────────────────
  if (layout === 'custom') return (
    <CustomGridView
      config={config}
      value={`${displayVal}${showUnit && unit ? unit : ''}`}
      extraFields={{
        value:   String(displayVal),
        unit:    unit,
        min:     String(min),
        max:     String(max),
        battery, reach,
      }}
      extraComponents={{
        slider:         SliderEl,
        actions:        <ActionRow actions={o.actions as never} />,
        // Pro konfigurierter Aktion auch ein Einzel-Slot:
        ...Object.fromEntries(
          (o.actions ?? []).map((a) => [
            `action:${a.id}`,
            <SingleActionBtn action={a} onClick={() => triggerAction(a)} />,
          ]),
        ),
        'status-badges': statusBadges,
        'battery-icon':  batteryIcon,
        'reach-icon':    reachIcon,
      }}
    />
  );

  // ── DEFAULT ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-2" style={{ position: 'relative' }}>
      {/* Header-Zeile mit Titel + aktuellem Wert */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {config.title}
        </p>
        {showValue && (
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {displayVal}{showUnit && unit}
          </p>
        )}
      </div>

      {/* Slider — flexibel füllend */}
      <div className={orientation === 'vertical'
        ? 'flex-1 flex items-stretch justify-center'
        : 'flex-1 flex items-center'}>
        {showMinMax && orientation === 'horizontal' && (
          <span className="text-xs mr-2" style={{ color: 'var(--text-secondary)' }}>{min}</span>
        )}
        {SliderEl}
        {showMinMax && orientation === 'horizontal' && (
          <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{max}</span>
        )}
      </div>

      {/* Aktions-Buttons unter dem Slider (nur Default-Layout) */}
      {(o.actions as never[] | undefined)?.length ? <ActionRow actions={o.actions as never} /> : null}

      <StatusBadges config={config} />
    </div>
  );
}
```

### 3.2 `SliderControl`-Sub-Komponente

`<input type="range">` mit:

- `className="nodrag"` — **Pflicht**, sonst greift Grid-Drag (siehe Memory
  zu `DimmerWidget` Compact Layout).
- Horizontal: native Render, Track-Höhe = `thickness`.
- Vertikal: `style={{ writingMode: 'vertical-lr', direction: 'rtl' }}`
  + Fallback `orient="vertical"` für ältere WebKit-Versionen.
- Track-Fill via `linear-gradient` mit `color` bis zum Wert-Prozentsatz.
- Events:
  - `onChange` → `props.onChange(Number(e.target.value))`
  - `onPointerUp` / `onTouchEnd` / `onKeyUp` → `props.onRelease()`
- Tailwind-Klassen analog `DimmerWidget`-Slider (gleiche Optik).

### 3.3 `SingleActionBtn`-Sub-Komponente

Kreisrunder Button mit Lucide-Icon (per `getWidgetIcon`), Größe richtet
sich nach `iconSize`. Nutzt `nodrag` + identische Styles wie
`MediaplayerWidget.IconBtn`.

---

## 4. Layouts

### 4.1 Default

Aufbau (vertikal gestapelt):

1. **Header-Zeile:** Titel links, aktueller Wert rechts (`value + unit`).
2. **Slider-Bereich:** flex-1; horizontal → Slider füllt Breite, optional
   Min/Max-Labels an den Enden. Vertikal → Slider zentriert, Höhe = 100 %.
3. **Aktions-Zeile:** nur sichtbar wenn `actions.length > 0`. Buttons in
   einer flex-Row.
4. **StatusBadges** (battery, reach) wie bei allen anderen Control-
   Widgets.

Größen-Richtwerte: `defaultW=8, defaultH=4`. Vertikale Variante besser
mit `defaultW=4, defaultH=8` — Nutzer setzt das beim Wechsel der
Orientierung manuell oder per One-Click-Helfer (siehe §5.3).

### 4.2 Custom (`CustomGridView`-Reuse)

`extraFields`-Schlüssel: `value | unit | min | max | battery | reach`
`extraComponents`-Schlüssel:
- `slider` — der Slider selbst (ein Element)
- `actions` — alle konfigurierten Action-Buttons in einer Row
- `action:<id>` — **einzelner** Action-Button (für freie Platzierung
  jedes Buttons in einer eigenen Zelle); `<id>` aus
  `options.actions[].id`
- `status-badges`, `battery-icon`, `reach-icon`

Damit der Nutzer Action-Buttons einzeln in Zellen ziehen kann, muss der
Widget-Frame-Picker (siehe §5.5) die Liste `o.actions` kennen, um die
Dropdown-Optionen `action:<id>` dynamisch zu generieren — Label im
Picker = `a.label || a.icon`.

Aktivierung in `WidgetFrame.tsx` (Z. 1842): `slider` ist **nicht** in
der Ausschluss-Liste → der `custom`-Eintrag wird automatisch
angeboten. Keine Änderung nötig.

---

## 5. Konfig-UI in `WidgetFrame.tsx`

### 5.1 `pickerTarget`-Typ erweitern (Z. 1166)

```ts
const [pickerTarget, setPickerTarget] = useState<
  | …existing…
  | 'sl_action'   // ActionEditor liefert actionId mit
  | null
>(null);
```

(Primärer DP nutzt den bestehenden globalen DP-Picker — kein Extra-
Target nötig.)

### 5.2 `visFields`-Switch (Z. 1854) — Eintrag

```ts
case 'slider': return [
  { key: 'showValue',  label: 'Wert' },
  { key: 'showUnit',   label: 'Einheit' },
  { key: 'showMinMax', label: 'Min/Max-Beschriftung' },
];
```

### 5.3 Edit-Panel-Sektion `slider`

**Reihenfolge wie bei Dimmer.** Drei `<details>`-Blöcke:

1. **„Wertebereich"** (analog Dimmer „Bereich"):
   - `<input type="number">` für `min`, `max`, `step` (Defaults 0/100/1).
   - Optional: `<input type="text">` für `unit`.

2. **„Slider-Optik"**:
   - Toggle/Radio für `orientation` (`Horizontal` / `Vertikal`).
     - Beim Wechsel auf `Vertikal`: One-Click-Button „Größe anpassen
       (4×8)" — tauscht `gridPos.w` ↔ `gridPos.h`.
   - `<input type="number">` für `sliderThickness` (Default 6, Range
     2–24).
   - `<input type="number">` für optionale `sliderLength`.
   - Color-Picker für `color` (HEX-Input + Swatch — gleiche Komponente
     wie bei Conditional-Styles).
   - Checkbox `commitOnRelease` mit Hinweistext: „Wert erst beim
     Loslassen schreiben".

3. **„Aktions-Buttons"** — analog zum Mediaplayer-Chip-Editor (siehe
   `MEDIAPLAYER_CONCEPT.md` §5.3.4 + Calendar-`sources`-Editor
   Z. 158–192):
   - Liste mit Add/Remove/Up/Down.
   - Pro Eintrag:
     - Icon-Picker-Button (öffnet `IconPickerModal`) — Vorschau zeigt
       Lucide-Icon. Schnell-Auswahl: Play, Pause, Square (Stop),
       SkipForward (Weiter), SkipBack (Zurück), RotateCcw (Reset),
       Plus, Minus, Power.
     - `<input type="text">` für `label` (optional, Tooltip).
     - DatapointPicker-Button für `dp`.
     - `<input type="text">` für `value` (Default `true`, akzeptiert
       Zahlen/Strings/`true`/`false`).

### 5.4 i18n-Keys

Neue Schlüssel (gleicher Ort wie `wf.mp.*`):

```
wf.sl.range.min, wf.sl.range.max, wf.sl.range.step, wf.sl.range.unit
wf.sl.style.orientation, wf.sl.style.horizontal, wf.sl.style.vertical
wf.sl.style.thickness, wf.sl.style.length, wf.sl.style.color
wf.sl.style.commitOnRelease, wf.sl.style.commitOnRelease.hint
wf.sl.actions.title, wf.sl.actions.add
wf.sl.actions.icon, wf.sl.actions.label, wf.sl.actions.dp, wf.sl.actions.value
```

### 5.5 Custom-Grid-Picker — Komponenten-Dropdown

Im `CustomCellEditor` (in `CustomGridView.tsx` oder `WidgetFrame.tsx`,
je nach Architektur des Pickers): Wenn der Cell-Type `component` ist
und das aktuelle Widget vom Typ `slider`, müssen die Optionen
zusätzlich pro `options.actions[]` einen Eintrag `action:<id>` mit
Label `a.label || a.icon` enthalten.

Mechanik: `CustomGridView` bekommt vom Widget die `extraComponents`-
Keys; der Editor nutzt `Object.keys(extraComponents)` als Picker-
Optionen. Sofern das schon so umgesetzt ist (siehe Mediaplayer
`chips`), reicht das automatisch — keine zusätzliche Picker-Logik
nötig.

---

## 6. Default-Custom-Grid (optional)

In `CustomGridView.tsx` zusätzlichen Export, falls der Nutzer beim
Wechsel auf `layout='custom'` einen sinnvollen Startpunkt bekommen
soll:

```ts
export const DEFAULT_SLIDER_GRID: CustomGrid = [
  { type: 'title',     fontSize: 14, bold: true,         align: 'left',   valign: 'top'    },
  { type: 'empty' },
  { type: 'field',     fieldKey: 'value', suffix: '',    align: 'right',  valign: 'top'    },
  { type: 'component', componentKey: 'slider',           align: 'center', valign: 'middle' },
  { type: 'empty' },
  { type: 'empty' },
  { type: 'component', componentKey: 'actions',          align: 'left',   valign: 'bottom' },
  { type: 'empty' },
  { type: 'component', componentKey: 'status-badges',    align: 'right',  valign: 'bottom' },
];
```

In `SliderWidget` als Fallback für `config.options.customGrid`.

---

## 7. WidgetFrame: Komponenten-Map

`getWidgetMap` (oder das Äquivalent in `WidgetFrame.tsx`, das jeden
`type` auf eine Komponente abbildet — siehe Mediaplayer-Konzept §9
Schritt 10) ergänzen:

```ts
import { SliderWidget } from '../widgets/SliderWidget';
…
slider: SliderWidget,
```

---

## 8. Test-Checkliste

- [ ] Widget erscheint im „Manuell"-Dialog (Gruppe „Steuerung &
      Anzeige") direkt nach „Dimmer".
- [ ] Anlegen mit DP-Pflicht (`addMode: 'datapoint'`) funktioniert.
- [ ] Default-Layout horizontal: Slider füllt Breite, Wert rechts in
      Header, Min/Max optional an den Enden.
- [ ] Default-Layout vertikal: Slider zentriert, gleiche Optik nach
      Größenanpassung 4×8.
- [ ] `min/max/step` mit negativen Bereichen (`-50…+50`, step 5) → Slider
      rastet korrekt, schreibt skalierte Werte zurück.
- [ ] `step=0.1` (Float) — Slider zeigt Dezimalwerte ohne JS-Float-
      Drift (`toFixed`-Korrektur falls nötig).
- [ ] `commitOnRelease=false` (Default): Wert wird live geschrieben,
      DP-Updates landen sofort.
- [ ] `commitOnRelease=true`: Während Drag wird **nicht** geschrieben
      (DP bleibt konstant), erst beim Loslassen → einzelner Write.
      Auch über Tastatur (Pfeil + Loslassen) korrekt.
- [ ] Externes DP-Update (z. B. via Skript) bewegt den Slider auch
      während User-Interaktion nicht.
- [ ] `color` ändert Track-Fill, ohne Theme-Variablen zu überschreiben.
- [ ] `nodrag` auf Slider und Action-Buttons greift (kein
      Grid-Drag-Konflikt, siehe `DimmerWidget`-Memory).
- [ ] Action-Button mit `value=42` schreibt Zahl, mit `value="play"`
      schreibt String, mit leerem `value` schreibt `true`.
- [ ] `layout='custom'`: Slider, einzelne `action:<id>`-Slots und
      `actions`-Sammelslot lassen sich frei platzieren.
- [ ] StatusBadges (battery, reach) erscheinen wie bei `DimmerWidget`.
- [ ] Mobile-Ansicht: vertikaler Slider behält Höhe, horizontaler
      passt Breite an Containerbreite an.

---

## 9. Aufwand & Reihenfolge

| Schritt | Datei(en) | Geschätzt |
|---|---|---|
| 1. Typ + Registry | `types/index.ts`, `widgetRegistry.tsx` | 5 min |
| 2. Widget-Komponente Default + SliderControl | `SliderWidget.tsx` (neu) | 50 min |
| 3. Vertikal-Modus | `SliderWidget.tsx` (CSS) | 20 min |
| 4. Commit-on-Release-Logik | `SliderWidget.tsx` | 15 min |
| 5. Custom-Layout-Branch + dynamische `action:<id>` | `SliderWidget.tsx`, ggf. `CustomGridView.tsx` | 25 min |
| 6. Edit-Panel Wertebereich | `WidgetFrame.tsx` | 15 min |
| 7. Edit-Panel Slider-Optik (Orientation, Thickness, Color, Commit) | `WidgetFrame.tsx` | 30 min |
| 8. Action-Editor (Add/Remove/Up/Down + IconPicker) | `WidgetFrame.tsx` | 45 min |
| 9. visFields + i18n-Keys | `WidgetFrame.tsx`, i18n-Datei | 15 min |
| 10. Komponenten-Map registrieren | `WidgetFrame.tsx` | 2 min |

**Gesamt: ~3,5 h** für eine produktionsreife Erstversion.

---

## 10. Offene Punkte / spätere Erweiterungen

- **Tick-Markierungen** auf der Skala (alle N Steps oder benutzerdefiniert).
- **Wert-Tooltip beim Drag** (Bubble über dem Thumb, analog
  iOS-Slider).
- **Multi-Range** (zwei Thumbs für Bereichsauswahl) — eigener Layout-
  Modus `range`.
- **Long-Press auf Action-Button** für Sekundär-Aktion (z. B. Halte-
  Taste für Helligkeit-Dimmen).
- **Konditionale Farbe**: Track-Fill nutzt `accent` aus
  `WidgetCondition.style` wenn aktiv → Slider visualisiert Schwellen.
- **Snap-to-Value** (z. B. nur 0/25/50/75/100) als Alternative zu
  freiem Step.
- **Logarithmische Skala** für Bereiche wie 1–10000 (Volume in
  technischen Anwendungen).
