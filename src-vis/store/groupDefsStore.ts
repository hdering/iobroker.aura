import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { managedStorage } from './persistManager';
import type { WidgetConfig } from '../types';

export interface GroupDefsState {
  defs: Record<string, WidgetConfig[]>;
  setDef: (defId: string, children: WidgetConfig[]) => void;
  removeDef: (defId: string) => void;
}

export const useGroupDefsStore = create<GroupDefsState>()(
  persist(
    (set) => ({
      defs: {},
      setDef: (defId, children) =>
        set((s) => ({ defs: { ...s.defs, [defId]: children } })),
      removeDef: (defId) =>
        set((s) => {
          const next = { ...s.defs };
          delete next[defId];
          return { defs: next };
        }),
    }),
    {
      name: 'aura-group-defs',
      storage: createJSONStorage(() => managedStorage),
    },
  ),
);

export function newGroupDefId(): string {
  return `gd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Deep-clone a group def entry (and nested group defs) into new def IDs. */
export function cloneGroupDef(sourceDefId: string): string {
  const children = useGroupDefsStore.getState().defs[sourceDefId] ?? [];
  const id = newGroupDefId();
  useGroupDefsStore.getState().setDef(id, cloneChildren(children));
  return id;
}

function cloneChildren(children: WidgetConfig[]): WidgetConfig[] {
  return children.map((child) => {
    if (child.type === 'group' && child.options?.defId) {
      return { ...child, options: { ...child.options, defId: cloneGroupDef(child.options.defId as string) } };
    }
    return child;
  });
}
