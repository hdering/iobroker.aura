import { useT } from '../../i18n';

export function ConfirmOverlay({
  text,
  onConfirm,
  onCancel,
}: {
  text?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-widget z-10"
      style={{ background: 'color-mix(in srgb, var(--app-card) 92%, transparent)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs text-center px-3 font-medium" style={{ color: 'var(--text-primary)' }}>
        {text || t('widget.confirm.defaultPrompt')}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="px-3 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
        >
          {t('common.yes')}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--app-bg)', color: 'var(--text-secondary)', border: '1px solid var(--app-border)' }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
