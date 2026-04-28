# Mediaplayer-Widget — Umsetzungskonzept

Neues Widget `mediaplayer` für das ioBroker-`vis`-Adapter-Frontend. Basis-Layout
gemäß Referenz-Screenshot (Cover links, Track-Header + Transport-Row mittig,
Chip-Row unten). Zusätzlich frei konfigurierbares `custom`-Layout.

Konventionen orientieren sich 1:1 am bestehenden `DimmerWidget` / `ValueWidget`.

---

## 1. Typen & Registry

### 1.1 `src-vis/types/index.ts`

```ts
export type WidgetType =
  | …
  | 'mediaplayer';
```

`WidgetLayout` muss nicht erweitert werden (`'default' | 'custom'` reichen aus
und sind beide schon vorhanden).

### 1.2 `src-vis/widgetRegistry.tsx`

Neuer Eintrag:

```ts
{
  type: 'mediaplayer',
  label: 'Mediaplayer',     shortLabel: 'Player',
  Icon: Music,              iconName: 'Music',     color: '#a855f7',
  defaultW: 14,             defaultH: 6,
  addMode: 'free',          widgetGroup: 'control',
  mock: { t: 'Ocean Planet', v: 'Ethereal Nights' },
}
```

`Music` aus `lucide-react` importieren.

---

## 2. Datenmodell — `WidgetConfig.options`

`config.datapoint` bleibt der primäre Status-DP (z. B. `playState` oder
`currentTitle`) — ermöglicht Auto-Erkennung weiterer DPs (siehe §6).

```ts
options: {
  // ── Anzeige-DPs (read) ────────────────────────────────────────────────
  titleDp?:     string;   // Track-Titel
  artistDp?:    string;   // Künstler
  albumDp?:     string;   // Album
  coverDp?:     string;   // Album-Art (URL oder data:image/...)
  sourceDp?:    string;   // Quelle/Player-Name ("Office")
  playStateDp?: string;   // bool | 'play'/'pause'/'stop' → Icon-Wechsel
  volumeDp?:    string;   // number — aktuelle Lautstärke (read+write)
  muteDp?:      string;   // bool — Mute-Status (read+write)

  // ── Trigger-DPs (write only) ─────────────────────────────────────────
  playDp?:      string;
  pauseDp?:     string;
  stopDp?:      string;
  nextDp?:      string;
  prevDp?:      string;
  shuffleDp?:   string;
  repeatDp?:    string;
  volUpDp?:     string;
  volDownDp?:   string;

  // ── Lautstärke-Konfiguration ─────────────────────────────────────────
  volumeMin?:   number;   // Default: 0
  volumeMax?:   number;   // Default: 100
  volumeStep?:  number;   // Default: 1

  // ── Sichtbarkeit (alle default true außer wo notiert) ────────────────
  showCover?:    boolean;
  showTitle?:    boolean;
  showSubtitle?: boolean;  // Artist · Album
  showSource?:   boolean;
  showShuffle?:  boolean;
  showRepeat?:   boolean;
  showPrev?:     boolean;
  showNext?:     boolean;
  showVolume?:   boolean;
  showMute?:     boolean;
  showChips?:    boolean;  // Default: false (nur wenn chips konfiguriert)

  // ── Schnellzugriff-Chips (variable Liste) ────────────────────────────
  chips?: Array<{
    id:    string;          // intern, z. B. Date.now()
    label: string;          // "Jazz"
    icon?: string;          // Lucide-Icon-Name (optional)
    dp:    string;          // Ziel-DP
    value?: string | number | boolean;  // zu schreibender Wert (default: true)
  }>;

  // ── Sonstiges ───────────────────────────────────────────────────────
  iconSize?:    number;     // Default: 36 (für Compact/Custom-Icon-Slot)
  customGrid?:  CustomGrid; // 9-Zellen-Grid für layout='custom' (siehe §4.2)
}
```

**Lautstärke-Mapping:** Slider zeigt immer 0–100 % an, intern wird auf
`[volumeMin … volumeMax]` skaliert:

```ts
const min = (o.volumeMin as number) ?? 0;
const max = (o.volumeMax as number) ?? 100;
const step = (o.volumeStep as number) ?? 1;
// Anzeige: ((rawVol - min) / (max - min)) * 100
// Schreiben: min + (sliderPct / 100) * (max - min)
```

Nutzer mit AVR-Pegel in dB könnten z. B. `volumeMin=-80, volumeMax=0` setzen.

---

