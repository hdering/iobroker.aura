import { BarChart2 } from 'lucide-react';
import type { WidgetProps } from '../../types';

export function EChartsPresetWidget({ config }: WidgetProps) {
  const opts     = config.options ?? {};
  const presetId = (opts.presetId as string)  ?? '';
  const darkMode = (opts.darkMode as boolean) ?? true;

  if (!presetId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2"
        style={{ color: 'var(--text-secondary)' }}>
        <BarChart2 size={28} strokeWidth={1.5} />
        <span className="text-xs">Kein Preset konfiguriert</span>
      </div>
    );
  }

  // Admin serves eCharts at /adapter/echarts/chart/index.html,
  // web adapter serves it at /echarts/index.html
  const echartsPath = window.location.pathname.startsWith('/adapter/')
    ? '/adapter/echarts/chart/index.html'
    : '/echarts/index.html';
  const url = `${window.location.origin}${echartsPath}?preset=${encodeURIComponent(presetId)}${darkMode ? '&theme=dark' : ''}`;

  return (
    <div className="w-full h-full overflow-hidden" style={{ borderRadius: 'inherit' }}>
      <iframe
        src={url}
        title={config.title || 'eCharts'}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="fullscreen"
      />
    </div>
  );
}
