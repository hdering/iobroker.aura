# File-Picker – Umsetzungskonzept

## Ziel
Im bestehenden `DatapointPicker` zusätzlich Dateien aus dem ioBroker-Host
auswählen können (typische Roots: `/opt/iobroker/*`, `/mnt/*`).
Use-Cases: Bild-Quellen für `StateImageWidget`/Image-Popup, Hintergrund-
bilder, statische JSON/HTML-Assets, Audio/Video für Mediaplayer.

Statt eines zweiten Dialogs wird der vorhandene Picker um einen Modus
"Files" erweitert (Hybrid). Beweggründe:

- nur **ein** Drag/Resize-/Theming-/Portal-Block
- nur **ein** API-Vertrag, den Konsumenten kennen müssen
- Mode-Toggle ist für gemischte Felder (DP **oder** Datei) günstig
- File-spezifische UI (Breadcrumbs, Preview) bleibt im selben Frame

## Architektur-Übersicht

```
┌─────────────────────────────── DatapointPicker ───────────────────────────────┐
│  Header: Title  [DP | Files]  Refresh  X                                      │
│ ─────────────────────────────────────────────────────────────────────────────  │
│  mode=dp     : Search + Adapter/Room/Func/Role/Type-Filter                    │
│  mode=files  : Breadcrumbs (root / sub / sub) + Search + Mime-Filter          │
│ ─────────────────────────────────────────────────────────────────────────────  │
│  mode=dp     : Liste der DPs (id/name/unit/type/logging-Badges)               │
│  mode=files  : Liste der Einträge + rechte Preview-Spalte (image/text)        │
│ ─────────────────────────────────────────────────────────────────────────────  │
│  Multi-select Footer (nur dp)                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Datenmodell

### Picker-Ergebnis (Breaking, neue diskriminierte Union)

`src-vis/components/config/DatapointPicker.tsx`:

```ts
export type PickerResult =
  | { kind: 'dp';   id: string; unit?: string; name?: string; role?: string; dpType?: string }
  | { kind: 'file'; path: string; mime?: string; size?: number; url: string };

interface DatapointPickerProps {
  currentValue: string;               // dp-id ODER file-url, je nach mode
  onSelect: (r: PickerResult) => void;
  onClose: () => void;
  /** Welche Modi sind verfügbar */
  modes?: ('dp' | 'files')[];         // default ['dp']; ['dp','files'] zeigt Toggle
  defaultMode?: 'dp' | 'files';
  /** mime-Whitelist für mode=files, z.B. ['image/*'] */
  acceptMime?: string[];
  /** DP-Typ-Whitelist (bestehend) */
  allowedTypes?: string[];
  multiSelect?: boolean;
  onMultiSelect?: (picks: DatapointEntry[]) => void;
}
```

`url` ist der vom Frontend nutzbare Pfad (`/fs/read?path=…` mit URL-Encoding).
`path` der absolute Hostpfad (für Speicherung in der Widget-Config).

### Konsum in Widgets
`StateImageWidget`, `popup-image`, MediaPlayer-Cover, Background-Settings:
Eingabefeld kann statt nur DP-ID jetzt auch eine Asset-URL halten. In
`WidgetConfig.options` wird der Wert als String abgelegt — Discriminator
ist das Präfix:

- `aura-file:/opt/iobroker/foo.png` → File-Asset, beim Render aufgelöst zu `/fs/read?path=…`
- alles andere → DP-ID (Status quo)

So bleibt das bestehende Schema kompatibel; Felder, die ausschließlich
DP akzeptieren, verbieten den File-Mode beim Picker (`modes: ['dp']`).

## Backend (`main.js::startHttpServer`)

### Konfiguration (`io-package.json` → `native`)

```json
{
  "fsRoots": [
    { "label": "ioBroker",  "path": "/opt/iobroker" },
    { "label": "Mounts",    "path": "/mnt" }
  ],
  "fsAllowWrite": false
}
```

User-konfigurierbar im Adapter-Settings-Tab. Default = beide oben, read-only.

### Endpoints

```
GET /fs/roots
    → 200 [{ label, path }]                  // Whitelist aus native.fsRoots

GET /fs/list?path=/opt/iobroker/foo
    → 200 {
        path: "/opt/iobroker/foo",
        parent: "/opt/iobroker",
        entries: [
          { name, isDir, size, mtime, mime }  // mime per ext-map; null für isDir
        ]
      }
    → 403 wenn path außerhalb aller fsRoots oder Traversal versucht

GET /fs/read?path=/opt/iobroker/foo/bild.png
    → 200 + Content-Type, streamt Datei (für <img src>, Preview, finale Auslieferung)
    → 403/404 analog
