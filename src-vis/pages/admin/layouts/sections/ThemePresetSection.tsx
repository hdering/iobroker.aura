import { useThemeStore } from '../../../../store/themeStore';
import { useDashboardStore } from '../../../../store/dashboardStore';
import { THEMES } from '../../../../themes';
import { LayoutContextSwitcher } from '../shared/LayoutContextSwitcher';
import { useT } from '../../../../i18n';

interface ThemePresetSectionProps {
  contextId: string | null;
  onContextChange: (id: string | null) => void;
}

export function ThemePresetSection({ contextId, onContextChange }: ThemePresetSectionProps) {
  const t = useT();
  const { themeId, setTheme, resetCustom } = useThemeStore();
  const layouts = useDashboardStore((s) => s.layouts);
  const updateLayoutSettings = useDashboardStore((s) => s.updateLayoutSettings);
  const clearLayoutSettings  = useDashboardStore((s) => s.clearLayoutSettings);

  const ls = contextId ? layouts.find((l) => l.id === contextId)?.settings : undefined;
  const effectiveThemeId = ls?.themeId ?? themeId;

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('theme.preset.title')}</h2>
        <LayoutContextSwitcher selectedId={contextId} onChange={onContextChange} />
      </div>
      {contextId && (
        <p className="text-xs mb-3 px-2 py-1 rounded" style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}>
          Theme-Auswahl und CSS-Variablen für dieses Layout überschreiben — das globale Theme bleibt unberührt.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => {
              if (!contextId) { setTheme(theme.id); resetCustom(); }
              else updateLayoutSettings(contextId, { themeId: theme.id, customVars: undefined });
            }}
            className="rounded-xl p-4 text-left transition-opacity hover:opacity-80 space-y-3"
            style={{
              background: theme.vars['--app-surface'],
              border: `2px solid ${effectiveThemeId === theme.id ? 'var(--accent)' : theme.vars['--app-border']}`,
            }}
          >
            <div className="flex gap-1.5">
              {(['--widget-bg', '--accent', '--accent-green', '--accent-yellow'] as const).map((k) => (
                <div key={k} className="w-4 h-4 rounded-full" style={{ background: theme.vars[k], border: `1px solid ${theme.vars['--app-border']}` }} />
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: theme.vars['--text-primary'] }}>{theme.name}</p>
              {effectiveThemeId === theme.id && <p className="text-xs mt-0.5" style={{ color: theme.vars['--accent'] }}>{t('theme.preset.active')}</p>}
            </div>
          </button>
        ))}
      </div>
      {contextId && ls?.themeId && (
        <button
          onClick={() => clearLayoutSettings(contextId, 'themeId')}
          className="mt-3 text-xs hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          ↩ Auf Global zurücksetzen
        </button>
      )}
    </div>
  );
}
