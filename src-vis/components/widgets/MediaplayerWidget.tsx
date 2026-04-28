import { useMemo } from 'react';
import {
  Music, Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume2, VolumeX, Speaker,
} from 'lucide-react';
import { useDatapoint } from '../../hooks/useDatapoint';
import { useIoBroker } from '../../hooks/useIoBroker';
import type { WidgetProps } from '../../types';
import { getWidgetIcon } from '../../utils/widgetIconMap';
import { CustomGridView } from './CustomGridView';
import { StatusBadges } from './StatusBadges';
import { useStatusFields } from '../../hooks/useStatusFields';
import type { CustomGrid } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type MediaChip = {
  id: string;
  label: string;
  icon?: string;
  dp: string;
  value?: string | number | boolean;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CoverImage({ src }: { src: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="w-full h-full rounded-xl object-cover"
        style={{ aspectRatio: '1 / 1' }}
      />
    );
  }
  return (
    <div
      className="w-full h-full rounded-xl flex items-center justify-center"
      style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', aspectRatio: '1 / 1' }}
    >
      <Music size={28} style={{ color: 'var(--text-secondary)' }} />
    </div>
  );
}

function IconBtn({ icon: Icon, size = 'sm', onClick, active }: {
  icon: React.ElementType;
  size?: 'sm' | 'md';
  onClick: () => void;
  active?: boolean;
}) {
  const sz = size === 'sm' ? 14 : 17;
  const pad = size === 'sm' ? 'p-1.5' : 'p-2';
  return (
    <button
      onClick={onClick}
      className={`${pad} rounded-full hover:opacity-80 transition-opacity`}
      style={{
        background: active ? 'var(--accent)22' : 'var(--app-bg)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--accent)44' : 'var(--app-border)'}`,
      }}
    >
      <Icon size={sz} />
    </button>
  );
}

function PlayPauseBtn({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  const Icon = playing ? Pause : Play;
  return (
    <button
      onClick={onClick}
      className="p-2.5 rounded-full hover:opacity-80 transition-opacity"
      style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
    >
      <Icon size={18} fill="currentColor" />
    </button>
  );
}

function VolumeSlider({ pct, step, onChange, compact }: {
  pct: number;
  step: number;
  onChange: (p: number) => void;
  compact?: boolean;
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={step}
      value={pct}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ accentColor: 'var(--accent)', width: compact ? '72px' : '100%' }}
      className="nodrag h-1.5 rounded-full appearance-none cursor-pointer"
    />
  );
}

function ChipRow({ chips, onTrigger }: {
  chips: MediaChip[];
  onTrigger: (chip: MediaChip) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto nodrag" style={{ scrollbarWidth: 'none', paddingBottom: '2px' }}>
      {chips.map((chip) => {
        const ChipIcon = getWidgetIcon(chip.icon, Music);
        return (
          <button
            key={chip.id}
            onClick={() => onTrigger(chip)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap hover:opacity-80 transition-opacity shrink-0"
            style={{
              background: 'var(--app-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--app-border)',
              fontSize: '11px',
            }}
          >
            <ChipIcon size={12} />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Default custom grid for layout='custom' ───────────────────────────────────

export const DEFAULT_MEDIAPLAYER_GRID: CustomGrid = [
  { type: 'component', componentKey: 'cover',     align: 'center', valign: 'middle' },
  { type: 'title',     fontSize: 14, bold: true,   align: 'left',   valign: 'top' },
  { type: 'component', componentKey: 'play-pause', align: 'center', valign: 'middle' },
  { type: 'empty' },
  { type: 'field',     fieldKey: 'artist',          align: 'left',   valign: 'middle' },
  { type: 'component', componentKey: 'volume-slider', align: 'right', valign: 'middle' },
  { type: 'empty' },
  { type: 'component', componentKey: 'chips',       align: 'left',   valign: 'bottom' },
  { type: 'empty' },
];

// ── Main widget ───────────────────────────────────────────────────────────────

export function MediaplayerWidget({ config }: WidgetProps) {
  const o = config.options ?? {};
  const layout = config.layout ?? 'default';
  const { setState } = useIoBroker();

  const { value: title }     = useDatapoint((o.titleDp     as string) ?? config.datapoint ?? '');
  const { value: artist }    = useDatapoint((o.artistDp    as string) ?? '');
  const { value: album }     = useDatapoint((o.albumDp     as string) ?? '');
  const { value: cover }     = useDatapoint((o.coverDp     as string) ?? '');
  const { value: source }    = useDatapoint((o.sourceDp    as string) ?? '');
  const { value: playState } = useDatapoint((o.playStateDp as string) ?? '');
  const { value: rawVol }    = useDatapoint((o.volumeDp    as string) ?? '');
  const { value: muted }     = useDatapoint((o.muteDp      as string) ?? '');

  const isPlaying = useMemo(
    () => playState === true || playState === 1 || playState === 'play' || playState === 'playing',
    [playState],
  );

  const volMin  = (o.volumeMin  as number) ?? 0;
  const volMax  = (o.volumeMax  as number) ?? 100;
  const volStep = (o.volumeStep as number) ?? 1;
  const volRange = volMax - volMin || 1;

  const volPct = typeof rawVol === 'number'
    ? Math.min(100, Math.max(0, Math.round(((rawVol - volMin) / volRange) * 100)))
    : 0;

  const writeVol = (pct: number) => {
    if (!o.volumeDp) return;
    const raw = volMin + (pct / 100) * volRange;
    const stepped = Math.round(raw / volStep) * volStep;
    setState(o.volumeDp as string, stepped);
  };

  const trigger = (dp?: unknown) => {
    if (typeof dp === 'string' && dp) setState(dp, true);
  };

  const handlePlayPause = () => {
    if (isPlaying) trigger(o.pauseDp);
    else           trigger(o.playDp);
  };

  const handleChip = (chip: MediaChip) => {
    if (!chip.dp) return;
    setState(chip.dp, chip.value !== undefined ? chip.value : true);
  };

  // Sichtbarkeits-Defaults (konfigurierbar via options.show*)
  const showCover    = o.showCover    !== false;
  const showTitle    = o.showTitle    !== false;
  const showSubtitle = o.showSubtitle !== false;
  const showSource   = o.showSource   !== false && !!(o.sourceDp);
  const showShuffle  = o.showShuffle  !== false && !!(o.shuffleDp);
  const showRepeat   = o.showRepeat   !== false && !!(o.repeatDp);
  const showPrev     = o.showPrev     !== false && !!(o.prevDp);
  const showNext     = o.showNext     !== false && !!(o.nextDp);
  const showVolume   = o.showVolume   !== false && !!(o.volumeDp);
  const showMute     = o.showMute     !== false && !!(o.muteDp);
  const chips        = (o.chips as MediaChip[] | undefined) ?? [];
  const showChips    = o.showChips    !== false && chips.length > 0;

  const titleStr  = String(title  ?? '');
  const artistStr = String(artist ?? '');
  const albumStr  = String(album  ?? '');
  const sourceStr = String(source ?? '');
  const coverStr  = String(cover  ?? '');
  const subtitle  = [artistStr, albumStr].filter(Boolean).join(' · ');

  const { battery, reach, batteryIcon, reachIcon, statusBadges } = useStatusFields(config);

  // ── CUSTOM ───────────────────────────────────────────────────────────────────
  if (layout === 'custom') {
    const customGrid = (o.customGrid as CustomGrid | undefined) ?? DEFAULT_MEDIAPLAYER_GRID;
    return (
      <CustomGridView
        config={{ ...config, options: { ...o, customGrid } }}
        value={titleStr}
        extraFields={{ title: titleStr, artist: artistStr, album: albumStr, source: sourceStr, volume: `${volPct}%`, battery, reach }}
        extraComponents={{
          cover:           <CoverImage src={coverStr} />,
          'play-pause':    <PlayPauseBtn playing={isPlaying} onClick={handlePlayPause} />,
          prev:            <IconBtn icon={SkipBack}    onClick={() => trigger(o.prevDp)} />,
          next:            <IconBtn icon={SkipForward} onClick={() => trigger(o.nextDp)} />,
          shuffle:         <IconBtn icon={Shuffle}     onClick={() => trigger(o.shuffleDp)} />,
          repeat:          <IconBtn icon={Repeat}      onClick={() => trigger(o.repeatDp)} />,
          mute:            <IconBtn icon={muted ? VolumeX : Volume2} onClick={() => trigger(o.muteDp)} />,
          'volume-slider': <VolumeSlider pct={volPct} step={volStep} onChange={writeVol} />,
          chips:           showChips ? <ChipRow chips={chips} onTrigger={handleChip} /> : null,
          'status-badges': statusBadges,
          'battery-icon':  batteryIcon,
          'reach-icon':    reachIcon,
        }}
      />
    );
  }

  // ── DEFAULT ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-2" style={{ position: 'relative' }}>
      {/* Main row: cover + info/controls */}
      <div className="flex gap-3 flex-1 min-h-0">
        {showCover && (
          <div className="shrink-0" style={{ height: '100%', maxHeight: '100%' }}>
            <CoverImage src={coverStr} />
          </div>
        )}
        <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5">
          {/* Track info */}
          <div className="space-y-0.5 min-w-0">
            {showTitle && (
              <p className="text-sm font-semibold truncate leading-snug" style={{ color: 'var(--text-primary)' }}>
                {titleStr || '–'}
              </p>
            )}
            {showSubtitle && subtitle && (
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
            {showSource && sourceStr && (
              <p className="flex items-center gap-1 text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                <Speaker size={11} />
                {sourceStr}
              </p>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              {showShuffle && <IconBtn icon={Shuffle}     onClick={() => trigger(o.shuffleDp)} />}
              {showPrev    && <IconBtn icon={SkipBack}    onClick={() => trigger(o.prevDp)} />}
              <PlayPauseBtn playing={isPlaying} onClick={handlePlayPause} />
              {showNext    && <IconBtn icon={SkipForward} onClick={() => trigger(o.nextDp)} />}
              {showRepeat  && <IconBtn icon={Repeat}      onClick={() => trigger(o.repeatDp)} />}
            </div>
            <div className="flex items-center gap-1.5">
              {showMute   && (
                <IconBtn
                  icon={muted ? VolumeX : Volume2}
                  onClick={() => {
                    if (typeof o.muteDp === 'string' && o.muteDp) setState(o.muteDp, !muted);
                  }}
                />
              )}
              {showVolume && <VolumeSlider pct={volPct} step={volStep} onChange={writeVol} compact />}
            </div>
          </div>
        </div>
      </div>

      {/* Chip row */}
      {showChips && <ChipRow chips={chips} onTrigger={handleChip} />}

      <StatusBadges config={config} />
    </div>
  );
}
