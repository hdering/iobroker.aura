import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MonitorDot, Maximize2, X } from 'lucide-react';
import type { WidgetProps } from '../../types';

export function IframeWidget({ config }: WidgetProps) {
  const opts             = config.options ?? {};
  const url              = (opts.iframeUrl        as string)  ?? '';
  const keepAlive        = (opts.keepAlive         as boolean) ?? false;
  const allowInteraction = !!(opts.allowInteraction ?? true);
  const refreshSeconds   = (opts.refreshInterval   as number)  ?? 0;
  const sandboxEnabled   = (opts.sandbox           as boolean) ?? false;
  const fullscreenButton = (opts.fullscreenButton  as boolean) ?? false;

  const [tick, setTick]           = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!url || refreshSeconds < 1 || keepAlive) return;
    intervalRef.current = setInterval(() => setTick((n) => n + 1), refreshSeconds * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [url, refreshSeconds, keepAlive]);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2"
        style={{ color: 'var(--text-secondary)' }}>
        <MonitorDot size={32} strokeWidth={1} />
        <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
          {config.title || 'iFrame'}<br />
          <span className="text-[10px] opacity-60">Keine URL konfiguriert</span>
        </p>
      </div>
    );
  }

  // Stable key = never remount (keepAlive); incrementing key = reload on tick
  const iframeKey = keepAlive ? `ka-${url}` : `${url}-${tick}`;

  const sandboxAttr = sandboxEnabled
    ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation'
    : undefined;

  const showTitle = config.title && !config.options?.hideTitle;

  return (
    <div className="flex flex-col h-full">
      {showTitle && (
        <p className="text-xs truncate shrink-0 pb-1" style={{ color: 'var(--text-secondary)' }}>
          {config.title}
        </p>
      )}
      <div className="relative flex-1 overflow-hidden group" style={{ borderRadius: 'inherit' }}>
        <iframe
          key={iframeKey}
          src={url}
          sandbox={sandboxAttr}
          allow="autoplay; fullscreen; picture-in-picture; web-share"
          title={config.title || 'iFrame'}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
        {/* Interaction blocker – pointer-events overlay */}
        {!allowInteraction && (
          <div className="absolute inset-0 z-[1]" style={{ pointerEvents: 'all', cursor: 'default' }} />
        )}
        {/* Fullscreen button – shown on hover */}
        {fullscreenButton && (
          <button
            onClick={() => setFullscreen(true)}
            className="nodrag absolute top-1.5 right-1.5 z-[2] w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}
            title="Vollbild"
          >
            <Maximize2 size={13} />
          </button>
        )}
      </div>

      {/* Fullscreen overlay via portal so it escapes any overflow/transform parent */}
      {fullscreen && createPortal(
        <div
          className="fixed inset-0 flex flex-col"
          style={{ background: '#000', zIndex: 99999 }}
        >
          <iframe
            key={`fs-${iframeKey}`}
            src={url}
            sandbox={sandboxAttr}
            allow="autoplay; fullscreen; picture-in-picture; web-share"
            title={config.title || 'iFrame'}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block', flex: 1 }}
          />
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)', zIndex: 1 }}
            title="Vollbild beenden (Esc)"
          >
            <X size={18} />
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
