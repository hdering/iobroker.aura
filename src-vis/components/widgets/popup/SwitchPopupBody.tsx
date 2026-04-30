import { Power } from 'lucide-react';
import { useDatapoint } from '../../../hooks/useDatapoint';
import { useIoBroker } from '../../../hooks/useIoBroker';
import { getWidgetIcon } from '../../../utils/widgetIconMap';
import type { WidgetConfig } from '../../../types';

interface Props {
  widget: WidgetConfig;
}

export function SwitchPopupBody({ widget }: Props) {
  const { value } = useDatapoint(widget.datapoint);
  const { setState } = useIoBroker();
  const o = widget.options ?? {};
  const isOn = Boolean(value);
  const momentary      = (o.momentary      as boolean) ?? false;
  const momentaryDelay = (o.momentaryDelay as number)  ?? 500;

  const toggle = () => {
    if (momentary) {
      setState(widget.datapoint, true);
      setTimeout(() => setState(widget.datapoint, false), momentaryDelay);
    } else {
      setState(widget.datapoint, !isOn);
    }
  };

  const WidgetIcon = getWidgetIcon(o.icon as string | undefined, Power);
  const green = 'var(--accent-green, #22c55e)';

  return (
    <div className="flex flex-col items-center gap-8 py-8 px-4">
      {/* Big tap-to-toggle button */}
      <button
        onClick={toggle}
        className="flex flex-col items-center justify-center gap-4 w-44 h-44 rounded-full transition-all duration-300 hover:opacity-90 active:scale-95"
        style={{
          background: isOn
            ? `radial-gradient(circle, color-mix(in srgb, ${green} 25%, transparent), color-mix(in srgb, ${green} 8%, transparent))`
            : 'var(--app-bg)',
          border: `3px solid ${isOn ? green : 'var(--app-border)'}`,
          boxShadow: isOn ? `0 0 32px ${green}44` : 'none',
        }}
      >
        <WidgetIcon
          size={52}
          style={{
            color: isOn ? green : 'var(--text-secondary)',
            filter: isOn ? `drop-shadow(0 0 8px ${green})` : 'none',
            transition: 'color 0.3s, filter 0.3s',
          }}
        />
        <span
          className="text-sm font-semibold tracking-wide"
          style={{ color: isOn ? green : 'var(--text-secondary)' }}
        >
          {isOn ? 'AN' : 'AUS'}
        </span>
      </button>

      {/* Secondary toggle row */}
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>AUS</span>
        <button
          onClick={toggle}
          className="relative w-14 h-7 rounded-full transition-colors duration-300"
          style={{ background: isOn ? green : 'var(--app-border)' }}
        >
          <span
            className="absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300"
            style={{ left: isOn ? '30px' : '4px' }}
          />
        </button>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>AN</span>
      </div>
    </div>
  );
}
