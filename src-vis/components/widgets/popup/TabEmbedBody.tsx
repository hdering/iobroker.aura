import { useCallback, useRef, useState } from 'react';
import ReactGridLayout from 'react-grid-layout';
import { AlertTriangle } from 'lucide-react';
import { usePopupConfigStore } from '../../../store/popupConfigStore';
import { useEffectiveSettings } from '../../../hooks/useEffectiveSettings';
import { getWidgetMap } from '../widgetMap';
import type { WidgetConfig } from '../../../types';

const DEFAULT_MARGIN = 10;

// ── {{dp}} substitution ───────────────────────────────────────────────────────

function sub(value: string, dp: string): string {
  if (!dp || !value.includes('{{dp}}')) return value;
  return value.replace(/\{\{dp\}\}/g, dp);
}

function substituteWidget(w: WidgetConfig, dp: string): WidgetConfig {
  if (!dp) return w;
  return {
    ...w,
    datapoint: sub(w.datapoint, dp),
    title: sub(w.title, dp),
    options: w.options
      ? Object.fromEntries(
          Object.entries(w.options).map(([k, v]) => [k, typeof v === 'string' ? sub(v, dp) : v]),
        )
      : w.options,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  viewId: string;
  triggerDp?: string;
}

export function TabEmbedBody({ viewId, triggerDp = '' }: Props) {
  const view = usePopupConfigStore((s) => s.views.find((v) => v.id === viewId));
  const settings = useEffectiveSettings();
  const cellSize = settings.gridRowHeight ?? 60;
  const snapX    = settings.gridSnapX ?? settings.gridRowHeight ?? 60;
  const MARGIN   = settings.gridGap ?? DEFAULT_MARGIN;

  const roRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const containerRefCallback = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  const cols = containerWidth > 0
    ? Math.max(2, Math.floor((containerWidth - MARGIN) / (snapX + MARGIN)))
    : 12;

  if (!view || view.widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 p-4" style={{ color: 'var(--text-secondary)' }}>
        <AlertTriangle size={24} style={{ color: 'var(--accent-red, #ef4444)' }} />
        <span className="text-sm">{view ? 'View ist leer' : 'View nicht gefunden'}</span>
        <span className="text-xs opacity-60 font-mono">{viewId}</span>
      </div>
    );
  }

  const wm = getWidgetMap();
  const widgets = view.widgets.map((w) => substituteWidget(w, triggerDp));

  const layout = widgets.map((w) => ({
    i: w.id,
    x: w.gridPos.x ?? 0,
    y: w.gridPos.y ?? 9999,
    w: w.gridPos.w ?? 4,
    h: w.gridPos.h ?? 3,
    minH: 1,
  }));

  return (
    <div ref={containerRefCallback} className="p-3" style={{ minWidth: 0 }}>
      {containerWidth > 0 && (
        <ReactGridLayout
          className="layout"
          layout={layout}
          cols={cols}
          rowHeight={cellSize}
          width={containerWidth}
          isDraggable={false}
          isResizable={false}
          margin={[MARGIN, MARGIN]}
          containerPadding={[0, 0]}
        >
          {widgets.map((w) => {
            const Widget = wm[w.type as keyof typeof wm];
            return (
              <div key={w.id}>
                {Widget ? (
                  <Widget config={w} editMode={false} onConfigChange={() => {}} />
                ) : (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs h-full"
                    style={{ background: 'var(--app-bg)', color: 'var(--text-secondary)', border: '1px solid var(--app-border)' }}
                  >
                    <AlertTriangle size={13} />
                    Unbekannter Typ: {w.type}
                  </div>
                )}
              </div>
            );
          })}
        </ReactGridLayout>
      )}
    </div>
  );
}
