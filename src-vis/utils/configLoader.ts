/**
 * Loads config from separate ioBroker states in parallel.
 * Handles migration from the old single-blob format automatically.
 *
 * Old format: aura.0.config.dashboard contained all keys nested:
 *   { "aura-dashboard": "...", "aura-theme": "...", ... }
 * New format: each key has its own state (aura.0.config.theme etc.)
 */
import { getStateDirect, setStateDirect } from '../hooks/useIoBroker';
import { IOBROKER_STATE_MAP, type SyncStoreKey } from '../store/persistManager';
import { hydrateGroupDefs } from '../store/groupDefsStore';
import { useDashboardStore } from '../store/dashboardStore';
import { useThemeStore } from '../store/themeStore';
import { useGroupStore } from '../store/groupStore';
import { useConfigStore } from '../store/configStore';
import { useGlobalSettingsStore } from '../store/globalSettingsStore';
import { usePopupConfigStore } from '../store/popupConfigStore';

type StoreKey = SyncStoreKey | 'aura-global-settings';

/** Apply a raw JSON string for a given key to localStorage + store. */
export function applyRaw(key: StoreKey, raw: string): void {
  if (key === 'aura-group-defs') { hydrateGroupDefs(raw); return; }
  try { localStorage.setItem(key, raw); } catch { /* quota — in-memory only */ }
}

/** Rehydrate all stores from localStorage / in-memory state. */
export function rehydrateAll(includeGlobalSettings = true): void {
  useDashboardStore.persist.rehydrate();
  useThemeStore.persist.rehydrate();
  useGroupStore.persist.rehydrate();
  useConfigStore.persist.rehydrate();
  usePopupConfigStore.persist.rehydrate();
  if (includeGlobalSettings) useGlobalSettingsStore.persist.rehydrate();
}

/**
 * Load all config states from ioBroker in parallel.
 * Returns true if any store was updated.
 * Automatically migrates from old single-blob format.
 */
export async function loadConfigFromIoBroker(includeGlobalSettings = false): Promise<boolean> {
  const keys = Object.keys(IOBROKER_STATE_MAP) as SyncStoreKey[];
  const extraKeys: StoreKey[] = includeGlobalSettings ? [...keys, 'aura-global-settings'] : keys;

  // Load all states in parallel
  const stateIds = extraKeys.map((key) =>
    key === 'aura-global-settings'
      ? 'aura.0.config.global-settings'
      : IOBROKER_STATE_MAP[key as SyncStoreKey]
  );
  const results = await Promise.all(stateIds.map((id) => getStateDirect(id)));

  let changed = false;

  // Check if the dashboard state contains the old blob format
  const dashboardResult = results[stateIds.indexOf('aura.0.config.dashboard')];
  const dashboardRaw = dashboardResult?.val ? String(dashboardResult.val) : '';
  const isOldBlob = dashboardRaw.includes('"aura-dashboard"') || dashboardRaw.includes('"aura-theme"');

  if (isOldBlob) {
    // Migration: extract individual keys from the old blob and write to separate states
    try {
      const blob = JSON.parse(dashboardRaw) as Record<string, unknown>;
      for (const key of extraKeys) {
        const val = blob[key];
        if (!val) continue;
        const raw = typeof val === 'string' ? val : JSON.stringify(val);
        if (!raw || raw.length < 3) continue;
        applyRaw(key, raw);
        // Write to new separate state so next load uses new format
        const stateId = key === 'aura-global-settings'
          ? 'aura.0.config.global-settings'
          : IOBROKER_STATE_MAP[key as SyncStoreKey];
        setStateDirect(stateId, raw);
        changed = true;
      }
    } catch { /* ignore malformed blob */ }
  } else {
    // New format: each result maps directly to its key
    for (let i = 0; i < extraKeys.length; i++) {
      const key = extraKeys[i];
      const state = results[i];
      if (!state?.val) continue;
      const raw = String(state.val);
      if (!raw || raw.length < 3) continue;
      const current = key === 'aura-group-defs' ? null : localStorage.getItem(key);
      if (current === raw) continue;
      applyRaw(key, raw);
      changed = true;
    }
  }

  if (changed) rehydrateAll(includeGlobalSettings);
  return changed;
}
