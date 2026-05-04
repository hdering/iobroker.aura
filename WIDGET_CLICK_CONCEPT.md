# Widget-Klick-Aktion – Umsetzungskonzept

## Ziel
Pro Widget konfigurierbar, was bei Klick im Frontend (Run-Mode, **nicht** im editMode) passiert:

**Popup-Modi** (Portal-Dialog wie HomeAssistant – siehe `C:\projects\beispiele\*.png`):
1. `dimmer`        – Dimmer-Detail-Popup (Lampen-Visualisierung, %-Anzeige, Aktions-Pillen unten)
2. `thermostat`    – Thermostat-Detail-Popup (Soll-Slider, Modus-Chips, Ist-Temp)
3. `image`         – einfaches Bild (statische URL/Base64 **oder** DP mit URL/Base64)
4. `iframe`        – externe URL als iframe (im Popup, Aura bleibt offen)
5. `json`          – JSON-Pretty-Print (statisch **oder** aus DP)
6. `html`          – HTML-Block (statisch **oder** aus DP, sanitized)
7. `widget`        – Inhalt eines beliebigen anderen Widgets (oder dieses Widgets selbst, vergrößert)

**Navigations-Modi** (kein Popup):
8. `tab`           – Sprung auf anderen Tab (Layout + Tab aus Auto-Liste)
9. `external`      – externer Link (`window.location.href = …` → man verlässt Aura)
10. `widget-focus` – Sprung auf konkretes Widget in einem Tab (scrollIntoView + kurzer Pulse-Highlight) – *optional, Phase 2*

`none` (Default) = kein Klick-Handler, Verhalten wie heute.

## Datenmodell

`src-vis/types/index.ts` – neue diskriminierte Union, abgelegt in `WidgetConfig.options.clickAction`:

```ts
export type ClickAction =
  | { kind: 'none' }
  | { kind: 'popup-dimmer' }                                                 // nutzt config.datapoint
  | { kind: 'popup-thermostat'; setpointDp?: string; modeDp?: string }
  | { kind: 'popup-image';      url?: string;  dp?: string;  fit?: 'contain'|'cover' }
  | { kind: 'popup-iframe';     url: string;   sandbox?: boolean }
  | { kind: 'popup-json';       json?: string; dp?: string }
  | { kind: 'popup-html';       html?: string; dp?: string }
  | { kind: 'popup-widget';     widgetId?: string }                          // leer = "dieses Widget vergrößert"
  | { kind: 'link-tab';         layoutId: string; tabId: string }
  | { kind: 'link-external';    url: string;   newTab?: boolean }
  | { kind: 'link-widget';      layoutId: string; tabId: string; widgetId: string };

// in WidgetConfig.options:
//   clickAction?: ClickAction;
//   popupTitle?: string;            // Override für Header-Titel im Popup; sonst widget.title
//   popupShowHistory?: boolean;     // History-Icon oben rechts (DP mit common.custom.history.*)
```

`config.options` ist bereits `Record<string, unknown>` → keine Schema-Migration nötig (optional + diskriminiert).

## Wo wird das eingestellt? – Backend / Editor

**Empfohlener Ort: bestehender Widget-Settings-Popover in `WidgetFrame.tsx`** (selber Popover, in dem heute „Bearbeiten" und „Bedingungen" liegen).

Begründung:
- Die Klick-Aktion ist eine **Per-Widget-Eigenschaft** – sie gehört nicht in den globalen Tab-Settings-Bereich.
- Das Konfig-Erlebnis ist analog zu `conditions`: aufklappbare Section, schreibt in `config.options`.
- `WidgetFrame.tsx` hat bereits den State `openPanel: 'menu' | 'edit' | 'conditions' | …` (Zeile 1660). Wir erweitern um `'action'`.

Konkrete UI-Anbindung:

