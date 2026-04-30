# Umsetzungskonzept: Widget "Müllabfuhr-Zeitplan" (`trashSchedule`)

## 1. Ziel & Abgrenzung

Neues Widget **"Müllabführ (Müllabfuhr-Zeitplan)"**, das das vorhandene
`trash`-Widget (TrashWidget.tsx) optisch nachbildet, aber die Tonnen-Daten
**aus genau einem JSON-Datenpunkt** liest statt aus mehreren bool-DPs.

Zielgruppe: Nutzer des ioBroker-Adapters `trashschedule.0.json` (oder
kompatible eigene JSON-DPs), die statt N einzelner DPs nur einen Listen-DP
konfigurieren wollen.

### Abgrenzung zum bestehenden TrashWidget

| Aspekt           | `trash` (alt)                                     | `trashSchedule` (neu)                |
| ---------------- | ------------------------------------------------- | ------------------------------------ |
| Datenquelle      | Pro Tonne 1 boolean-DP                            | **1 JSON-Array-DP**                  |
| Tonnen-Liste     | manuell konfiguriert (`bins[]`)                   | dynamisch aus JSON                   |
| Farbe            | aus Konfig (`bin.color`)                          | aus JSON `_color`                    |
| Icon             | aus Konfig (`bin.icon`)                           | per `name → icon` Mapping (Konfig)   |
| Ausblenden       | per `hideWhen` (true/false/never)                 | per Name-Checkbox in Konfig          |
| Zusatzinfo       | —                                                 | `daysLeft`, `nextDate` (formatiert)  |

Das alte `trash`-Widget bleibt unverändert bestehen.

## 2. Eingabedatenformat

Der JSON-DP enthält ein Array dieser Struktur (bereits vom Adapter geliefert):

```json
[
  {"name":"Restmuelltonne","daysLeft":18,"nextDate":1779055200000,"_completed":false,"_color":"#545454"},
  {"name":"Gelber Sack","daysLeft":18,"nextDate":1779055200000,"_completed":false,"_color":"#bab827"},
  {"name":"Papiertonne","daysLeft":25,"nextDate":1779660000000,"_completed":false,"_color":"#2764ba"},
  {"name":"Bioabfalltonne","daysLeft":25,"nextDate":1779660000000,"_completed":false,"_color":"#27ba4e"}
]
```

### Felder

| Feld           | Typ      | Pflicht | Verwendung                                                        |
| -------------- | -------- | ------- | ----------------------------------------------------------------- |
| `name`         | string   | ✓       | Beschriftung + Schlüssel für Sichtbarkeit/Icon-Mapping            |
| `daysLeft`     | number   | ✓       | Anzeige als kleine Zahl ("in 18 T.") + Sortier-/Highlight-Basis   |
| `nextDate`     | number   | ✓       | Unix-Timestamp ms; formatiert als `dd.MM.` unter dem Namen        |
| `_color`       | string   | ✓       | Kreis-Hintergrund + Border (überschreibt Konfig-Default)          |
| `_completed`   | boolean  | –       | wenn `true` → gedimmt (heutige Abholung erledigt)                 |
| `_description` | string   | –       | ignoriert (informativ aus Adapter)                                |

**Robustheit:**
- Fehlt `_color` → Fallback `#6b7280` (gleiche Default-Farbe wie TrashWidget).
- `JSON.parse`-Fehler → leerer Array, Empty-State zeigen.
- Nicht-Array-Wert → wie Empty-State.
- `name` fehlt → Eintrag überspringen (wir brauchen ihn als Key).

## 3. Datei- und Code-Struktur

### Neue Datei
`src-vis/components/widgets/TrashScheduleWidget.tsx` — exportiert
`TrashScheduleWidget` (Render) und `TrashScheduleConfig` (Editor-Panel).

### Anzupassende Dateien

1. **`src-vis/types/index.ts`**
   - `WidgetType` um `'trashSchedule'` erweitern.

