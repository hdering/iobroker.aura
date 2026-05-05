import { useLayoutSetting } from '../shared/useLayoutSetting';
import { SliderSetting } from '../shared/SliderSetting';
import { LayoutContextSwitcher } from '../shared/LayoutContextSwitcher';

interface GuidelinesSectionProps {
  contextId: string | null;
  onContextChange: (id: string | null) => void;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none shrink-0"
      style={{ background: value ? 'var(--accent-green)' : 'var(--app-border)' }}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

export function GuidelinesSection({ contextId, onContextChange }: GuidelinesSectionProps) {
  const { eff, set, clear } = useLayoutSetting(contextId);

  const [w, wOv]             = eff('guidelinesWidth');
  const [h, hOv]             = eff('guidelinesHeight');
  const [showFe, showFeOv]   = eff('guidelinesShowInFrontend');
  const [enabled, enabledOv] = eff('guidelinesEnabled');

  const effectiveW       = (w ?? 1280) as number;
  const effectiveH       = (h ?? 800) as number;
  const effectiveShowFe  = (showFe ?? false) as boolean;
  const effectiveEnabled = (enabled ?? false) as boolean;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Hilfslinien</p>
      <div className="pb-2 mb-1 border-b" style={{ borderColor: 'var(--app-border)' }}>
        <LayoutContextSwitcher selectedId={contextId} onChange={onContextChange} />
      </div>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Zeigt rote gestrichelte Linien im Editor (und optional im Frontend) zur Orientierung bei der Layout-Planung für ein Zielgerät.
      </p>

      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Aktiv</p>
            {enabledOv && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                Layout
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {enabledOv && contextId && (
              <button onClick={() => clear('guidelinesEnabled')} className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                ↩ Global
              </button>
            )}
            <Toggle value={effectiveEnabled} onChange={(v) => set('guidelinesEnabled', v)} />
          </div>
        </div>
      </div>

      <SliderSetting
        label="Breite"
        value={effectiveW}
        min={320} max={3840} step={10} unit=" px"
        onChange={(v) => set('guidelinesWidth', v)}
        isOverridden={wOv}
        onClearOverride={() => clear('guidelinesWidth')}
        presets={[{ label: '768', value: 768 }, { label: '1024', value: 1024 }, { label: '1280', value: 1280 }, { label: '1920', value: 1920 }]}
      />

      <div className="border-t pt-3" style={{ borderColor: 'var(--app-border)' }}>
        <SliderSetting
          label="Höhe"
          value={effectiveH}
          min={320} max={2160} step={10} unit=" px"
          onChange={(v) => set('guidelinesHeight', v)}
          isOverridden={hOv}
          onClearOverride={() => clear('guidelinesHeight')}
          presets={[{ label: '600', value: 600 }, { label: '768', value: 768 }, { label: '800', value: 800 }, { label: '1024', value: 1024 }, { label: '1080', value: 1080 }]}
        />
      </div>

      <div className="border-t pt-3" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-1.5">
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Im Frontend anzeigen</p>
            {showFeOv && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                Layout
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {showFeOv && contextId && (
              <button onClick={() => clear('guidelinesShowInFrontend')} className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
                ↩ Global
              </button>
            )}
            <Toggle value={effectiveShowFe} onChange={(v) => set('guidelinesShowInFrontend', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}
