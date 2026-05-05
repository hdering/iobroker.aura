import { useDashboardStore } from '../../../../store/dashboardStore';
import { useT } from '../../../../i18n';

interface ContextPickerStripProps {
  contextId: string | null;
  onChange: (id: string | null) => void;
}

export function ContextPickerStrip({ contextId, onChange }: ContextPickerStripProps) {
  const t = useT();
  const layouts = useDashboardStore((s) => s.layouts);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--text-secondary)' }}>{t('layouts.context.label')}:</span>
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => onChange(null)}
          className="px-3 py-1 rounded-lg text-xs font-medium hover:opacity-80 transition-colors"
          style={{
            background: contextId === null ? 'var(--accent)' : 'var(--app-bg)',
            color: contextId === null ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${contextId === null ? 'var(--accent)' : 'var(--app-border)'}`,
          }}
        >
          {t('layouts.context.global')}
        </button>
        {layouts.map((l) => (
          <button
            key={l.id}
            onClick={() => onChange(l.id)}
            className="px-3 py-1 rounded-lg text-xs font-medium hover:opacity-80 transition-colors"
            style={{
              background: contextId === l.id ? 'var(--accent)' : 'var(--app-bg)',
              color: contextId === l.id ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${contextId === l.id ? 'var(--accent)' : 'var(--app-border)'}`,
            }}
          >
            {l.name}
          </button>
        ))}
      </div>
    </div>
  );
}
