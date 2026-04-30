import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { WidgetConfig, ClickAction } from '../../../types';
import { usePortalTarget } from '../../../contexts/PortalTargetContext';
import { DimmerPopupBody } from './DimmerPopupBody';
import { ThermostatPopupBody } from './ThermostatPopupBody';
import { ImagePopupBody } from './ImagePopupBody';
import { IframePopupBody } from './IframePopupBody';
import { JsonPopupBody } from './JsonPopupBody';
import { HtmlPopupBody } from './HtmlPopupBody';
import { WidgetEmbedBody } from './WidgetEmbedBody';

interface Props {
  widget: WidgetConfig;
  action: ClickAction;
  onClose: () => void;
  allWidgets?: WidgetConfig[];
}

function getTitle(widget: WidgetConfig, action: ClickAction): string {
  const custom = widget.options?.popupTitle as string | undefined;
  if (custom) return custom;
  if (widget.title) return widget.title;
  switch (action.kind) {
    case 'popup-dimmer':     return 'Dimmer';
    case 'popup-thermostat': return 'Thermostat';
    case 'popup-image':      return 'Bild';
    case 'popup-iframe':     return 'Webseite';
    case 'popup-json':       return 'JSON';
    case 'popup-html':       return 'HTML';
    case 'popup-widget':     return 'Widget';
    default:                 return '';
  }
}

export function WidgetClickPopup({ widget, action, onClose, allWidgets = [] }: Props) {
  const portalTarget = usePortalTarget();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isIframe = action.kind === 'popup-iframe';
  const title = getTitle(widget, action);

  const body = (() => {
    switch (action.kind) {
      case 'popup-dimmer':
        return <DimmerPopupBody widget={widget} />;
      case 'popup-thermostat':
        return <ThermostatPopupBody widget={widget} action={action} />;
      case 'popup-image':
        return <ImagePopupBody action={action} />;
      case 'popup-iframe':
        return <IframePopupBody action={action} />;
      case 'popup-json':
        return <JsonPopupBody action={action} />;
      case 'popup-html':
        return <HtmlPopupBody action={action} />;
      case 'popup-widget':
        return <WidgetEmbedBody widget={widget} action={action} allWidgets={allWidgets} />;
      default:
        return null;
    }
  })();

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-[300] p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          maxWidth: isIframe ? undefined : 'min(90vw, 600px)',
          width: isIframe ? undefined : '100%',
          maxHeight: isIframe ? undefined : '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--app-border)' }}
        >
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {title}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)', background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto" style={{ flex: isIframe ? 'none' : '1 1 auto' }}>
          {body}
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