## 3. Komponente — `src-vis/components/widgets/MediaplayerWidget.tsx`

### 3.1 Skelett

```tsx
import { useMemo } from 'react';
import { Music, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, Speaker } from 'lucide-react';
import { useDatapoint } from '../../hooks/useDatapoint';
import { useIoBroker } from '../../hooks/useIoBroker';
import type { WidgetProps } from '../../types';
import { getWidgetIcon } from '../../utils/widgetIconMap';
import { CustomGridView } from './CustomGridView';
import { StatusBadges } from './StatusBadges';
import { useStatusFields } from '../../hooks/useStatusFields';

export function MediaplayerWidget({ config }: WidgetProps) {
  const o = config.options ?? {};
  const layout = config.layout ?? 'default';
  const { setState } = useIoBroker();

  // Anzeige-DPs subscriben
  const { value: title }     = useDatapoint((o.titleDp     as string) ?? config.datapoint);
  const { value: artist }    = useDatapoint((o.artistDp    as string) ?? '');
  const { value: album }     = useDatapoint((o.albumDp     as string) ?? '');
  const { value: cover }     = useDatapoint((o.coverDp     as string) ?? '');
  const { value: source }    = useDatapoint((o.sourceDp    as string) ?? '');
  const { value: playState } = useDatapoint((o.playStateDp as string) ?? '');
  const { value: rawVol }    = useDatapoint((o.volumeDp    as string) ?? '');
  const { value: muted }     = useDatapoint((o.muteDp      as string) ?? '');

  const isPlaying = playState === true || playState === 'play' || playState === 'playing';

  // Volume-Skalierung
  const volMin  = (o.volumeMin  as number) ?? 0;
  const volMax  = (o.volumeMax  as number) ?? 100;
  const volStep = (o.volumeStep as number) ?? 1;
  const volPct = typeof rawVol === 'number'
    ? Math.round(((rawVol - volMin) / (volMax - volMin)) * 100)
    : 0;

  const writeVol = (pct: number) => {
    if (!o.volumeDp) return;
    const raw = volMin + (pct / 100) * (volMax - volMin);
    const stepped = Math.round(raw / volStep) * volStep;
    setState(o.volumeDp as string, stepped);
  };

  const trigger = (dp?: string, val: unknown = true) => {
    if (dp) setState(dp, val);
  };

  const handlePlayPause = () => {
    if (isPlaying && o.pauseDp) trigger(o.pauseDp as string);
    else if (o.playDp)          trigger(o.playDp as string);
  };

  // Sichtbarkeits-Defaults
  const showCover    = o.showCover    !== false;
  const showTitle    = o.showTitle    !== false;
  const showSubtitle = o.showSubtitle !== false;
  const showSource   = o.showSource   !== false;
  const showShuffle  = o.showShuffle  !== false && !!o.shuffleDp;
  const showRepeat   = o.showRepeat   !== false && !!o.repeatDp;
  const showPrev     = o.showPrev     !== false && !!o.prevDp;
  const showNext     = o.showNext     !== false && !!o.nextDp;
  const showVolume   = o.showVolume   !== false && !!o.volumeDp;
  const showMute     = o.showMute     !== false && !!o.muteDp;
  const showChips    = o.showChips    !== false && Array.isArray(o.chips) && (o.chips as []).length > 0;

  const { battery, reach, batteryIcon, reachIcon, statusBadges } = useStatusFields(config);

  // ── CUSTOM ────────────────────────────────────────────────────────────
  if (layout === 'custom') return (
    <CustomGridView
      config={config}
      value={String(title ?? '')}
      extraFields={{
        title:    String(title  ?? ''),
        artist:   String(artist ?? ''),
        album:    String(album  ?? ''),
        source:   String(source ?? ''),
        volume:   `${volPct}%`,
        battery, reach,
      }}
      extraComponents={{
        cover:           <CoverImg src={String(cover ?? '')} />,
        'play-pause':    <PlayPauseBtn playing={isPlaying} onClick={handlePlayPause} />,
        prev:            <IconBtn icon={SkipBack}    onClick={() => trigger(o.prevDp as string)} />,
        next:            <IconBtn icon={SkipForward} onClick={() => trigger(o.nextDp as string)} />,
        shuffle:         <IconBtn icon={Shuffle}     onClick={() => trigger(o.shuffleDp as string)} />,
        repeat:          <IconBtn icon={Repeat}      onClick={() => trigger(o.repeatDp as string)} />,
        mute:            <IconBtn icon={muted ? VolumeX : Volume2} onClick={() => trigger(o.muteDp as string, !muted)} />,
        'volume-slider': <VolSlider pct={volPct} step={volStep} onChange={writeVol} />,
        chips:           <ChipRow chips={o.chips as never} setState={setState} />,
        'status-badges': statusBadges,
        'battery-icon':  batteryIcon,
        'reach-icon':    reachIcon,
      }}
    />
  );

  // ── DEFAULT ───────────────────────────────────────────────────────────
  // Aufbau gemäß Screenshot:
  //  Reihe 1 (flex):   [Cover (aspect-square, ~40%)] [Header (title, subtitle, source) + TransportRow]
  //  Reihe 2 (flex):   [ChipRow] (horizontal scroll)
  return (
    <div className="flex flex-col h-full gap-2" style={{ position: 'relative' }}>
      <div className="flex gap-3 flex-1 min-h-0">
        {showCover && <CoverImg src={String(cover ?? '')} className="aspect-square h-full rounded-xl object-cover shrink-0" />}
        <div className="flex flex-col flex-1 min-w-0 justify-between">
          <div className="space-y-0.5">
            {showTitle    && <p className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{String(title ?? '')}</p>}
            {showSubtitle && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {[artist, album].filter(Boolean).join(' · ')}
            </p>}
            {showSource && (
              <p className="text-[11px] flex items-center gap-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                <Speaker size={11} />{String(source ?? '')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 justify-between">
            <div className="flex items-center gap-1">
              {showShuffle && <IconBtn icon={Shuffle} size="sm" onClick={() => trigger(o.shuffleDp as string)} />}
              {showPrev    && <IconBtn icon={SkipBack} size="sm" onClick={() => trigger(o.prevDp as string)} />}
              <PlayPauseBtn playing={isPlaying} onClick={handlePlayPause} />
              {showNext    && <IconBtn icon={SkipForward} size="sm" onClick={() => trigger(o.nextDp as string)} />}
              {showRepeat  && <IconBtn icon={Repeat} size="sm" onClick={() => trigger(o.repeatDp as string)} />}
            </div>
            <div className="flex items-center gap-1">
              {showMute   && <IconBtn icon={muted ? VolumeX : Volume2} size="sm" onClick={() => trigger(o.muteDp as string, !muted)} />}
              {showVolume && <VolSlider pct={volPct} step={volStep} onChange={writeVol} compact />}
            </div>
          </div>
        </div>
      </div>
      {showChips && <ChipRow chips={o.chips as never} setState={setState} />}
      <StatusBadges config={config} />
    </div>
  );
}
```

