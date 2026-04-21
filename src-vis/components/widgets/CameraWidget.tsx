import { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, BatteryMedium, Thermometer, Shield, Activity, Building2 } from 'lucide-react';
import type { WidgetProps } from '../../types';
import { setStateDirect, subscribeStateDirect } from '../../hooks/useIoBroker';
import type { ioBrokerState } from '../../types';

// ── Exported types (used by WidgetFrame config) ───────────────────────────────

export type CameraSlotType =
  | 'empty' | 'text' | 'datapoint' | 'manufacturer'
  | 'battery' | 'temperature' | 'armed' | 'motion';

export interface CameraSlot {
  type: CameraSlotType;
  label?: string;
  value?: string;      // static text for text / manufacturer
  datapoint?: string;
  trueLabel?: string;  // armed / motion true display
  falseLabel?: string; // armed / motion false display
}

export type CameraTemplateId =
  | 'stream-left' | 'stream-top' | 'stream-topleft' | 'stream-right' | 'stream-full';

export interface TemplateSpec {
  label: string;
  slotCount: number;
  gridAreas: string | null; // null = stream-full (overlay)
  gridCols: string;
  gridRows: string;
}

export const CAMERA_TEMPLATES: Record<CameraTemplateId, TemplateSpec> = {
  'stream-left': {
    label: 'Stream links ⅔ + 3 Infos rechts',
    slotCount: 3,
    gridCols: '2fr 1fr',
    gridRows: '1fr 1fr 1fr',
    gridAreas: '"stream slot0" "stream slot1" "stream slot2"',
  },
  'stream-top': {
    label: 'Stream oben ⅔ + 3 Infos unten',
    slotCount: 3,
    gridCols: '1fr 1fr 1fr',
    gridRows: '2fr 1fr',
    gridAreas: '"stream stream stream" "slot0 slot1 slot2"',
  },
  'stream-topleft': {
    label: 'Stream oben-links 2×2 + 5 Infos',
    slotCount: 5,
    gridCols: '1fr 1fr 1fr',
    gridRows: '1fr 1fr 1fr',
    gridAreas: '"stream stream slot0" "stream stream slot1" "slot2 slot3 slot4"',
  },
  'stream-right': {
    label: 'Stream rechts ⅔ + 3 Infos links',
    slotCount: 3,
    gridCols: '1fr 2fr',
    gridRows: '1fr 1fr 1fr',
    gridAreas: '"slot0 stream" "slot1 stream" "slot2 stream"',
  },
  'stream-full': {
    label: 'Stream Vollbild + Info-Overlay',
    slotCount: 4,
    gridCols: '1fr',
    gridRows: '1fr',
    gridAreas: null,
  },
};

export const SLOT_TYPE_OPTIONS: { value: CameraSlotType; label: string }[] = [
  { value: 'empty',        label: '– Leer –' },
  { value: 'text',         label: 'Freitext' },
  { value: 'datapoint',   label: 'Datenpunkt' },
  { value: 'manufacturer',label: 'Hersteller (statisch)' },
  { value: 'battery',     label: 'Akku %' },
  { value: 'temperature', label: 'Temperatur' },
  { value: 'armed',       label: 'Scharf / Alarm' },
  { value: 'motion',      label: 'Bewegung erkannt' },
];

// ── Internal types ────────────────────────────────────────────────────────────

type StreamMode = 'img' | 'iframe' | 'rtsp-hint';
type WakeUpMode = 'auto' | 'onView' | 'onClick';

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectMode(url: string): StreamMode {
  if (!url) return 'img';
  if (url.startsWith('rtsp://') || url.startsWith('rtsps://')) return 'rtsp-hint';
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'iframe';
  return 'img';
}

const DEFAULT_LABELS: Partial<Record<CameraSlotType, string>> = {
  battery:      'Akku',
  temperature:  'Temperatur',
  armed:        'Scharf',
  motion:       'Bewegung',
  manufacturer: 'Hersteller',
};

function slotBool(val: unknown): boolean {
  return val === true || val === 1 || val === 'true' || val === '1';
}

function slotNum(val: unknown): number {
  return typeof val === 'number' ? val : parseFloat(String(val ?? ''));
}

// ── InfoCell – square cell used in custom grid ────────────────────────────────

