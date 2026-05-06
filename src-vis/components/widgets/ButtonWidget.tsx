import type { WidgetProps } from '../../types';
import { getWidgetIcon } from '../../utils/widgetIconMap';
import { MousePointerClick } from 'lucide-react';
import { contentPositionClass } from '../../utils/widgetUtils';

export function ButtonWidget({ config }: WidgetProps) {
  const o = config.options ?? {};
  const label    = (o.buttonLabel as string) || config.title || 'Button';
  const color    = (o.buttonColor as string) || 'var(--accent)';
  const iconSize = (o.iconSize    as number) || 28;
  const layout   = config.layout ?? 'default';

  const WidgetIcon = getWidgetIcon(o.icon as string | undefined, MousePointerClick);

  if (layout === 'compact') {
    return (
      <div className="flex items-center gap-2.5 h-full px-1">
        <WidgetIcon size={18} style={{ color, flexShrink: 0 }} />
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-secondary)' }}>›</span>
      </div>
    );
  }

  if (layout === 'minimal') {
    return (
      <div className="flex items-center justify-center h-full">
        <WidgetIcon size={iconSize} style={{ color }} />
      </div>
    );
  }

  // default / card — centered icon + label
  const posClass = contentPositionClass(o.contentPosition as string | undefined);
  return (
    <div className={`flex flex-col gap-2 h-full ${posClass}`}>
      <WidgetIcon size={iconSize} style={{ color }} />
      <span className="text-sm font-medium text-center leading-tight" style={{ color: 'var(--text-primary)' }}>
        {label}
      </span>
    </div>
  );
}
