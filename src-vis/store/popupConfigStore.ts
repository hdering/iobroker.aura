import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { managedStorage } from './persistManager';

export interface PopupGroup {
  id: string;
  name: string;
  tabId: string;
}

interface PopupConfigState {
  typeDefaults: Record<string, string>;  // WidgetType → tabId
  groups: PopupGroup[];

  setTypeDefault: (widgetType: string, tabId: string) => void;
  removeTypeDefault: (widgetType: string) => void;
  addGroup: (name: string, tabId: string) => void;
  updateGroup: (id: string, patch: Partial<Omit<PopupGroup, 'id'>>) => void;
  removeGroup: (id: string) => void;
}

export const usePopupConfigStore = create<PopupConfigState>()(
  persist(
    (set) => ({
      typeDefaults: {},
      groups: [],

      setTypeDefault: (widgetType, tabId) =>
        set((s) => ({ typeDefaults: { ...s.typeDefaults, [widgetType]: tabId } })),

      removeTypeDefault: (widgetType) =>
        set((s) => {
          const next = { ...s.typeDefaults };
          delete next[widgetType];
          return { typeDefaults: next };
        }),

      addGroup: (name, tabId) =>
        set((s) => ({
          groups: [...s.groups, { id: `pg-${Date.now()}`, name, tabId }],
        })),

      updateGroup: (id, patch) =>
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        })),

      removeGroup: (id) =>
        set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),
    }),
    {
      name: 'aura-popup-config',
      storage: createJSONStorage(() => managedStorage),
    },
  ),
);