### 3.2 Sub-Komponenten (im selben File)

- **`CoverImg`**: `<img>` mit Fallback `<Music>`-Icon, abgerundete Ecken,
  `object-cover`. Default-Klasse `w-full h-full rounded-lg`.
- **`IconBtn`**: kreisrunder Button mit Lucide-Icon, Größen `sm`/`md`/`lg`.
  Klassen analog `ShutterWidget.BtnRow` (Z. 58–72).
- **`PlayPauseBtn`**: größerer Button (40×40), Icon-Wechsel `Play`↔`Pause`,
  Akzent-Hintergrund.
- **`VolSlider`**: `<input type="range" min=0 max=100 step={step}>` mit
  `nodrag`-Klasse (wichtig — verhindert Grid-Drag, siehe Memory zu
  `DimmerWidget`). `compact`-Prop reduziert Breite auf 80 px.
- **`ChipRow`**: horizontaler Scroll-Container, je Chip ein Pill-Button mit
  optionalem Icon (`getWidgetIcon`) + Label, schreibt `chip.value ?? true` auf
  `chip.dp`.

---

## 4. Layouts

### 4.1 Default

Siehe §3.1. Größe orientiert sich an `defaultW=14, defaultH=6`.

### 4.2 Custom (`CustomGridView`-Reuse)

`extraFields`-Schlüssel: `title | artist | album | source | volume | battery | reach`
`extraComponents`-Schlüssel: `cover | play-pause | prev | next | shuffle | repeat | mute | volume-slider | chips | status-badges | battery-icon | reach-icon`

Aktivierung in `WidgetFrame.tsx` (Z. 1842): `mediaplayer` ist **nicht** in der
Ausschluss-Liste → der `custom`-Eintrag wird automatisch angeboten. Keine
Änderung nötig.

---

## 5. Konfig-UI in `WidgetFrame.tsx`

### 5.1 `pickerTarget`-Typ erweitern (Z. 1166)

