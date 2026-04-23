import { useDatapoint } from './useDatapoint';
import type { WidgetConfig } from '../types';

function matchesValues(value: unknown, valList: string): boolean {
  if (!valList.trim()) return false;
  const str = String(value ?? '').toLowerCase().trim();
  return valList.split(',').map(v => v.trim().toLowerCase()).filter(Boolean).some(v => v === str);
}

/**
 * Computes human-readable battery and reach strings for use in custom grid extraFields.
 * Reads the same options as StatusBadges: batteryDp, batteryMode, batteryInvert,
 * batteryLowThreshold, unreachDp, reachMode, reachTrueValues.
 */
export function useStatusFields(config: WidgetConfig): { battery: string; reach: string } {
  const opts = config.options ?? {};

  const battDpId  = (opts.batteryDp as string) ?? '';
  const reachDpId = (opts.unreachDp as string) ?? '';
  const { value: battRaw  } = useDatapoint(battDpId);
  const { value: reachRaw } = useDatapoint(reachDpId);

  // Battery
  const battMode      = (opts.batteryMode as 'percent' | 'boolean') ?? 'boolean';
  const battInvert    = opts.batteryInvert === true;
  let battery = '';
  if (battDpId) {
    if (battMode === 'percent') {
      const num = typeof battRaw === 'number' ? battRaw : parseFloat(String(battRaw ?? ''));
      battery = isNaN(num) ? '–' : `${Math.round(num)}%`;
    } else {
      const low = matchesValues(battRaw, 'true,1');
      battery = (battInvert ? !low : low) ? 'Niedrig' : 'OK';
    }
  }

  // Reach
  const reachMode       = (opts.reachMode as 'unreachable' | 'available') ?? 'unreachable';
  const reachTrueValues = (opts.reachTrueValues as string) ?? 'true,1';
  let reach = '';
  if (reachDpId) {
    const rawBool   = matchesValues(reachRaw, reachTrueValues);
    const isUnreach = reachMode === 'unreachable' ? rawBool : !rawBool;
    reach = isUnreach ? 'Nicht erreichbar' : 'Erreichbar';
  }

  return { battery, reach };
}
