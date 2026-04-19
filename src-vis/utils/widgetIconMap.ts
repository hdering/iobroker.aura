/**
 * Widget icon resolution – handles both legacy PascalCase Lucide names and
 * full Iconify IDs (e.g. "mdi:garage", "lucide:zap").
 *
 * Returns a React component compatible with the LucideIcon signature
 * (accepts `size`, `style`, `className`), so all existing call sites work
 * without modification.
 */
import React from 'react';
import { Icon } from '@iconify/react';
import { lucidePascalToIconify } from './iconifyLoader';
import type { LucideIcon } from 'lucide-react';

/** Wrap an Iconify icon ID into a component that mimics the LucideIcon API */
function makeIconComponent(iconId: string): LucideIcon {
  function IconifyWrapper({
    size = 16,
    style,
    className,
  }: {
    size?: number;
    style?: React.CSSProperties;
    className?: string;
  }) {
    return React.createElement(Icon, { icon: iconId, width: size, height: size, style, className });
  }
  return IconifyWrapper as unknown as LucideIcon;
}

/** Resolve a stored icon name/ID to a render-ready component.
 *  - Iconify ID (contains ":") → used directly
 *  - PascalCase legacy name (e.g. "ZapOff") → converted to "lucide:zap-off"
 *  - Empty / undefined → returns the fallback Lucide component unchanged */
export function getWidgetIcon(name: string | undefined, fallback: LucideIcon): LucideIcon {
  if (!name) return fallback;
  const iconId = name.includes(':') ? name : lucidePascalToIconify(name);
  return makeIconComponent(iconId);
}

/** Curated list of Iconify IDs for the inline tab/widget icon picker.
 *  Covers the most common home-automation use cases. */
export const CURATED_ICON_IDS: string[] = [
  // Home & rooms
  'lucide:home','lucide:sofa','lucide:bed-double','lucide:bath','lucide:cooking-pot',
  'lucide:tree-pine','mdi:garage','mdi:garage-open','mdi:door-closed','mdi:door',
  // Lights & switches
  'lucide:lightbulb','lucide:lightbulb-off','lucide:lamp','lucide:sun','lucide:moon',
  'lucide:toggle-right','lucide:plug','lucide:zap','lucide:power',
  // Climate
  'lucide:thermometer','lucide:flame','lucide:snowflake','lucide:wind','lucide:droplets',
  'lucide:fan','mdi:radiator','mdi:heat-pump','mdi:air-conditioner',
  // Security
  'lucide:lock','lucide:lock-open','lucide:shield','lucide:bell','lucide:eye',
  'mdi:motion-sensor','mdi:smoke-detector','mdi:alarm',
  // Energy
  'lucide:battery','lucide:gauge','mdi:solar-panel','mdi:lightning-bolt','mdi:meter-electric',
  // Transport / Garage
  'lucide:car','mdi:car-electric','mdi:car-key',
  // Media
  'lucide:tv','lucide:speaker','lucide:music','lucide:volume-2',
  // Misc
  'lucide:star','lucide:heart','lucide:activity','lucide:bar-chart-2','lucide:calendar-days',
  'lucide:clock','lucide:settings','lucide:layers-2','lucide:cloud','lucide:wifi',
];