```ts
const [pickerTarget, setPickerTarget] = useState<
  | …existing…
  | 'mp_titleDp' | 'mp_artistDp' | 'mp_albumDp' | 'mp_coverDp' | 'mp_sourceDp'
  | 'mp_playStateDp' | 'mp_volumeDp' | 'mp_muteDp'
  | 'mp_playDp' | 'mp_pauseDp' | 'mp_stopDp' | 'mp_nextDp' | 'mp_prevDp'
  | 'mp_shuffleDp' | 'mp_repeatDp' | 'mp_volUpDp' | 'mp_volDownDp'
  | 'mp_chip'   // ChipEditor liefert chipId mit
  | null
>(null);
```

### 5.2 `visFields`-Switch (Z. 1854) — Eintrag

```ts
case 'mediaplayer': return [
  { key: 'showCover',    label: 'Cover' },
  { key: 'showTitle',    label: 'Titel' },
  { key: 'showSubtitle', label: 'Untertitel (Artist · Album)' },
  { key: 'showSource',   label: 'Quelle' },
  { key: 'showShuffle',  label: 'Shuffle' },
  { key: 'showPrev',     label: 'Vorheriger' },
  { key: 'showNext',     label: 'Nächster' },
  { key: 'showRepeat',   label: 'Repeat' },
  { key: 'showVolume',   label: 'Lautstärke-Slider' },
  { key: 'showMute',     label: 'Mute' },
  { key: 'showChips',    label: 'Schnellzugriff-Chips' },
];
```

### 5.3 Edit-Panel-Sektion `mediaplayer`

Pattern wie `shutter` (Z. 3023–3072). Strukturierung in zwei
`<details>`-Blöcken:

1. **„Anzeige-DPs"** — Texteingabe + DatapointPicker-Button für
   `title/artist/album/cover/source/playState/volume/mute`.
2. **„Steuerungs-DPs"** — dito für
   `play/pause/stop/next/prev/shuffle/repeat/volUp/volDown`.
3. **„Lautstärke"** — drei `<input type="number">` für `volumeMin`,
   `volumeMax`, `volumeStep` (Defaults 0 / 100 / 1).
4. **„Schnellzugriff-Chips"** — analog zum Calendar-`sources`-Editor
   (Z. 158–192): Liste mit add/remove/up-down, je Eintrag Label-Input,
   Icon-Picker-Button (öffnet `IconPickerModal`), DP-Picker-Button und
   optionales `value`-Feld.

### 5.4 i18n-Keys

Neue Schlüssel in der i18n-Tabelle anlegen (gleicher Ort wie bestehende
`wf.edit.layout.*`):

```
wf.mp.dp.title, wf.mp.dp.artist, wf.mp.dp.album, wf.mp.dp.cover,
wf.mp.dp.source, wf.mp.dp.playState, wf.mp.dp.volume, wf.mp.dp.mute,
wf.mp.dp.play,  wf.mp.dp.pause,  wf.mp.dp.stop,
wf.mp.dp.next,  wf.mp.dp.prev,
wf.mp.dp.shuffle, wf.mp.dp.repeat,
wf.mp.vol.min, wf.mp.vol.max, wf.mp.vol.step,
wf.mp.chips.title, wf.mp.chips.add, wf.mp.chips.label, wf.mp.chips.value
```

---

## 6. Auto-Erkennung — `src-vis/utils/dpTemplates.ts`

Template `mediaplayer` ergänzen, das anhand des gewählten `config.datapoint`
Geschwister-DPs vorschlägt. Bekannte Adapter-Patterns:

| Adapter | Beispiel-Pfad | Mapping-Hinweis |
|---|---|---|
| `sonos.0.root.…` | `…media.title`, `…media.artist`, `…media.album_art`, `…volume` | direkt |
| `spotify-premium.0.player.*` | `currentTrack.name`, `currentTrack.artistName`, `currentTrack.album.images_0_url` | tiefer geschachtelt |
| `alexa2.0.*Player` | `currentTitle`, `currentArtist`, `currentAlbum`, `imageURL` | groß-/klein-gemischt |
| `mpd.0.…` | `Title`, `Artist`, `Album`, `mixrampdb` (kein Cover) | dB-Volume → `volumeMin/-Max` setzen |

Funktion `autoDetectMediaplayerDps(mainDp)` analog zu
`autoDetectStatusDps`: iteriert die Geschwister-Objekte (über
`getObjectViewDirect` / `lookupDatapointEntry`) und matcht über Suffixe
case-insensitiv.

