/**
 * Lazy-loads Iconify icon sets (lucide + mdi) for the icon picker.
 * Starts loading immediately when this module is imported.
 * Widget rendering uses @iconify/react's Icon component directly –
 * it renders as soon as the set containing the icon is loaded.
 */
import { addCollection } from '@iconify/react';

let loaded = false;
let loadPromise: Promise<void> | null = null;

export function loadIconSets(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all([
    import('@iconify-json/lucide/icons.json').then((m) => {
      addCollection(m.default as Parameters<typeof addCollection>[0]);
    }),
    import('@iconify-json/mdi/icons.json').then((m) => {
      addCollection(m.default as Parameters<typeof addCollection>[0]);
    }),
  ]).then(() => {
    loaded = true;
  });
  return loadPromise;
}

export function areIconSetsLoaded(): boolean {
  return loaded;
}

/** Convert PascalCase Lucide name to Iconify "lucide:kebab-case" ID.
 *  e.g. "ZapOff" → "lucide:zap-off", "Home" → "lucide:home" */
export function lucidePascalToIconify(name: string): string {
  if (name.includes(':')) return name; // already an Iconify ID
  const kebab = name
    .replace(/([A-Z])/g, (ch, _, offset) => (offset === 0 ? ch.toLowerCase() : `-${ch.toLowerCase()}`));
  return `lucide:${kebab}`;
}

// Start loading immediately (non-blocking) so icons are ready when widgets mount
loadIconSets();
