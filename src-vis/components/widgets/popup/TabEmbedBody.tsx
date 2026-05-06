import { AlertTriangle } from 'lucide-react';
import type { WidgetConfig } from '../../../types';
import { useDashboardStore } from '../../../store/dashboardStore';
import { getWidgetMap } from '../widgetMap';

interface Props {
  tabId: string;
}

export function TabEmbedBody({ tabId }: Props) {
  const layouts = useDashboardStore((s) => s.layouts);

  let widgets: WidgetConfig[] = [];
  for (const layout of layouts) {
    const tab = layout.tabs.find((t) => t.id === tabId);
    if (tab) { widgets = tab.widgets; break; }
  }

  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2" style={{ color: 'var(--text-secondary)' }}>
        <AlertTriangle size={24} style={{ color: 'var(--accent-red, #ef4444)' }} />
        <span className="text-sm">View nicht gefunden oder leer</span>
        <span className="text-xs opacity-60 font-mono">{tabId}</span>
      </div>
    );
  }

  const wm = getWidgetMap();

  return (
    <div
      className="p-4 space-y-3 overflow-auto"
      style={{ width: 'min(90vw, 520px)', maxHeight: '70vh' }}
    >
      {widgets.map((w) => {
        const Widget = wm[w.type as keyof typeof wm];
        if (!Widget) {
          return (
            <div
              key={w.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'var(--app-bg)', color: 'var(--text-secondary)', border: '1px solid var(--app-border)' }}
            >
              <AlertTriangle size={13} />
              Unbekannter Typ: {w.type}
            </div>
          );
        }
        const embedConfig: WidgetConfig = { ...w, gridPos: { x: 0, y: 0, w: 6, h: 4 } };
        return (
          <div
            key={w.id}
            style={{
              background: 'var(--widget-bg, var(--app-surface))',
              border: '1px solid var(--app-border)',
              borderRadius: 'var(--widget-radius, 12px)',
              padding: 12,
              minHeight: 64,
            }}
          >
            {w.title && (
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                {w.title}
              </div>
            )}
            <Widget config={embedConfig} editMode={false} onConfigChange={() => {}} />
          </div>
        );
      })}
    </div>
  );
}