Aufruf einbauen, wenn der Nutzer im Edit-Panel den primären Datenpunkt
(`config.datapoint`) ändert oder per Button „Auto-Erkennung" auslöst.

---

## 7. Default-Custom-Grid

Optional: in `CustomGridView.tsx` zusätzlichen Export:

```ts
export const DEFAULT_MEDIAPLAYER_GRID: CustomGrid = [
  { type: 'component', componentKey: 'cover',     align: 'center', valign: 'middle' },
  { type: 'title',     fontSize: 16, bold: true,   align: 'left', valign: 'top' },
  { type: 'component', componentKey: 'play-pause', align: 'center', valign: 'middle' },
  { type: 'empty' },
  { type: 'field',     fieldKey: 'artist',         align: 'left', valign: 'middle' },
  { type: 'component', componentKey: 'volume-slider', align: 'right', valign: 'middle' },
  { type: 'empty' },
  { type: 'component', componentKey: 'chips',     align: 'left', valign: 'bottom' },
  { type: 'empty' },
];
```

In `MediaplayerWidget` als Fallback für `config.options.customGrid`.

---

## 8. Test-Checkliste

- [ ] Widget erscheint im „Manuell"-Dialog (Gruppe „Steuerung & Anzeige").
- [ ] Anlegen ohne primären DP funktioniert (`addMode: 'free'`).
- [ ] Default-Layout rendert sauber bei 14×6, 10×5, 6×4 (Mobile).
- [ ] Cover-Fallback (kein DP / leerer Wert) zeigt `Music`-Icon, kein broken-image.
- [ ] Play/Pause toggelt korrekt anhand `playStateDp` (alle drei Wertarten:
      bool, `'play'`/`'pause'`, `'playing'`/`'paused'`).
- [ ] Volume-Slider mit `volumeMin=-80, volumeMax=0` zeigt 0–100 % UI an,
      schreibt aber dB-Werte.
- [ ] Volume-Slider mit `volumeStep=5` rastet auf 5er-Schritte.
- [ ] Mute-Toggle invertiert `muteDp`.
- [ ] Chip-Klick schreibt konfigurierten Wert auf den Chip-DP.
- [ ] `layout='custom'`: alle `extraComponents` lassen sich frei platzieren.
- [ ] Kein Drag-Konflikt mit dem Grid (Slider/Buttons müssen `nodrag`).
- [ ] Auto-Erkennung füllt bei Sonos/Spotify/AlexaPlayer-Hauptpfaden ≥ 70 %
      der Slots korrekt.
- [ ] StatusBadges (battery, reach) erscheinen wie bei `DimmerWidget`.

---

## 9. Aufwand & Reihenfolge

| Schritt | Datei(en) | Geschätzt |
|---|---|---|
| 1. Typ + Registry | `types/index.ts`, `widgetRegistry.tsx` | 5 min |
| 2. Widget-Komponente Default | `MediaplayerWidget.tsx` (neu) | 60 min |
| 3. Volume-Skalierung + Mute | `MediaplayerWidget.tsx` | 15 min |
| 4. Custom-Layout-Branch | `MediaplayerWidget.tsx`, `CustomGridView.tsx` | 20 min |
| 5. Edit-Panel DPs | `WidgetFrame.tsx` | 45 min |
| 6. Edit-Panel Volume-Range | `WidgetFrame.tsx` | 10 min |
| 7. Chip-Editor | `WidgetFrame.tsx` | 40 min |
| 8. i18n-Keys | i18n-Datei | 10 min |
| 9. Auto-Erkennung | `dpTemplates.ts` | 30 min |
| 10. WidgetFrame: Komponente in `getWidgetMap` registrieren | `WidgetFrame.tsx` | 2 min |

**Gesamt: ~4 h** für eine produktionsreife Erstversion (ohne Auto-Erkennung
für exotische Adapter).

---

## 10. Offene Punkte / spätere Erweiterungen

- **Progress-Bar** für Track-Position (DPs `positionDp` + `durationDp`).
- **Cover als Hintergrund** mit Blur (Layout-Variante `card`).
- **Queue-Anzeige** (nächster Track) — eigenes Layout.
- **Chip-Layout-Variante** ohne Cover/Header, nur Schnellzugriff
  (Layout `chips-only`).
- **Drag-to-Seek** auf der Progress-Bar.
- **Spotify-Suchfeld** (Lupe-Icon im Screenshot rechts oben) — bedingt
  Adapter-spezifisch und sollte als optionale `searchDp` (string-write)
  gebaut werden.