function InfoCell({ slot, value }: { slot: CameraSlot; value: unknown }) {
  if (slot.type === 'empty') {
    return <div style={{ background: 'var(--app-bg)', borderRadius: '4px' }} />;
  }

  const label  = slot.label ?? DEFAULT_LABELS[slot.type];
  const num    = slotNum(value);
  const bool   = slotBool(value);
  const sec: React.CSSProperties = { color: 'var(--text-secondary)' };
  const pri: React.CSSProperties = { color: 'var(--text-primary)' };
  const base   = 'flex flex-col items-center justify-center h-full w-full p-1.5 gap-0.5 overflow-hidden';
  const bg     = { background: 'var(--widget-bg)', borderRadius: '4px' };
  const Lbl    = label
    ? <span className="text-[9px] truncate max-w-full text-center" style={sec}>{label}</span>
    : null;

  switch (slot.type) {
    case 'text':
    case 'manufacturer':
      return (
        <div className={base} style={{ ...bg, ...pri }}>
          {slot.type === 'manufacturer' && <Building2 size={13} style={sec} />}
          {Lbl}
          <span className="text-xs font-medium truncate max-w-full text-center">{slot.value || '–'}</span>
        </div>
      );

    case 'datapoint':
      return (
        <div className={base} style={{ ...bg, ...pri }}>
          {Lbl}
          <span className="text-xs font-medium truncate">{value != null ? String(value) : '–'}</span>
        </div>
      );

    case 'battery': {
      const pct = isNaN(num) ? null : Math.round(num);
      return (
        <div className={base} style={{ ...bg, ...pri }}>
          <BatteryMedium size={13} style={sec} />
          {Lbl}
          <span className="text-xs font-medium tabular-nums">{pct != null ? `${pct}%` : '–'}</span>
        </div>
      );
    }

    case 'temperature': {
      const temp = isNaN(num) ? null : num.toFixed(1);
      return (
        <div className={base} style={{ ...bg, ...pri }}>
          <Thermometer size={13} style={sec} />
          {Lbl}
          <span className="text-xs font-medium tabular-nums">{temp ? `${temp} °C` : '–'}</span>
        </div>
      );
    }

    case 'armed': {
      const color = bool ? '#ef4444' : '#22c55e';
      return (
        <div className={base} style={bg}>
          <Shield size={13} color={color} />
          {Lbl}
          <span className="text-xs font-medium" style={{ color }}>
            {bool ? (slot.trueLabel || 'Scharf') : (slot.falseLabel || 'Deaktiviert')}
          </span>
        </div>
      );
    }

    case 'motion': {
      const color = bool ? '#f59e0b' : undefined;
      return (
        <div className={base} style={bg}>
          <Activity size={13} color={color} style={color ? undefined : sec} />
          {Lbl}
          <span className="text-xs font-medium" style={color ? { color } : pri}>
            {bool ? (slot.trueLabel || 'Erkannt') : (slot.falseLabel || 'Keine')}
          </span>
        </div>
      );
    }

    default: return null;
  }
}

// ── InfoRow – horizontal row used in standard layout ──────────────────────────

function InfoRow({ slot, value }: { slot: CameraSlot; value: unknown }) {
  if (slot.type === 'empty') return null;

  const label  = slot.label ?? DEFAULT_LABELS[slot.type];
  const num    = slotNum(value);
  const bool   = slotBool(value);
  const sec: React.CSSProperties = { color: 'var(--text-secondary)' };
  const pri: React.CSSProperties = { color: 'var(--text-primary)' };

  let icon: React.ReactNode = null;
  let display: React.ReactNode = '–';
  let valStyle: React.CSSProperties = pri;

  switch (slot.type) {
    case 'text':
    case 'manufacturer':
      icon    = slot.type === 'manufacturer' ? <Building2 size={11} style={sec} /> : null;
      display = slot.value || '–';
      break;
    case 'datapoint':
      display = value != null ? String(value) : '–';
      break;
    case 'battery':
      icon    = <BatteryMedium size={11} style={sec} />;
      display = !isNaN(num) ? `${Math.round(num)}%` : '–';
      break;
    case 'temperature':
      icon    = <Thermometer size={11} style={sec} />;
      display = !isNaN(num) ? `${num.toFixed(1)} °C` : '–';
      break;
    case 'armed':
      valStyle = { color: bool ? '#ef4444' : '#22c55e' };
      icon     = <Shield size={11} color={valStyle.color as string} />;
      display  = bool ? (slot.trueLabel || 'Scharf') : (slot.falseLabel || 'Deaktiviert');
      break;
    case 'motion':
      valStyle = bool ? { color: '#f59e0b' } : pri;
      icon     = <Activity size={11} color={bool ? '#f59e0b' : undefined} style={bool ? undefined : sec} />;
      display  = bool ? (slot.trueLabel || 'Erkannt') : (slot.falseLabel || 'Keine');
      break;
  }

  return (
    <div className="flex items-center gap-1.5 px-2 rounded text-[11px]"
      style={{ background: 'var(--app-bg)', color: 'var(--text-primary)', minHeight: '26px', flexShrink: 0 }}>
      {icon && <span className="shrink-0">{icon}</span>}
      {label && <span className="shrink-0 text-[10px]" style={sec}>{label}</span>}
      <span className="flex-1" />
      <span className="font-medium tabular-nums" style={valStyle}>{display}</span>
    </div>
  );
}

