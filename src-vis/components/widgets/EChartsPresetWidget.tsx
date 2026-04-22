import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BarChart2, Maximize2, X } from 'lucide-react';
import { getAuraBaseUrl } from '../../hooks/useIoBroker';
import type { WidgetProps } from '../../types';

export function EChartsPresetWidget({ config, editMode }: WidgetProps) {
  const opts     = config.options ?? {};
  const presetId = (opts.presetId as string)  ?? '';
  const darkMode = (opts.darkMode as boolean) ?? true;
  const manualBase = (opts.baseUrl as string | undefined)?.replace(/\/$/, '');

  const [autoBase, setAutoBase] = useState(window.location.origin);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!manualBase) getAuraBaseUrl().then(setAutoBase);
  }, [manualBase]);

  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFullscreen(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [fullscreen, closeFullscreen]);

  if (!presetId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2"
        style={{ color: 'var(--text-secondary)' }}>
        <BarChart2 size={28} strokeWidth={1.5} />
        <span className="text-xs">Kein Preset konfiguriert</span>
      </div>
    );
  }

  const baseUrl = manualBase ?? autoBase;
  const url = `${baseUrl}/echarts/index.html?preset=${encodeURIComponent(presetId)}${darkMode ? '&theme=dark' : ''}`;

  return (
    <>
      <div className="w-full h-full overflow-hidden relative" style={{ borderRadius: 'inherit' }}>
        <iframe
          src={url}
          title={config.title || 'eCharts'}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="fullscreen"
        />
        {config.title && (
          <div
            className="absolute top-0 left-0 right-0 px-3 py-1.5 text-xs font-medium pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)',
              color: '#fff',
              zIndex: 2,
            }}
          >
            {config.title}
          </div>
        )}
        {!editMode && (
          <button
            onClick={(e) => { e.stopPropagation(); setFullscreen(true); }}
            className="absolute bottom-2 right-2 p-1 rounded"
            style={{ background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: '#fff', lineHeight: 0, zIndex: 2 }}
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>

      {fullscreen && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9999, background: 'rgba(0,0,0,0.95)' }}
          onClick={closeFullscreen}
        >
          <button
            onClick={closeFullscreen}
            className="absolute top-3 right-3 p-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', color: '#fff', lineHeight: 0, zIndex: 1 }}
          >
            <X size={22} />
          </button>
          <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={url}
              title={config.title || 'eCharts'}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="fullscreen"
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
