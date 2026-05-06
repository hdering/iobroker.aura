import type { WidgetConfig } from '../types';
import { useGroupDefsStore, newGroupDefId } from '../store/groupDefsStore';

function collectGroupDefs(
  widgets: WidgetConfig[],
  allDefs: Record<string, WidgetConfig[]>,
  out: Record<string, WidgetConfig[]>,
): void {
  for (const w of widgets) {
    if (w.type === 'group' && w.options?.defId) {
      const defId = w.options.defId as string;
      if (!(defId in out) && allDefs[defId]) {
        out[defId] = allDefs[defId];
        collectGroupDefs(allDefs[defId], allDefs, out);
      }
    }
  }
}

export function exportWidget(config: WidgetConfig) {
  const payload: Record<string, unknown> = { ...config };

  if (config.type === 'group' && config.options?.defId) {
    const allDefs = useGroupDefsStore.getState().defs;
    const groupDefs: Record<string, WidgetConfig[]> = {};
    collectGroupDefs([config], allDefs, groupDefs);
    if (Object.keys(groupDefs).length > 0) {
      payload.groupDefs = groupDefs;
    }
  }

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aura-widget-${config.type}-${(config.title || config.id).replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Remaps all defIds from the imported groupDefs to fresh IDs, loads them into
 * the store, and returns the config updated with the new root defId.
 */
export function importGroupDefs(
  config: WidgetConfig,
  importedDefs: Record<string, WidgetConfig[]>,
): WidgetConfig {
  if (!config.options?.defId || Object.keys(importedDefs).length === 0) return config;

  const idMap: Record<string, string> = {};
  for (const oldId of Object.keys(importedDefs)) {
    idMap[oldId] = newGroupDefId();
  }

  function remapChildren(children: WidgetConfig[]): WidgetConfig[] {
    return children.map((child) => {
      if (child.type === 'group' && child.options?.defId) {
        const oldDefId = child.options.defId as string;
        const newDefId = idMap[oldDefId] ?? oldDefId;
        return { ...child, options: { ...child.options, defId: newDefId } };
      }
      return child;
    });
  }

  const { setDef } = useGroupDefsStore.getState();
  for (const [oldId, children] of Object.entries(importedDefs)) {
    setDef(idMap[oldId], remapChildren(children));
  }

  const newRootDefId = idMap[config.options.defId as string] ?? (config.options.defId as string);
  return { ...config, options: { ...config.options, defId: newRootDefId } };
}