2. **`src-vis/widgetRegistry.tsx`**
   - Neuer Registry-Eintrag direkt unterhalb von `'trash'`:
     ```ts
     {
       type: 'trashSchedule',
       label: 'Müllabfuhr-Zeitplan',  shortLabel: 'Zeitplan',
       Icon: CalendarClock,           iconName: 'CalendarClock', color: '#6b7280',
       defaultW: 10,                  defaultH: 5,
       addMode: 'datapoint',          widgetGroup: 'special',
       mock: { t: 'Müllabfuhr-Zeitplan', v: '' },
     },
     ```
   - `addMode: 'datapoint'` → der Datenpunkt-Picker im Hinzufügen-Dialog
     bietet ihn direkt an.

3. **`src-vis/components/layout/WidgetFrame.tsx`**
   - Import: `import { TrashScheduleWidget, TrashScheduleConfig } from '../widgets/TrashScheduleWidget';`
   - `WIDGET_COMPONENTS`: `trashSchedule: TrashScheduleWidget`
   - `wide={…}`-Liste: `'trashSchedule'` ergänzen (gleicher Edit-Panel-Modus).
   - Layout-Whitelists (custom-Layout-Filter, Icon/Stil-Sektion, …): in
     **allen** Listen, in denen `'trash'` ausgeschlossen wird, auch
     `'trashSchedule'` ausschließen — der Editor zeigt sonst irrelevante
     Optionen (Stil, Custom-Layout, Icons, …).
   - Custom-Config-Branch: `{config.type === 'trashSchedule' && <TrashScheduleConfig … />}`

## 4. Komponentenarchitektur

### `TrashScheduleWidget`

```
┌──────────────────────────────────────────────┐
│ Müllabfuhr-Zeitplan       (config.title)     │
│                                              │
│   ●          ●          ●          ●         │
│  Rest      Gelber      Papier       Bio      │
│  18 T.      18 T.       25 T.       25 T.    │
│  17.05.    17.05.      24.05.      24.05.    │
└──────────────────────────────────────────────┘
```

- Liest **einen** DP via `useDatapoint(config.datapoint)`.
- Parst `value` als JSON; leitet `BinEntry[]` ab.
- Filter: nur Einträge, deren `name` nicht in
  `config.options.hiddenNames: string[]` steht.
- Sortierung: nach `daysLeft` aufsteigend (nächste Abholung links).
- Icon-Größe: `bins.length <= 2 ? 72 : <=4 ? 58 : 44` — analog TrashWidget.
- `_completed === true` → gedimmt (Hintergrund transparent, Icon in
  `_color`), gleiches visuelles Idiom wie `hideWhen='never'` im alten
  Widget.
- **Icon-Auflösung** über `iconMap: Record<name, iconName>`-Konfig
  (`config.options.iconMap`), Fallback `Trash2`.
- Empty-State (kein DP gewählt **oder** leeres Array): identisch zum
  TrashWidget — Truck-Icon + Hinweistext "Keine Tonnen im Zeitplan".

### `TrashScheduleConfig` (Editor-Panel)

Drei Bereiche:

1. **Datenpunkt** — `DatapointPicker` analog `EChartsPresetWidget` /
   anderen DP-basierten Widgets, schreibt nach `config.datapoint`.

2. **Live-Vorschau & Sichtbarkeit** — listet alle `name`-Werte, die
   aktuell im JSON enthalten sind. Pro Eintrag:
   - Checkbox **"Anzeigen"** (Default: on; Off → `name` in `hiddenNames`)
   - Farbpunkt (read-only, aus `_color` zur Orientierung)
   - Icon-Picker (gleiche Optionen wie TrashWidget: `TRASH_ICON_OPTIONS`),
     schreibt `iconMap[name] = iconName`.

   Wenn der DP noch leer/ungültig ist: Hinweistext
   "DP wählen, um Tonnen zu sehen".