```

### Sicherheits-Pattern (analog `serveStatic` in `main.js`)

```js
function resolveSafe(rawPath) {
  const abs = path.resolve(rawPath);            // normalisiert ../, //
  const root = adapter.config.fsRoots
    .map(r => path.resolve(r.path))
    .find(r => abs === r || abs.startsWith(r + path.sep));
  if (!root) throw new HttpError(403, 'outside whitelist');
  return abs;
}
```

- **keine Symlink-Auflösung über die Wurzel hinaus**: `fs.lstat` +
  `fs.realpath` vergleichen; wenn `realpath` außerhalb von `root`, 403.
- **`fsAllowWrite=false`** → keine Upload/Delete-Routen ausgeliefert.
- **Mime-Map** wiederverwenden (Erweiterung der vorhandenen `MIME_TYPES`).

### Optionale Thumbnails (Phase 2)
`GET /fs/thumb?path=…&w=128` mit `sharp`-Resize + LRU-Cache im Adapter.
Erstmal weglassen — Browser-CSS-Resize per `<img>` reicht für die Preview-
Spalte; echte Performance-Probleme erst, wenn Verzeichnisse mit
hunderten 4K-Bildern vorkommen.

## Frontend-Implementierung

### Neue Hook-Familie
`src-vis/hooks/useFsList.ts`:

```ts
export function useFsRoots(): { roots: FsRoot[]; loading; error };
export function useFsList(path: string | null): { listing: FsListing | null; loading; error; refresh };
```

Caching: Map `path → FsListing` mit kurzer TTL (30 s) im modul-scoped State,
analog `useDatapointList`.

### Picker-Refactor
`DatapointPicker.tsx`:

- aktueller Body wird in **`<DpModeBody>`** ausgelagert (1:1 das, was jetzt da ist)
- neu: **`<FileModeBody>`** mit
  - Breadcrumb-Bar (root-Auswahl + parent-Klicks)
  - Search filtert das aktuell sichtbare Verzeichnis (kein Recursive)
  - linke Liste: Ordner zuerst, dann Dateien (sortiert nach Name)
  - rechte Spalte (≥ 720 px Picker-Breite): Preview
    - `image/*`: `<img>` mit `object-fit: contain`
    - `text/*`, `application/json`: erste 200 Zeilen `<pre>` (lazy fetch)
    - sonst: Mime-Icon + Größe
- der `[DP | Files]`-Toggle erscheint nur wenn `modes.length > 1`
- Multi-Select-Footer bleibt nur im DP-Mode aktiv (Phase 2: Files-Multi)

### i18n-Schlüssel (neu)
`src-vis/i18n/de.ts` + `en.ts`:

```
'fs.picker.title'         : 'Datei-Picker'
'fs.picker.tab.dp'        : 'Datenpunkt'
'fs.picker.tab.files'     : 'Dateien'
'fs.picker.search'        : 'Suchen…'
'fs.picker.empty'         : 'Verzeichnis ist leer'
'fs.picker.previewNone'   : 'Keine Vorschau'
'fs.picker.size'          : '{size}'           // formatiert in JS
'fs.picker.modified'      : 'Geändert: {date}'
```

### Konsum-Anpassungen
Felder, die heute den `DatapointPicker` öffnen und auch Files akzeptieren
sollen, übergeben `modes={['dp', 'files']}` und akzeptieren das neue
`PickerResult`. Felder, die nur Files wollen (z.B. ein Image-Background
in Layout-Settings), öffnen `modes={['files']}`.

Beim Speichern wird File-Pick als `aura-file:<absPath>` serialisiert.
Beim Render löst eine Helper-Funktion das auf:

```ts
// src-vis/utils/assetUrl.ts
export function resolveAssetUrl(value: string): string {
  if (value.startsWith('aura-file:')) {
    return `/fs/read?path=${encodeURIComponent(value.slice('aura-file:'.length))}`;
  }
  return value;     // bleibt eine DP-ID, wird vom DP-Subscribe-Pfad behandelt
}
```

## Schritt-Plan

1. **Backend** (`main.js`)
   - `fsRoots`/`fsAllowWrite` in `io-package.json` ergänzen + Admin-UI
   - `resolveSafe`, `/fs/roots`, `/fs/list`, `/fs/read` implementieren
   - Mime-Map aus `serveStatic` extrahieren und teilen
2. **Hooks** (`src-vis/hooks/useFsList.ts`)
   - `useFsRoots`, `useFsList` mit Cache
3. **Picker-Refactor**
   - DP-Body in eigene Komponente extrahieren
   - `FileModeBody` mit Breadcrumbs + Liste + Preview-Spalte
   - Mode-Toggle im Header
   - `PickerResult`-Union + neue Props
4. **Konsumenten**
   - `assetUrl.ts`-Helper anlegen
   - `StateImageWidget`, `popup-image`, MediaPlayer-Cover, ggf. Background-Picker
     auf neue Signatur ziehen (zunächst nur die, die explizit Files brauchen)
5. **i18n** (de/en)
6. **Smoke-Test**: Bild aus `/opt/iobroker/iobroker-data/files/...` in
   einem Image-Widget und im Mediaplayer-Cover; Traversal-Versuch
   `?path=/etc/passwd` muss 403 liefern.

## Offene Punkte / spätere Phasen

- **Schreiben/Upload**: bewusst ausgeklammert. Wenn später gewünscht,
  separater Endpoint hinter `fsAllowWrite=true` + UI im Picker (Drop-Zone
  in der Liste, "Neuer Ordner"-Button im Breadcrumb).
- **Object-DB-Files** (`adapter.readFile(adapter, path)`): aktuell nicht
  Teil des Konzepts, da der Use-Case Hostpfade ist. Falls relevant, später
  als dritter Mode `objectfs` mit eigenem Backend-Endpoint — Picker-
  Architektur ist dafür offen.
- **Thumbnails** (`/fs/thumb`): erst wenn Performance-Schmerz da ist.
- **Files-Multi-Select**: nicht in Phase 1.
- **Permission-Granularität**: aktuell global per `fsRoots`. Falls
  pro-User nötig, müsste das an die ioBroker-Authentifizierung andocken
  (out of scope).
