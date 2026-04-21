import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { managedStorage } from './persistManager';

export interface GlobalSettings {
  /** Comma-separated suffixes to strip from DP names, e.g. ".STATE,.LEVEL,:1,:2,:3" */
  dpNameSuffixes: string;
  /** Replace dots with spaces in DP names */
  dpNameReplaceDots: boolean;
}

interface GlobalSettingsState extends GlobalSettings {
  setDpNameSuffixes: (v: string) => void;
  setDpNameReplaceDots: (v: boolean) => void;
}

export const useGlobalSettingsStore = create<GlobalSettingsState>()(
  persist(
    (set) => ({
      dpNameSuffixes: '',
      dpNameReplaceDots: false,
      setDpNameSuffixes: (v) => set({ dpNameSuffixes: v }),
      setDpNameReplaceDots: (v) => set({ dpNameReplaceDots: v }),
    }),
    { name: 'aura-global-settings', storage: createJSONStorage(() => managedStorage) },
  ),
);