// ── StreamView – renders img / iframe / error states ──────────────────────────

interface StreamViewProps {
  streamUrl:      string;
  mode:           StreamMode;
  imgSrc:         string;
  fitMode:        'cover' | 'contain';
  loadError:      boolean;
  onError:        () => void;
  onLoad:         () => void;
  showTimestamp:  boolean;
  lastRefresh:    Date | null;
  editMode:       boolean;
  refreshInterval:number;
  title?:         string;
}

function StreamView(p: StreamViewProps) {
  if (!p.streamUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1.5"
        style={{ background: 'var(--app-bg)' }}>
        <Camera size={26} style={{ color: 'var(--text-secondary)' }} />
        <span className="text-[10px] opacity-50" style={{ color: 'var(--text-secondary)' }}>Keine URL konfiguriert</span>
      </div>
    );
  }

  if (p.mode === 'rtsp-hint') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1 p-2"
        style={{ background: 'var(--app-bg)' }}>
        <Camera size={22} style={{ color: 'var(--text-secondary)' }} />
        <p className="text-[10px] text-center" style={{ color: 'var(--text-secondary)' }}>
          RTSP nicht unterstützt.<br />
          <span className="opacity-60">go2rtc → MJPEG-URL verwenden.</span>
        </p>
      </div>
    );
  }

  const hasError = p.loadError && p.mode === 'img';

  return (
    <div className="relative h-full w-full overflow-hidden">
      {p.mode === 'iframe' ? (
        <iframe src={p.streamUrl} title={p.title || 'Kamera'} allow="autoplay"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
      ) : (
        <img src={p.imgSrc} alt={p.title || 'Kamera'} onError={p.onError} onLoad={p.onLoad}
          style={{ width: '100%', height: '100%', objectFit: p.fitMode, display: 'block' }} />
      )}

      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <Camera size={24} style={{ color: '#ef4444' }} />
          <p className="text-xs text-white opacity-80">Verbindungsfehler</p>
        </div>
      )}

      {p.showTimestamp && p.lastRefresh && !hasError && p.mode === 'img' && (
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.8)' }}>
          {p.lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}

      {p.editMode && (
        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
          style={{
            background: p.mode === 'iframe' ? '#3b82f6' : p.refreshInterval === 0 ? '#ef4444' : 'rgba(0,0,0,0.6)',
            color: '#fff',
          }}>
          {p.mode === 'iframe' ? 'HTML' : p.refreshInterval === 0 ? 'LIVE' : 'CAM'}
        </div>
      )}
    </div>
  );
}

// ── Main CameraWidget ─────────────────────────────────────────────────────────

