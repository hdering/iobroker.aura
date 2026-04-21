import { useGlobalSettingsStore } from '../store/globalSettingsStore';

/** Apply configured DP name transformations (suffix removal, dot replacement). */
export function applyDpNameFilter(name: string): string {
  const { dpNameSuffixes, dpNameReplaceDots } = useGlobalSettingsStore.getState();
  let result = name;
  if (dpNameSuffixes) {
    const list = dpNameSuffixes.split(',').map(s => s.trim()).filter(Boolean);
    for (const suffix of list) {
      if (result.toLowerCase().endsWith(suffix.toLowerCase())) {
        result = result.slice(0, result.length - suffix.length).trimEnd();
      }
    }
  }
  if (dpNameReplaceDots) {
    result = result.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  }
  return result || name;
}
