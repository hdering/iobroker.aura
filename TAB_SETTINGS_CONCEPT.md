# Tab‑Settings‑Erweiterung: Deaktivieren & bedingter Tab‑Button‑Style

## Ziel
Im Backend (Dashboard‑Editor → Tab‑Settings‑Popover) zwei neue Funktionen pro Tab:
1. **Tab deaktivieren** – Tab im Frontend ausblenden (Editor‑Sicht zeigt ihn weiterhin, ausgegraut).
2. **Bedingter Tab‑Button‑Style** – Bedingungen (DP‑basiert) ändern den Stil des **Tab‑Buttons** (Schriftfarbe, Hintergrund, Border, Pulse/Blink). UI = identisch zum Widget‑Conditions‑Menü (`ConditionEditor`); nur die Styles werden hier auf den Tab‑Button gemappt statt auf das Widget.

## Datenmodell

### `src-vis/store/dashboardStore.ts` – `Tab` erweitern

```ts
export interface Tab {
  id: string;
  name: string;
  slug: string;
  widgets: WidgetConfig[];
  icon?: string;
  hideLabel?: boolean;

  // NEU
  disabled?: boolean;                // (1)
  conditions?: WidgetCondition[];    // (2) – wiederverwendet aus types/index.ts
}
```

`WidgetCondition`/`ConditionClause`/`ConditionStyle` werden 1:1 wiederverwendet (`src-vis/types/index.ts:119‑149`). Damit kann derselbe `ConditionEditor` zum Pflegen genutzt werden.

`updateTab` so erweitern, dass auch `'disabled' | 'conditions'` zugelassen sind:
```ts
updateTab: (id, patch: Partial<Pick<Tab,
  'name' | 'slug' | 'icon' | 'hideLabel' | 'disabled' | 'conditions'
>>) => void;
```

## UI – Tab‑Settings‑Popover (`AdminEditor.tsx`, Panel ab ~Zeile 924)

Zwei neue Sektionen unter dem bestehenden Icon‑Block:

### (1) Toggle „Tab deaktiviert"
Analog zum bestehenden `hideLabel`‑Toggle. Setzt `disabled` über `updateTab`.

### (2) Sektion „Bedingungen"
Aufklappbar (Default eingeklappt). Enthält direkt den existierenden `ConditionEditor`:
```tsx
<ConditionEditor
  conditions={settingsTab.conditions ?? []}
  onChange={(next) => updateTab(settingsTabId, { conditions: next })}
  context="tab"          // NEU optional: Labels „Widget verbergen" → „Tab verbergen"
/>
```
- Style‑Felder bleiben dieselben (Accent, BG, Border, Text Primary, Text Secondary).
- Effects (`pulse`, `blink`) bleiben vorhanden.
- `hideWidget` wird im Tab‑Kontext als „Tab ausblenden bei Bedingung" interpretiert (= dynamisches Pendant zu `disabled`). `reflow` entfällt für Tabs.

Das Popover ist heute auf Breite `w-64` (~256 px) – für die Conditions‑Liste auf `w-80`/`w-96` aufbohren oder vor dem Aufklappen der Section ausweiten.

## Auswertung im Frontend (TabBar)

Neuer Hook `src-vis/hooks/useTabConditionStyle.ts` – Mini‑Variante von `useConditionStyle`:

```ts
export interface TabConditionResult {
  cssVars: Record<string, string>;     // CSS‑Variablen, auf Tab‑Button gesetzt
  effect: 'pulse' | 'blink' | null;
  hidden: boolean;
}

export function useTabConditionStyle(conditions?: WidgetCondition[]): TabConditionResult;
```
- Logik (Subscribe, evaluate, merge) ist identisch zu `useConditionStyle`.
- Gibt aber **andere CSS‑Variablen** zurück, damit nur der Tab‑Button gestylt wird – nicht die globalen Widget‑Vars:

| `ConditionStyle.*` | Tab‑Var |
|---|---|
| `accent`        | `--tab-accent` |
| `bg`            | `--tab-bg` |
| `border`        | `--tab-border` |
| `textPrimary`   | `--tab-text` |
| `textSecondary` | `--tab-text2` |

Im TabBar (`src-vis/components/layout/TabBar.tsx`) – pro Tab‑Render:
```tsx
const { cssVars, effect, hidden } = useTabConditionStyle(tab.conditions);
if (hidden || tab.disabled) return null;   // Frontend‑Filter
return (
  <button
    style={{
      ...cssVars,
      background: isActive ? 'var(--tab-accent, var(--accent))22' : 'var(--tab-bg, var(--app-surface))',
      borderColor: isActive ? 'var(--tab-accent, var(--accent))' : 'var(--tab-border, var(--app-border))',
      color: isActive ? 'var(--tab-accent, var(--accent))' : 'var(--tab-text, var(--text-secondary))',
      animation: effect === 'pulse' ? 'tabPulse 1.5s ease-in-out infinite'
               : effect === 'blink' ? 'tabBlink 1s step-end infinite' : undefined,
    }}
    …
  />
);
```
Fallback‑Pattern `var(--tab-X, var(--default))` sorgt dafür, dass Tabs ohne aktive Bedingung das normale Theme erben.