export function CameraWidget({ config, editMode }: WidgetProps) {
  const opts            = config.options ?? {};
  const streamUrl       = (opts.streamUrl       as string)              ?? '';
  const refreshInterval = (opts.refreshInterval as number)              ?? 5;
  const fitMode         = (opts.fitMode         as 'cover' | 'contain') ?? 'cover';
  const showTimestamp   = (opts.showTimestamp   as boolean)             ?? true;
  const wakeUpDp        = (opts.wakeUpDp        as string)              ?? '';
  const wakeUpDelay     = (opts.wakeUpDelay     as number)              ?? 3;
  const wakeUpMode      = (opts.wakeUpMode      as WakeUpMode)          ?? 'auto';
  const videoRatio      = (opts.videoRatio      as number)              ?? 60;
  const infoItems       = (opts.infoItems       as CameraSlot[])        ?? [];
  const cameraTemplate  = (opts.cameraTemplate  as CameraTemplateId)    ?? 'stream-left';
  const customSlots     = (opts.customSlots     as CameraSlot[])        ?? [];
  const layout          = config.layout ?? 'minimal';

  const mode = detectMode(streamUrl);

  // ── Stream state ────────────────────────────────────────────────────────────
  const [imgSrc,      setImgSrc]      = useState('');
  const [loadError,   setLoadError]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [waking,      setWaking]      = useState(false);
  const [streamReady, setStreamReady] = useState(false);

  const containerRef   = useRef<HTMLDivElement>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeUpDpRef    = useRef(wakeUpDp);
  const wakeUpDelayRef = useRef(wakeUpDelay);
  wakeUpDpRef.current    = wakeUpDp;
  wakeUpDelayRef.current = wakeUpDelay;

  // ── Info DP subscriptions ───────────────────────────────────────────────────
  const [dpValues, setDpValues] = useState<Record<string, ioBrokerState['val']>>({});

  const allDpKey = useMemo(() => {
    const ids = new Set<string>();
    infoItems.forEach(s => s.datapoint && ids.add(s.datapoint));
    customSlots.forEach(s => s.datapoint && ids.add(s.datapoint));
    return [...ids].sort().join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(infoItems.map(s => s.datapoint)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(customSlots.map(s => s.datapoint)),
  ]);

  useEffect(() => {
    if (!allDpKey) return;
    const ids = allDpKey.split(',').filter(Boolean);
    const unsubs = ids.map(id =>
      subscribeStateDirect(id, (state) =>
        setDpValues(prev => ({ ...prev, [id]: state.val }))
      )
    );
    return () => unsubs.forEach(fn => fn());
  }, [allDpKey]);

  // ── Wake-up helpers ─────────────────────────────────────────────────────────
  const buildSrc = (url: string) => {
    if (!url || mode !== 'img') return url;
    if (refreshInterval === 0) return url;
    return url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
  };

  function doWake() {
    if (!wakeUpDpRef.current) return;
    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    setStateDirect(wakeUpDpRef.current, true);
    setWaking(true);
    setStreamReady(false);
    wakeTimerRef.current = setTimeout(() => {
      setWaking(false);
      setStreamReady(true);
    }, wakeUpDelayRef.current * 1000);
  }

  function doSleep() {
    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    if (wakeUpDpRef.current) setStateDirect(wakeUpDpRef.current, false);
    setWaking(false);
    setStreamReady(false);
  }

  // ── Wake-up effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wakeUpDp || !streamUrl) { setStreamReady(true); return; }
    if (wakeUpMode !== 'auto') return;
    doWake();
    return () => doSleep();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeUpDp, streamUrl, wakeUpDelay, wakeUpMode]);

  useEffect(() => {
    if (!wakeUpDp || !streamUrl || wakeUpMode !== 'onClick') return;
    return () => doSleep();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeUpDp, streamUrl, wakeUpMode]);

  useEffect(() => {
    if (!wakeUpDp || !streamUrl || wakeUpMode !== 'onView') return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) doWake(); else doSleep(); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => { obs.disconnect(); doSleep(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeUpDp, streamUrl, wakeUpMode]);

  // ── Image refresh loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamUrl || !streamReady || mode !== 'img') return;
    setLoadError(false);
    setImgSrc(buildSrc(streamUrl));
    setLastRefresh(new Date());
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        setImgSrc(buildSrc(streamUrl));
        setLastRefresh(new Date());
      }, refreshInterval * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl, refreshInterval, streamReady, mode]);

  // ── Wake-up placeholder screens ─────────────────────────────────────────────
  const needsWake = !!wakeUpDp && !!streamUrl;

  if (needsWake && wakeUpMode === 'onView' && !waking && !streamReady) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center h-full gap-2"
        style={{ background: 'var(--app-bg)', borderRadius: 'var(--widget-radius)' }}>
        <Camera size={28} style={{ color: 'var(--text-secondary)' }} />
        {config.title && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{config.title}</p>}
      </div>
    );
  }

  if (needsWake && wakeUpMode === 'onClick' && !waking && !streamReady) {
    return (
      <div ref={containerRef} onClick={editMode ? undefined : doWake}
        className="flex flex-col items-center justify-center h-full gap-2 select-none"
        style={{ background: 'var(--app-bg)', borderRadius: 'var(--widget-radius)', cursor: editMode ? 'default' : 'pointer' }}>
        <div className="flex items-center justify-center rounded-full w-10 h-10"
          style={{ background: 'var(--accent)', opacity: 0.85 }}>
          <Camera size={20} color="#fff" />
        </div>
        {config.title && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{config.title}</p>}
        {!editMode && <p className="text-[10px] opacity-50" style={{ color: 'var(--text-secondary)' }}>Tippen zum Aktivieren</p>}
      </div>
    );
  }

  if (waking) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center h-full gap-2"
        style={{ background: 'var(--app-bg)', borderRadius: 'var(--widget-radius)' }}>
        <Camera size={28} style={{ color: 'var(--accent)' }} />
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Kamera wird aktiviert…</p>
      </div>
    );
  }

  // ── Shared stream view props ─────────────────────────────────────────────────
  const sv: StreamViewProps = {
    streamUrl, mode, imgSrc, fitMode, loadError,
    onError: () => setLoadError(true),
    onLoad:  () => setLoadError(false),
    showTimestamp, lastRefresh, editMode, refreshInterval,
    title: config.title,
  };

  // ── MINIMAL layout ───────────────────────────────────────────────────────────
  if (layout === 'minimal') {
    return (
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-[inherit]">
        <StreamView {...sv} />
      </div>
    );
  }

  // ── DEFAULT (Standard) layout ────────────────────────────────────────────────
  if (layout === 'default') {
    const vidH = Math.max(20, Math.min(85, videoRatio));
    return (
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-[inherit] flex flex-col"
        style={{ background: 'var(--widget-bg)' }}>
        <div style={{ height: `${vidH}%`, flexShrink: 0, overflow: 'hidden' }}>
          <StreamView {...sv} />
        </div>
        <div style={{ height: `${100 - vidH}%`, overflow: 'hidden auto', display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px' }}>
          {infoItems.length === 0
            ? <p className="text-[10px] text-center opacity-40 m-auto" style={{ color: 'var(--text-secondary)' }}>Keine Info-Zeilen konfiguriert</p>
            : infoItems.map((item, i) => (
                <InfoRow key={i} slot={item} value={item.datapoint ? dpValues[item.datapoint] : undefined} />
              ))
          }
        </div>
      </div>
    );
  }

  // ── CUSTOM GRID layout ───────────────────────────────────────────────────────
  const tmpl = CAMERA_TEMPLATES[cameraTemplate] ?? CAMERA_TEMPLATES['stream-left'];

  // stream-full: fullscreen + badge overlay
  if (cameraTemplate === 'stream-full') {
    return (
      <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-[inherit]">
        <StreamView {...sv} />
        <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-1.5 flex-wrap justify-start items-end"
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }}>
          {customSlots.map((slot, i) => {
            if (slot.type === 'empty') return null;
            const val  = slot.datapoint ? dpValues[slot.datapoint] : undefined;
            const num  = slotNum(val);
            const bool = slotBool(val);
            const lbl  = slot.label ?? DEFAULT_LABELS[slot.type];
            let display = '–';
            let color: string | undefined;
            switch (slot.type) {
              case 'text': case 'manufacturer': display = slot.value || '–'; break;
              case 'datapoint': display = val != null ? String(val) : '–'; break;
              case 'battery':   display = !isNaN(num) ? `${Math.round(num)}%` : '–'; break;
              case 'temperature': display = !isNaN(num) ? `${num.toFixed(1)}°C` : '–'; break;
              case 'armed':
                color   = bool ? '#ef4444' : '#22c55e';
                display = bool ? (slot.trueLabel || 'Scharf') : (slot.falseLabel || 'Aus'); break;
              case 'motion':
                if (bool) color = '#f59e0b';
                display = bool ? (slot.trueLabel || 'Erkannt') : (slot.falseLabel || 'Keine'); break;
            }
            return (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'rgba(0,0,0,0.55)', color: color ?? '#fff' }}>
                {lbl ? `${lbl}: ${display}` : display}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // Other templates: CSS grid-template-areas
  const filledSlots = customSlots.slice(0, tmpl.slotCount);
  const emptyCount  = Math.max(0, tmpl.slotCount - filledSlots.length);

  return (
    <div ref={containerRef}
      className="h-full w-full overflow-hidden rounded-[inherit]"
      style={{
        display: 'grid',
        gap: '2px',
        gridTemplateColumns: tmpl.gridCols,
        gridTemplateRows: tmpl.gridRows,
        gridTemplateAreas: tmpl.gridAreas!,
        background: 'var(--app-bg)',
      }}>
      <div style={{ gridArea: 'stream', overflow: 'hidden', borderRadius: '4px' }}>
        <StreamView {...sv} />
      </div>
      {filledSlots.map((slot, i) => (
        <div key={i} style={{ gridArea: `slot${i}`, overflow: 'hidden', borderRadius: '4px' }}>
          <InfoCell slot={slot} value={slot.datapoint ? dpValues[slot.datapoint] : undefined} />
        </div>
      ))}
      {Array.from({ length: emptyCount }, (_, i) => (
        <div key={`pad-${i}`}
          style={{ gridArea: `slot${filledSlots.length + i}`, background: 'var(--app-bg)', borderRadius: '4px' }} />
      ))}
    </div>
  );
}