3. **Anzeige-Optionen**
   - `[x] Tage anzeigen` (`config.options.showDays`, Default `true`)
   - `[x] Datum anzeigen` (`config.options.showDate`, Default `true`)
   - Datumsformat (Select: `dd.MM.` / `dd.MM.yyyy` / `EE dd.MM.`,
     Default `dd.MM.`).

## 5. Datenmodell (`config.options`)

```ts
interface TrashScheduleOptions {
  hiddenNames?: string[];                      // Namen, die ausgeblendet sind
  iconMap?:     Record<string, string>;        // name → iconName (TRASH_ICON_OPTIONS)
  showDays?:    boolean;                       // default: true
  showDate?:    boolean;                       // default: true
  dateFormat?:  'dd.MM.' | 'dd.MM.yyyy' | 'EE dd.MM.';
  hideTitle?:   boolean;                       // gleich wie TrashWidget
}
```

`config.datapoint` hält den JSON-DP-Pfad (z. B. `trashschedule.0.json`).

## 6. Edge Cases & Verhalten

| Situation                                     | Verhalten                                                  |
| --------------------------------------------- | ---------------------------------------------------------- |
| DP nicht gesetzt                              | Empty-State (Truck + "Datenpunkt wählen")                  |
| DP-Wert `null` / leerer String                | Empty-State                                                |
| DP-Wert nicht parsebar                        | Empty-State + Konsolen-`debug` (kein User-Error)           |
| `_color` fehlt                                | Fallback `#6b7280`                                         |
| `daysLeft < 0`                                | Anzeige "fällig" statt "in X T." (rote Schrift optional)   |
| `daysLeft === 0`                              | "heute" statt "in 0 T."                                    |
| `_completed === true` UND Datum heute         | gedimmt + Schriftzug "erledigt"                            |
| Eintrag vom Nutzer ausgeblendet               | wird auch nicht in Größenberechnung (`bins.length`) gezählt|
| Neuer Name taucht im JSON auf, der nicht im   | Default sichtbar (nicht in `hiddenNames`); IconMap-Fallback|
| `iconMap` steht                               | `Trash2`                                                   |

## 7. Implementierungs-Schritte (Reihenfolge)

1. `WidgetType` erweitern (`types/index.ts`).
2. Registry-Eintrag (`widgetRegistry.tsx`).
3. `TrashScheduleWidget.tsx` anlegen (Renderer + Config-Panel,
   wiederverwendet `TRASH_ICON_OPTIONS` und `ICON_MAP` aus
   `TrashWidget.tsx` per Re-Export).
4. `WidgetFrame.tsx` verdrahten (Import, `WIDGET_COMPONENTS`,
   Layout-Whitelists, Config-Branch).
5. i18n-Strings ergänzen (`src-vis/i18n/de.ts`, `en.ts`):
   `trashSchedule.empty`, `trashSchedule.noBins`, `trashSchedule.today`,
   `trashSchedule.due`, `trashSchedule.daysShort`.
6. Manueller UI-Test: DP mit Beispieldaten setzen, Sichtbarkeits-Toggle,
   Icon-Mapping, Datum-Format, `_completed`-Dimmen.

## 8. Aufwandsschätzung

- Komponente + Config: ~250 Zeilen TSX (≈ Größe von TrashWidget).
- Registry/Frame/Types: ~10 Touch-Points, < 30 Zeilen.
- I18n: 5 Strings × 2 Sprachen.
- Geschätzte Umsetzungszeit: **1 fokussierte Session**.

## 9. Spätere Erweiterungen (nicht Teil dieses Konzepts)

- Optional: Push-Indikator/Badge "morgen" (`daysLeft===1`).
- Optional: Komplette Liste statt Kreise (Layout `agenda`).
- Optional: Auto-Mapping `name → iconName` per Heuristik
  (`/papier/i → Newspaper`, `/bio/i → Leaf`, `/gelb/i → ShoppingBag`,
  `/rest/i → Trash2`), damit der Nutzer den IconMap-Schritt überspringen
  kann.
