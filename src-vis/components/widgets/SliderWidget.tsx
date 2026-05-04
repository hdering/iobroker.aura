import { useState, type CSSProperties } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useDatapoint } from '../../hooks/useDatapoint';
import { useIoBroker } from '../../hooks/useIoBroker';
import type { WidgetProps, CustomGrid } from '../../types';
import { getWidgetIcon } from '../../utils/widgetIconMap';
import { CustomGridView } from './CustomGridView';
import { StatusBadges } from './StatusBadges';
import { useStatusFields } from '../../hooks/useStatusFields';

type SliderAction = {
  id: string;
  icon: string;
  label?: string;
  dp: string;
  value?: string | number | boolean;
};

export const DEFAULT_SLIDER_GRID: CustomGrid = [
  { type: 'title',     fontSize: 14, bold: true,        align: 'left',   valign: 'top'    },
  { type: 'empty' },
  { type: 'field',     fieldKey: 'value',                align: 'right',  valign: 'top'    },
  { type: 'component', componentKey: 'slider',           align: 'center', valign: 'middle' },
  { type: 'empty' },
  { type: 'empty' },
  { type: 'component', componentKey: 'actions',          align: 'left',   valign: 'bottom' },
  { type: 'empty' },
  { type: 'component', componentKey: 'status-badges',    align: 'right',  valign: 'bottom' },
];

export function SliderWidget({ config }: WidgetProps) {
  const o      = config.options ?? {};
  const layout = config.layout ?? 'default';
  const { setState } = useIoBroker();

  const min             = (o.min  as number) ?? 0;
  const max             = (o.max  as number) ?? 100;
  const step            = (o.step as number) ?? 1;
  const isVertical      = (o.orientation as string) === 'vertical';
  const sliderColor     = (o.color as string) || 'var(--accent)';
  const commitOnRelease = !!o.commitOnRelease;
  const unit            = (o.unit as string) ?? '';
  const showValue       = o.showValue  !== false;
  const showUnit        = o.showUnit   !== false;
  const showMinMax      = !!o.showMinMax;
  const actions         = (o.actions as SliderAction[] | undefined) ?? [];

  const { value: rawVal } = useDatapoint(config.datapoint);
  const numericVal = typeof rawVal === 'number' ? rawVal
    : Number.isFinite(Number(rawVal)) ? Number(rawVal) : min;

  const [pending, setPending] = useState<number | null>(null);
  const displayVal = pending ?? numericVal;

  const writeStepped = (v: number) => {
    const stepped = Math.round(v / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    setState(config.datapoint, clamped);
  };

  const onSliderChange = (v: number) => {
    if (commitOnRelease) setPending(v);
    else writeStepped(v);
  };

  const onSliderRelease = () => {
    if (commitOnRelease && pending != null) {
      writeStepped(pending);
      setPending(null);
    }
  };

  const triggerAction = (a: SliderAction) => {
    if (!a.dp) return;
    setState(a.dp, a.value !== undefined ? a.value : true);
  };

  const { battery, reach, batteryIcon, reachIcon, statusBadges } = useStatusFields(config);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vertAttrs: any = isVertical ? { orient: 'vertical' } : {};

  const sliderEl = (
    <input
      {...vertAttrs}
      type="range"
      min={min}
      max={max}
      step={step}
      value={displayVal}
      onChange={(e) => onSliderChange(Number(e.target.value))}
      onMouseUp={onSliderRelease}
      onTouchEnd={onSliderRelease}
      onKeyUp={onSliderRelease}
      style={{
        '--slider-thumb-color': sliderColor,
        ...(isVertical
          ? { writingMode: 'vertical-lr' as React.CSSProperties['writingMode'], direction: 'rtl', height: '100%', width: 'auto' }
          : { width: '100%' }),
      } as unknown as CSSProperties}
      className="nodrag h-1.5 rounded-full appearance-none cursor-pointer"
    />
  );

  const actionsEl = actions.length > 0 ? (
    <div className="nodrag flex items-center gap-1 flex-wrap">
      {actions.map((a) => {
        const Icon = getWidgetIcon(a.icon, SlidersHorizontal);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => triggerAction(a)}
            title={a.label ?? a.icon}
            className="nodrag p-1.5 rounded-full hover:opacity-80 transition-opacity"
            style={{ background: 'var(--app-bg)', color: 'var(--text-secondary)', border: '1px solid var(--app-border)' }}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  ) : null;

  const valueStr = `${displayVal}${showUnit && unit ? unit : ''}`;

  if (layout === 'custom') {
    const customGrid = (o.customGrid as CustomGrid | undefined) ?? DEFAULT_SLIDER_GRID;
    return (
      <CustomGridView
        config={{ ...config, options: { ...o, customGrid } }}
        value={valueStr}
        extraFields={{ value: String(displayVal), unit, min: String(min), max: String(max), battery, reach }}
        extraComponents={{
          slider:          sliderEl,
          actions:         actionsEl,
          'battery-icon':  batteryIcon,
          'reach-icon':    reachIcon,
          'status-badges': statusBadges,
        }}
      />
    );
  }

  if (isVertical) {
    return (
      <div className="flex flex-col h-full items-center gap-1" style={{ position: 'relative' }}>
        {showValue && (
          <p className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>{valueStr}</p>
        )}
        {showMinMax && <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{max}</span>}
        <div className="flex-1 flex items-center justify-center min-h-0">
          {sliderEl}
        </div>
        {showMinMax && <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{min}</span>}
        {actionsEl}
        <StatusBadges config={config} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2" style={{ position: 'relative' }}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{config.title}</p>
        {showValue && (
          <p className="text-base font-semibold shrink-0 ml-2" style={{ color: 'var(--text-primary)' }}>{valueStr}</p>
        )}
      </div>
      <div className="flex-1 flex items-center gap-2 min-h-0">
        {showMinMax && <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{min}</span>}
        <div className="flex-1">{sliderEl}</div>
        {showMinMax && <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{max}</span>}
      </div>
      {actionsEl}
      <StatusBadges config={config} />
    </div>
  );
}
