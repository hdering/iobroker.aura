import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { managedStorage } from './persistManager';
import type { WidgetConfig } from '../types';

export interface PopupView {
  id: string;
  name: string;
  widgets: WidgetConfig[];
}

interface PopupConfigState {
  typeDefaults: Record<string, string>;  // WidgetType → viewId
  views: PopupView[];

  // Type defaults
  setTypeDefault: (widgetType: string, viewId: string) => void;
  removeTypeDefault: (widgetType: string) => void;

  // Views
  addView: (name: string) => string;
  removeView: (viewId: string) => void;
  updateViewName: (viewId: string, name: string) => void;
  addWidgetToView: (viewId: string, widget: WidgetConfig) => void;
  removeWidgetFromView: (viewId: string, widgetId: string) => void;
  updateWidgetInView: (viewId: string, widgetId: string, patch: Partial<WidgetConfig>) => void;
}

export const usePopupConfigStore = create<PopupConfigState>()(
  persist(
    (set) => ({
      typeDefaults: {},
      views: [],

      setTypeDefault: (widgetType, viewId) =>
        set((s) => ({ typeDefaults: { ...s.typeDefaults, [widgetType]: viewId } })),

      removeTypeDefault: (widgetType) =>
        set((s) => {
          const next = { ...s.typeDefaults };
          delete next[widgetType];
          return { typeDefaults: next };
        }),

      addView: (name) => {
        const id = `pv-${Date.now()}`;
        set((s) => ({ views: [...s.views, { id, name, widgets: [] }] }));
        return id;
      },

      removeView: (viewId) =>
        set((s) => ({
          views: s.views.filter((v) => v.id !== viewId),
          typeDefaults: Object.fromEntries(
            Object.entries(s.typeDefaults).filter(([, vid]) => vid !== viewId),
          ),
        })),

      updateViewName: (viewId, name) =>
        set((s) => ({
          views: s.views.map((v) => (v.id === viewId ? { ...v, name } : v)),
        })),

      addWidgetToView: (viewId, widget) =>
        set((s) => ({
          views: s.views.map((v) =>
            v.id === viewId ? { ...v, widgets: [...v.widgets, widget] } : v,
          ),
        })),

      removeWidgetFromView: (viewId, widgetId) =>
        set((s) => ({
          views: s.views.map((v) =>
            v.id === viewId
              ? { ...v, widgets: v.widgets.filter((w) => w.id !== widgetId) }
              : v,
          ),
        })),

      updateWidgetInView: (viewId, widgetId, patch) =>
        set((s) => ({
          views: s.views.map((v) =>
            v.id === viewId
              ? { ...v, widgets: v.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)) }
              : v,
          ),
        })),
    }),
    {
      name: 'aura-popup-config',
      storage: createJSONStorage(() => managedStorage),
    },
  ),
);