Editor‑TabBar (`AdminEditor.tsx::TabBar`) bekommt **nur eine reduzierte Version**: Style‑Vorschau ja, aber `disabled` nicht ausblenden – nur ausgrauen, damit man den Tab im Editor weiterhin pflegen kann. Effekt‑Animationen optional ausschalten, um Bearbeitung nicht zu stören (`isEditor` Flag).

## CSS‑Animationen
Falls noch nicht global vorhanden, in `src-vis/styles/*.css` ergänzen:
```css
@keyframes tabPulse { 0%,100%{opacity:1} 50%{opacity:.55} }
@keyframes tabBlink { 0%,49%{opacity:1} 50%,100%{opacity:.2} }
```
(Widget‑Pendants existieren bereits – ggf. wiederverwenden / umbenennen.)

## Migration / Persistenz
- `Tab.disabled` und `Tab.conditions` sind optional → keine Migration im `merge`‑Hook nötig.

## i18n‑Keys (de/en)
```
editor.tabMgmt.disabled        „Tab deaktiviert" / „Tab disabled"
editor.tabMgmt.conditions      „Bedingungen" / „Conditions"
editor.tabMgmt.hideTabOnCond   „Tab verbergen, wenn Bedingung zutrifft" / „Hide tab when condition matches"
```
Falls `ConditionEditor` ein `context="tab"` Prop bekommt: bestehende Label‑Keys (`cond.hideWidget`) durch tab‑spezifische ersetzen.

## Betroffene Dateien
| Datei | Änderung |
|---|---|
| `src-vis/types/index.ts` | (kein Schema‑Change – `WidgetCondition` wird wiederverwendet) |
| `src-vis/store/dashboardStore.ts` | `Tab.disabled`, `Tab.conditions`; `updateTab`‑Typ erweitern |
| `src-vis/pages/admin/AdminEditor.tsx` | Settings‑Popover: Toggle „Deaktiviert" + Section „Bedingungen" mit `ConditionEditor`; Tab‑Chip ausgrauen bei `disabled` |
| `src-vis/components/config/ConditionEditor.tsx` | optionaler `context: 'widget' \| 'tab'`‑Prop für Label‑Texte |
| `src-vis/hooks/useTabConditionStyle.ts` | **NEU**, Variante von `useConditionStyle` mit Tab‑CSS‑Vars |
| `src-vis/components/layout/TabBar.tsx` | Filter `disabled`/`hidden`, Hook anwenden, CSS‑Vars + Effect auf Button |
| `src-vis/styles/*.css` (oder bestehender Keyframe‑Block) | `tabPulse`, `tabBlink` falls fehlend |
| `src-vis/i18n/de.ts`, `src-vis/i18n/en.ts` | neue Keys |

## Edge Cases
- **Alle Tabs deaktiviert/versteckt** → Frontend zeigt Empty‑State; Editor verhindert Toggle, wenn nur ein Tab existiert (analog zur Lösch‑Sperre `tabs.length > 1`).
- **Aktiver Tab wird durch Bedingung verborgen** → `setActiveTab` springt auf nächsten sichtbaren Tab; sonst Empty‑State.
- **Inaktiv vs. aktiv**: Style‑Override greift in beiden Zuständen, aber die Active‑Hervorhebung (`accent`‑Frame) hat Vorrang über das Custom‑Background; Erfahrungswert beim Test einholen, ggf. nur im inaktiven Zustand überschreiben.
- **Editor**: Animationen (`pulse`/`blink`) im Editor unterdrücken, sonst zappelt die TabBar während der Bearbeitung.

## Reihenfolge der Umsetzung
1. Typ‑Erweiterung `Tab` + Store (`disabled`, `conditions`).
2. Toggle „Deaktiviert" im Settings‑Popover + Frontend‑Filter `TabBar`.
3. `ConditionEditor` minimal generalisieren (`context`‑Prop) – kein Refactor der Style/Effect‑Felder.
4. Section „Bedingungen" im Settings‑Popover – `ConditionEditor` einbinden.
5. Hook `useTabConditionStyle` + Anwendung im Frontend‑`TabBar`.
6. CSS‑Keyframes prüfen/ergänzen.
7. Editor‑TabBar: ausgrauen statt verstecken, Animationen aus.
8. i18n‑Keys.