1. **Menü-Button** (drei-Punkte-Menü, das `openPanel='menu'` öffnet) bekommt einen neuen Eintrag „**Klick-Aktion**" (Icon `MousePointerClick`).
2. Klick öffnet `openPanel='action'` → neues Popover-Panel (Portal, Breite `w-[420px]`):
   - **Dropdown „Aktion"** – alle 10 Modes (i18n-Labels, gruppiert: *Popup / Navigation / Aus*).
   - Darunter **mode-spezifische Felder**:
     - `popup-iframe` → URL-Input + Toggle „Sandbox"
     - `popup-image` → Tab „URL | DP" (URL-Input *oder* DP-Picker `useDatapointPicker`)
     - `popup-json` / `popup-html` → Textarea + DP-Picker (XOR)
     - `popup-thermostat` → DP-Picker für Soll-Temp + Modus-DP
     - `popup-widget` → Widget-Dropdown (Auto-Liste = alle Widgets in **allen** Tabs des aktiven Layouts; Default „Dieses Widget")
     - `link-tab` → zwei Dropdowns (Layout → Tab); Tab-Liste aus `useDashboardStore` (`layouts[].tabs[]`) gefiltert auf das gewählte Layout
     - `link-external` → URL-Input + Toggle „In neuem Tab öffnen"
     - `link-widget` → drei Dropdowns (Layout → Tab → Widget)
   - **Optional** (für alle popup-Modi): Toggle „Custom Titel" + Input `popupTitle`, Toggle „History-Icon".

Als Alternative wurde geprüft, die Aktion in einem eigenen Tab unter „Bearbeiten" unterzubringen – verworfen, weil das Edit-Panel bereits sehr lang ist und die Klick-Aktion wie die Conditions ein klar abgegrenztes Konzept ist.

## Frontend – Click-Handler

`src-vis/components/layout/WidgetFrame.tsx::WidgetFrame`:

```tsx
const clickAction = (config.options?.clickAction as ClickAction | undefined) ?? { kind: 'none' };
const [popupOpen, setPopupOpen] = useState(false);

const handleWidgetClick = (e: React.MouseEvent) => {
  if (editMode || clickAction.kind === 'none') return;
  // Klicks auf interaktive Controls innerhalb des Widgets nicht abfangen:
  if ((e.target as HTMLElement).closest('[data-widget-interactive]')) return;
  e.stopPropagation();
  switch (clickAction.kind) {
    case 'link-external':
      if (clickAction.newTab) window.open(clickAction.url, '_blank', 'noopener');
      else window.location.href = clickAction.url;
      return;
    case 'link-tab':
      useDashboardStore.getState().setActiveLayoutAndTab(clickAction.layoutId, clickAction.tabId);
      return;
    case 'link-widget':
      navigateToWidget(clickAction);    // siehe unten
      return;
    default:
      setPopupOpen(true);                // alle popup-* Modes
  }
};
```

Wrapper am äußeren `<div>` von `WidgetFrame` (Zeile 1839 ff.):
```tsx
<div
  onClick={handleWidgetClick}
  style={{ cursor: !editMode && clickAction.kind !== 'none' ? 'pointer' : undefined, … }}
  …
>
```

**Wichtig:** Interaktive Widget-Controls (Switch-Toggle, Dimmer-Slider, MediaPlayer-Buttons) müssen `data-widget-interactive` setzen (oder `e.stopPropagation()` ihrer eigenen Handler genügt – beides funktioniert; das `closest()`-Pattern ist die Belt-and-Suspenders-Variante). Bestehende Widgets, die heute schon `stopPropagation` machen, brauchen **keine** Anpassung.

## Frontend – Popup-Komponente

**Neu:** `src-vis/components/widgets/popup/WidgetClickPopup.tsx`

Gemeinsamer Rahmen (Header `[× Titel       History-Icon]`, Body, schließen via Esc/Backdrop, Portal, scroll-lock):

```tsx
interface Props {
  widget: WidgetConfig;
  action: ClickAction;
  onClose: () => void;
}
export function WidgetClickPopup({ widget, action, onClose }: Props) { … }
```

Pro Mode ein **interner Renderer**:

| Mode                | Renderer-Komponente             | Quelle / Verhalten |
|---|---|---|
| `popup-dimmer`      | `DimmerPopupBody`              | nutzt `widget.datapoint` (0-100), zeigt Lampen-SVG (Füllhöhe = %), Aktions-Pillen aus `widget.options.actions` (falls vorhanden) sonst Default-Set (Power, Brightness) |
| `popup-thermostat`  | `ThermostatPopupBody`          | Soll-Slider auf `setpointDp`, Mode-Chips auf `modeDp`, Ist aus `widget.datapoint` |
| `popup-image`       | `ImagePopupBody`               | `<img src=urlOrDp>`; bei DP: `useDatapointValue(dp)` für URL/Base64 |
| `popup-iframe`      | `IframePopupBody`              | `<iframe src=url>`; `sandbox="allow-scripts allow-same-origin"` falls `sandbox=true` |
| `popup-json`        | `JsonPopupBody`                | `<pre>` mit `JSON.stringify(parse(value), null, 2)`; Quelle: `json` *oder* `useDatapointValue(dp)` |
| `popup-html`        | `HtmlPopupBody`                | `dangerouslySetInnerHTML={{__html: sanitize(value)}}`; **DOMPurify** verpflichtend |
| `popup-widget`      | `WidgetEmbedBody`              | rendert `<Widget>` aus `getWidgetMap()[targetType]` mit Mock-`gridPos` (z. B. 6×6) und `editMode=false`. Verwendet entweder `widget` selbst (falls `widgetId` leer) oder das per ID gefundene Ziel-Widget. |

Die History-Icon-Knopf-Logik (oben rechts in jedem Popup, siehe Beispiele) ruft den bereits vorhandenen Verlaufs-Dialog auf (`HistoryChartModal` o. ä. – falls noch nicht vorhanden, in Phase 2 nachziehen; vorerst: nur anzeigen wenn `popupShowHistory && DP hat history`).

## Auto-Listen für Tab-/Widget-Auswahl

`useDashboardStore` liefert bereits `layouts: Layout[]` mit `tabs: Tab[]` und `tabs[].widgets: WidgetConfig[]`. Im Settings-Panel:

```ts
const layouts = useDashboardStore((s) => s.layouts);
// Layout-Dropdown
layouts.map(l => ({ id: l.id, name: l.name }))
// Tab-Dropdown (abhängig von gewähltem Layout)
layouts.find(l => l.id === sel.layoutId)?.tabs.map(t => ({ id: t.id, name: t.name }))
// Widget-Dropdown (abhängig von gewähltem Tab)
layouts.find(l => l.id === sel.layoutId)?.tabs.find(t => t.id === sel.tabId)?.widgets
   .map(w => ({ id: w.id, label: `${w.title} (${w.type})` }))
```

Kein eigener Hook nötig – Selectoren reichen. Auto-Update bei jeder Tab-/Widget-Änderung.

## Navigation `link-tab` / `link-widget`

`dashboardStore` hat heute nur `setActiveTab(tabId)` *innerhalb des aktiven Layouts*. Wir brauchen:
```ts
setActiveLayoutAndTab(layoutId: string, tabId: string): void;
```
Implementierung: setzt `activeLayoutId` und im betreffenden Layout `activeTabId` in einer einzigen `set(...)`-Update-Aktion.

`link-widget` (Phase 2): `setActiveLayoutAndTab(...)` + nach React-Render einen Pulse auf dem Ziel-Widget triggern. Mechanik: Store-Field `focusWidgetId`, das `WidgetFrame` per Selector liest und für 1.5 s eine `widgetFocusPulse`-Animation auf dem äußeren `<div>` anwendet (CSS-Keyframe ähnlich `tabPulse`). Nach Ablauf via `setTimeout` zurücksetzen.

## Edit-Mode

- Im editMode **kein** Klick-Handler (nur Drag/Resize wie heute).
- Im editMode soll der konfigurierte Action-Modus visuell angedeutet werden: kleine Indicator-Badge oben links am Widget (z. B. `MousePointerClick`-Icon mit Tooltip „Klick → Popup Dimmer"). Optional, Phase 2.

## Sicherheit

- `popup-html`: **DOMPurify** verpflichtend. Bibliothek bereits im Bundle prüfen, sonst `npm i dompurify @types/dompurify`.
- `popup-iframe`: Default `sandbox="allow-scripts allow-same-origin"` (toggleable). CSP des Hosts muss iframe erlauben – falls die Ziel-Site `X-Frame-Options: DENY` setzt, zeigt der Body einen Fallback „Seite kann nicht eingebettet werden".
- `link-external`: bei `newTab=false` → kompletter Verlust des Aura-Zustands akzeptabel (laut Anforderung). UI im Editor warnt dezent („Aura wird verlassen").

## i18n-Keys (de / en)
```
widget.click.title              „Klick-Aktion" / „Click action"
widget.click.mode.none          „Aus"
widget.click.mode.popupDimmer   „Popup: Dimmer"
widget.click.mode.popupThermo   „Popup: Thermostat"
widget.click.mode.popupImage    „Popup: Bild"
widget.click.mode.popupIframe   „Popup: Webseite (iframe)"
widget.click.mode.popupJson     „Popup: JSON"
widget.click.mode.popupHtml     „Popup: HTML"
widget.click.mode.popupWidget   „Popup: Widget-Inhalt"
widget.click.mode.linkTab       „Sprung: Tab"
widget.click.mode.linkExternal  „Sprung: Externe URL"
widget.click.mode.linkWidget    „Sprung: Widget"
widget.click.urlOrDp            „URL oder Datenpunkt"
widget.click.openInNewTab       „In neuem Tab öffnen"
widget.click.popupTitle         „Custom Popup-Titel"
widget.click.showHistory        „History-Icon anzeigen"
widget.click.sandbox            „Sandbox aktiv"
```

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src-vis/types/index.ts` | `ClickAction` Union; `WidgetConfig.options.clickAction` kommentieren |
| `src-vis/store/dashboardStore.ts` | `setActiveLayoutAndTab()` ergänzen; (Phase 2: `focusWidgetId`) |
| `src-vis/components/layout/WidgetFrame.tsx` | `openPanel`-Union um `'action'`; Click-Handler am Outer-Div; Action-Settings-Panel rendern; Popup einbinden |
| `src-vis/components/widgets/popup/WidgetClickPopup.tsx` | **NEU** – Rahmen + Mode-Renderer-Switch |
| `src-vis/components/widgets/popup/DimmerPopupBody.tsx` | **NEU** |
| `src-vis/components/widgets/popup/ThermostatPopupBody.tsx` | **NEU** |
| `src-vis/components/widgets/popup/ImagePopupBody.tsx` | **NEU** |
| `src-vis/components/widgets/popup/IframePopupBody.tsx` | **NEU** |
| `src-vis/components/widgets/popup/JsonPopupBody.tsx` | **NEU** |
| `src-vis/components/widgets/popup/HtmlPopupBody.tsx` | **NEU** (DOMPurify) |
| `src-vis/components/widgets/popup/WidgetEmbedBody.tsx` | **NEU** – nutzt `getWidgetMap()` |
| `src-vis/components/config/ClickActionEditor.tsx` | **NEU** – Settings-UI mit Mode-Dropdown + dynamischen Feldern + Auto-Listen |
| `src-vis/i18n/de.ts`, `src-vis/i18n/en.ts` | neue Keys |
| `package.json` | ggf. `dompurify` + Types |

## Edge Cases
- **`popup-widget` zeigt sich selbst** (`widgetId` leer): kein Endlos-Klick-Loop – im Popup-Body wird der Renderer mit `editMode=false` *und* `onClick`-Wrapper-Logik **deaktiviert** aufgerufen (Prop `disableClickAction`). Andernfalls würde der Klick im Popup wieder das Popup öffnen.
- **Ziel-Widget gelöscht** (`link-widget`/`popup-widget`): Lookup gibt `undefined` → Popup zeigt „Ziel nicht mehr verfügbar"; bei `link-widget` Toast „Ziel-Widget existiert nicht mehr".
- **`link-tab` Ziel-Tab `disabled`**: Sprung trotzdem ausführen (Editor-Konsistenz) oder blockieren? → **Blockieren** + Toast „Tab ist deaktiviert", konsistent zum TabBar-Filter.
- **Klick im editMode**: niemals Action ausführen.
- **Touch-Geräte**: `onClick` reicht (React mappt). Long-Press für „Settings öffnen" wäre nett, aber außerhalb dieses Konzepts.
- **Conditions + Klick-Aktion**: orthogonal; Klick-Aktion läuft auch bei aktivierter Bedingung. Falls die Bedingung das Widget *versteckt* (`hideWidget`), gibt es nichts zu klicken – kein Konflikt.
- **iframe-Größe**: Popup default `min(90vw, 900px) × min(85vh, 700px)`. iframe füllt Body komplett (`width:100%; height:100%`).

## Reihenfolge der Umsetzung
1. **Typen** – `ClickAction` Union in `types/index.ts`.
2. **Store-Erweiterung** – `setActiveLayoutAndTab()`.
3. **Click-Handler in `WidgetFrame`** – nur `none` / `link-tab` / `link-external` (kein Popup-Code) → schon nutzbar für Navigation.
4. **`ClickActionEditor.tsx`** – komplette Settings-UI; Anbindung über neuen Eintrag im Widget-Menü und `openPanel='action'`.
5. **Popup-Rahmen** `WidgetClickPopup.tsx` – Portal, Header, Esc/Backdrop, Mode-Switch (zunächst nur Image + iframe + json als trivialste Modi).
6. **`HtmlPopupBody`** mit DOMPurify.
7. **`DimmerPopupBody`** + **`ThermostatPopupBody`** – die aufwendigsten; orientieren sich an den Beispiel-PNGs (Lampen-SVG bzw. Soll-Slider).
8. **`WidgetEmbedBody`** – Widget-Re-Use mit `disableClickAction`-Prop in `WidgetFrame`.
9. **Phase 2**: `link-widget` mit Pulse-Highlight, History-Icon-Anbindung im Popup-Header, Edit-Mode-Indicator-Badge.
10. **i18n** + Tests am Ende.
