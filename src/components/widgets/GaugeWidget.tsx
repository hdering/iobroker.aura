import { useDatapoint } from '../../hooks/useDatapoint';
import type { WidgetProps } from '../../types';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start    = polarToCartesian(cx, cy, r, startAngle);
  const end      = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function valueToAngle(value: number, min: number, max: number): number {
  if (max <= min) return -180;
  const clamped = Math.max(min, Math.min(max, value));
  return -180 + ((clamped - min) / (max - min)) * 180;
}

export interface PointerDef {
  value: number;
  color: string;
  label?: string;
}

interface GaugeSVGProps {
  pointers: PointerDef[];   // [0] = primary
  min: number;
  max: number;
  unit: string;
  decimals: number;
  strokeWidth: number;
  colorZones: boolean;
  zone1Max: number;
  zone2Max: number;
  zone1Color: string;
  zone2Color: string;
  zone3Color: string;
  showMinMax: boolean;
  scale?: number;
}

function GaugeSVG({
  pointers, min, max, unit, decimals, strokeWidth,
  colorZones, zone1Max, zone2Max, zone1Color, zone2Color, zone3Color,
  showMinMax, scale = 1,
}: GaugeSVGProps) {
  const cx = 100, cy = 100, r = 80;
  const primary = pointers[0];

  const zone1Angle = valueToAngle(zone1Max, min, max);
  const zone2Angle = valueToAngle(zone2Max, min, max);

  // Primary pointer color (zone-based or fixed)
  let primaryColor = primary.color;
  if (colorZones) {
    if (primary.value <= zone1Max)      primaryColor = zone1Color;
    else if (primary.value <= zone2Max) primaryColor = zone2Color;
    else                                primaryColor = zone3Color;
  }

  const displayVal = isNaN(primary.value)
    ? '–'
    : decimals === 0
      ? String(Math.round(primary.value))
      : primary.value.toFixed(decimals);

  // Needle lengths: primary longest, secondary progressively shorter
  const needleLengths = [r - 8, r - 16, r - 24];

  return (
    <svg viewBox="0 0 200 120" style={{ width: 200 * scale, height: 120 * scale, display: 'block' }}>
      {/* Background track */}
      <path d={describeArc(cx, cy, r, -180, 0)} fill="none"
        stroke="var(--app-border)" strokeWidth={strokeWidth} strokeLinecap="round" />

      {/* Color zone arcs */}
      {colorZones ? (
        <>
          <path d={describeArc(cx, cy, r, -180, zone1Angle)} fill="none" stroke={zone1Color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d={describeArc(cx, cy, r, zone1Angle, zone2Angle)} fill="none" stroke={zone2Color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d={describeArc(cx, cy, r, zone2Angle, 0)} fill="none" stroke={zone3Color} strokeWidth={strokeWidth} strokeLinecap="round" />
          {/* Primary value overlay */}
          <path d={describeArc(cx, cy, r, -180, valueToAngle(primary.value, min, max))}
            fill="none" stroke={primaryColor} strokeWidth={strokeWidth + 2} strokeLinecap="round" opacity="0.4" />
        </>
      ) : (
        <path d={describeArc(cx, cy, r, -180, valueToAngle(primary.value, min, max))}
          fill="none" stroke={primaryColor} strokeWidth={strokeWidth} strokeLinecap="round" />
      )}

      {/* Needles (render from last to first so primary is on top) */}
      {[...pointers].reverse().map((ptr, revIdx) => {
        const idx       = pointers.length - 1 - revIdx;
        const angle     = valueToAngle(ptr.value, min, max);
        const len       = needleLengths[Math.min(idx, needleLengths.length - 1)];
        const tip       = polarToCartesian(cx, cy, len, angle);
        const sw        = idx === 0 ? 2.5 : idx === 1 ? 2.0 : 1.5;
        const color     = idx === 0 ? primaryColor : ptr.color;
        return (
          <line key={idx}
            x1={cx} y1={cy} x2={tip.x} y2={tip.y}
            stroke={color} strokeWidth={sw} strokeLinecap="round" />
        );
      })}

      {/* Center circle (primary color) */}
      <circle cx={cx} cy={cy} r={5} fill={primaryColor} />

      {/* Primary value text */}
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={22} fontWeight="bold" fill="var(--text-primary)">
        {displayVal}{unit && <tspan fontSize={13} fill="var(--text-secondary)" dx={2}>{unit}</tspan>}
      </text>

      {/* Min/Max labels */}
      {showMinMax && (() => {
        const minPt = polarToCartesian(cx, cy, r + 14, -180);
        const maxPt = polarToCartesian(cx, cy, r + 14,    0);
        return (
          <>
            <text x={minPt.x + 2} y={minPt.y + 4} fontSize={9} fill="var(--text-secondary)" textAnchor="start">{min}</text>
            <text x={maxPt.x - 2} y={maxPt.y + 4} fontSize={9} fill="var(--text-secondary)" textAnchor="end">{max}</text>
          </>
        );
      })()}
    </svg>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export function GaugeWidget({ config }: WidgetProps) {
  const opts   = config.options ?? {};
  const layout = config.layout ?? 'default';

  // Primary datapoint
  const { value }    = useDatapoint(config.datapoint);

  // Dynamic min/max datapoints
  const minDp        = (opts.minDatapoint as string) ?? '';
  const maxDp        = (opts.maxDatapoint as string) ?? '';
  const { value: minDpVal } = useDatapoint(minDp);
  const { value: maxDpVal } = useDatapoint(maxDp);

  // Pointer 2 & 3
  const ptr2Dp    = (opts.pointer2Datapoint as string) ?? '';
  const ptr3Dp    = (opts.pointer3Datapoint as string) ?? '';
  const { value: val2 } = useDatapoint(ptr2Dp);
  const { value: val3 } = useDatapoint(ptr3Dp);

  const staticMin = (opts.minValue    as number) ?? 0;
  const staticMax = (opts.maxValue    as number) ?? 100;

  const resolvedMin = minDp && minDpVal !== undefined && minDpVal !== null
    ? parseFloat(String(minDpVal)) : staticMin;
  const resolvedMax = maxDp && maxDpVal !== undefined && maxDpVal !== null
    ? parseFloat(String(maxDpVal)) : staticMax;

  const unit        = (opts.unit        as string)  ?? '';
  const decimals    = (opts.decimals    as number)  ?? 1;
  const strokeWidth = (opts.strokeWidth as number)  ?? 12;
  const colorZones  = (opts.colorZones  as boolean) ?? false;
  const showMinMax  = (opts.showMinMax  as boolean) ?? true;

  const numVal  = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
  const safeVal = isNaN(numVal) ? resolvedMin : numVal;

  const dynamicMaxEnabled = !!(opts.dynamicMax);
  const effectiveMax = dynamicMaxEnabled ? Math.max(resolvedMax, safeVal) : resolvedMax;
  const effectiveMin = resolvedMin;
  const range        = effectiveMax - effectiveMin;

  // Zone thresholds
  const zone1Max = (opts.zone1Max as number) ?? effectiveMin + range * 0.33;
  const zone2Max = (opts.zone2Max as number) ?? effectiveMin + range * 0.66;

  // Zone colors (user-defined or defaults)
  const zone1Color = (opts.zone1Color as string) ?? '#10b981';
  const zone2Color = (opts.zone2Color as string) ?? '#f59e0b';
  const zone3Color = (opts.zone3Color as string) ?? '#ef4444';

  // Build pointers array
  const ptr1Color = (opts.pointer1Color as string) ?? 'var(--accent)';
  const pointers: PointerDef[] = [
    { value: safeVal, color: ptr1Color, label: (opts.pointer1Label as string) || config.title || undefined },
  ];
  if (ptr2Dp) {
    const v = parseFloat(String(val2 ?? 0));
    pointers.push({
      value: isNaN(v) ? effectiveMin : v,
      color: (opts.pointer2Color as string) ?? '#f97316',
      label: (opts.pointer2Label as string) || undefined,
    });
  }
  if (ptr3Dp) {
    const v = parseFloat(String(val3 ?? 0));
    pointers.push({
      value: isNaN(v) ? effectiveMin : v,
      color: (opts.pointer3Color as string) ?? '#8b5cf6',
      label: (opts.pointer3Label as string) || undefined,
    });
  }

  const gaugeProps: GaugeSVGProps = {
    pointers, min: effectiveMin, max: effectiveMax,
    unit, decimals, strokeWidth, colorZones,
    zone1Max, zone2Max, zone1Color, zone2Color, zone3Color, showMinMax,
  };

  // Secondary pointer badges (rendered as HTML below SVG)
  const secondaryBadges = pointers.slice(1).map((ptr, i) => {
    const dispVal = isNaN(ptr.value)
      ? '–'
      : decimals === 0 ? String(Math.round(ptr.value)) : ptr.value.toFixed(decimals);
    return (
      <span
        key={i}
        className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
        style={{ background: `${ptr.color}22`, color: ptr.color, border: `1px solid ${ptr.color}55` }}
      >
        <span className="font-bold tabular-nums">{dispVal}{unit}</span>
        {ptr.label && <span className="opacity-80">{ptr.label}</span>}
      </span>
    );
  });

  // ── MINIMAL ──────────────────────────────────────────────────────────────
  if (layout === 'minimal') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <GaugeSVG {...gaugeProps} scale={0.85} />
        {secondaryBadges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">{secondaryBadges}</div>
        )}
      </div>
    );
  }

  // ── COMPACT ───────────────────────────────────────────────────────────────
  if (layout === 'compact') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <GaugeSVG {...gaugeProps} scale={0.7} />
        {config.title && (
          <p className="text-[11px] truncate text-center" style={{ color: 'var(--text-secondary)' }}>{config.title}</p>
        )}
        {secondaryBadges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">{secondaryBadges}</div>
        )}
      </div>
    );
  }

  // ── DEFAULT / CARD ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {config.title && (
        <p className="text-xs mb-1 truncate" style={{ color: 'var(--text-secondary)' }}>{config.title}</p>
      )}
      <div className="flex-1 flex items-center justify-center">
        <GaugeSVG {...gaugeProps} scale={layout === 'card' ? 1 : 0.95} />
      </div>
      {secondaryBadges.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 pb-1 shrink-0">{secondaryBadges}</div>
      )}
    </div>
  );
}
