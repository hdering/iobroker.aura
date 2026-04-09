import { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import type { WidgetProps, ioBrokerState } from '../../types';
import { getObjectViewDirect } from '../../hooks/useIoBroker';
import { useIoBroker } from '../../hooks/useIoBroker';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutoListEntry {
  id: string;
  label?: string; // optional custom label
}

export interface AutoListOptions {
  entries: AutoListEntry[];
  // Filter used for initial wizard + background auto-sync
  filterRoles?: string;
  filterIdPattern?: string;
  filterRooms?: string;
  filterFuncs?: string;
  syncIntervalMin?: number;
  showRoom?: boolean;
}

interface DiscoveredDp {
  id: string;
  name: string;
  role?: string;
  type?: string;
  rooms: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDimmerRole(role?: string) {
  const r = (role ?? '').toLowerCase();
  return r.includes('level') || r.includes('dimmer') || r.includes('brightness');
}

function resolveName(name: string | Record<string, string> | undefined, fallback: string): string {
  if (!name) return fallback;
  if (typeof name === 'string') return name;
  return name.de ?? name.en ?? Object.values(name)[0] ?? fallback;
}

async function discoverDatapoints(opts: Pick<AutoListOptions, 'filterRoles' | 'filterIdPattern' | 'filterRooms' | 'filterFuncs'>): Promise<DiscoveredDp[]> {
  const [stateResult, enumResult] = await Promise.all([
    getObjectViewDirect('state'),
    getObjectViewDirect('enum', 'enum.', 'enum.\u9999'),
  ]);

  // Build room map
  const roomMap = new Map<string, string[]>();
  for (const { value: obj } of enumResult.rows) {
    if (!obj?.common?.members?.length || !obj._id.startsWith('enum.rooms.')) continue;
    const label = resolveName(obj.common.name, obj._id.split('.').pop() ?? obj._id);
    for (const id of obj.common.members) {
      if (!roomMap.has(id)) roomMap.set(id, []);
      roomMap.get(id)!.push(label);
    }
  }

  // Build function map
  const funcMap = new Map<string, string[]>();
  for (const { value: obj } of enumResult.rows) {
    if (!obj?.common?.members?.length || !obj._id.startsWith('enum.functions.')) continue;
    const label = resolveName(obj.common.name, obj._id.split('.').pop() ?? obj._id);
    for (const id of obj.common.members) {
      if (!funcMap.has(id)) funcMap.set(id, []);
      funcMap.get(id)!.push(label);
    }
  }

  const rolePatterns = (opts.filterRoles ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const idPattern = opts.filterIdPattern?.trim().toLowerCase() ?? '';
  const roomFilter = (opts.filterRooms ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const funcFilter = (opts.filterFuncs ?? '').split(',').map(s => s.trim()).filter(Boolean);

  return stateResult.rows
    .filter(({ id, value: obj }) => {
      const role = (obj.common.role ?? '').toLowerCase();
      if (rolePatterns.length > 0 && !rolePatterns.some(p => role.includes(p))) return false;
      if (idPattern && !id.toLowerCase().includes(idPattern)) return false;
      if (roomFilter.length > 0) {
        const rooms = roomMap.get(id) ?? [];
        if (!roomFilter.some(r => rooms.includes(r))) return false;
      }
      if (funcFilter.length > 0) {
        const funcs = funcMap.get(id) ?? [];
        if (!funcFilter.some(f => funcs.includes(f))) return false;
      }
      return true;
    })
    .map(({ id, value: obj }) => ({
      id,
      name: resolveName(obj.common.name, id.split('.').pop() ?? id),
      role: obj.common.role,
      type: obj.common.type,
      rooms: roomMap.get(id) ?? [],
    }));
}

// ── Setup Wizard ──────────────────────────────────────────────────────────────

interface WizardProps {
  initial: AutoListOptions;
  onConfirm: (opts: AutoListOptions) => void;
  onClose: () => void;
}

function SetupWizard({ initial, onConfirm, onClose }: WizardProps) {
  const [roles, setRoles] = useState(initial.filterRoles ?? '');
  const [idPat, setIdPat] = useState(initial.filterIdPattern ?? '');
  const [rooms, setRooms] = useState(initial.filterRooms ?? '');
  const [funcs, setFuncs] = useState(initial.filterFuncs ?? '');
  const [results, setResults] = useState<DiscoveredDp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.entries.map(e => e.id)));
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const found = await discoverDatapoints({ filterRoles: roles, filterIdPattern: idPat, filterRooms: rooms, filterFuncs: funcs });
      setResults(found);
      setSearched(true);
      // Auto-select all found that are not already explicitly de-selected
      setSelected(prev => {
        const next = new Set(prev);
        found.forEach(d => next.add(d.id));
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const confirm = () => {
    const existingEntries = new Map(initial.entries.map(e => [e.id, e]));
    const entries: AutoListEntry[] = [...selected].map(id => existingEntries.get(id) ?? { id });
    onConfirm({
      ...initial,
      entries,
      filterRoles: roles || undefined,
      filterIdPattern: idPat || undefined,
      filterRooms: rooms || undefined,
      filterFuncs: funcs || undefined,
    });
  };

  const iCls = 'w-full text-xs rounded-lg px-2.5 py-2 focus:outline-none';
  const iSty: React.CSSProperties = { background: 'var(--app-bg)', color: 'var(--text-primary)', border: '1px solid var(--app-border)' };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="rounded-xl w-full max-w-lg shadow-2xl flex flex-col"
        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Auto-Liste konfigurieren</h2>
          <button onClick={onClose} className="hover:opacity-60" style={{ color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>

        {/* Filter */}
        <div className="px-5 py-4 space-y-3 shrink-0" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Filter setzen → Suchen → Datenpunkte auswählen
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Rolle (kommagetrennt)</label>
              <input className={iCls} style={iSty} placeholder="z.B. switch, level" value={roles} onChange={e => setRoles(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>ID enthält</label>
              <input className={iCls} style={iSty} placeholder="z.B. hm-rpc, shelly" value={idPat} onChange={e => setIdPat(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Raum</label>
              <input className={iCls} style={iSty} placeholder="z.B. Wohnzimmer" value={rooms} onChange={e => setRooms(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Funktion</label>
              <input className={iCls} style={iSty} placeholder="z.B. Beleuchtung" value={funcs} onChange={e => setFuncs(e.target.value)} />
            </div>
          </div>
          <button
            onClick={search}
            disabled={loading || (!roles && !idPat && !rooms && !funcs)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
            Suchen
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto min-h-0 px-5 py-3">
          {!searched && (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-secondary)' }}>
              Filter setzen und auf "Suchen" klicken
            </p>
          )}
          {searched && results.length === 0 && (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-secondary)' }}>
              Keine Datenpunkte gefunden
            </p>
          )}
          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {results.length} gefunden, {selected.size} ausgewählt
                </span>
                <div className="flex gap-2">
                  <button className="text-[11px] hover:opacity-70" style={{ color: 'var(--accent)' }}
                    onClick={() => setSelected(new Set(results.map(d => d.id)))}>Alle</button>
                  <button className="text-[11px] hover:opacity-70" style={{ color: 'var(--text-secondary)' }}
                    onClick={() => setSelected(new Set())}>Keine</button>
                </div>
              </div>
              <div className="space-y-0.5">
                {results.map(dp => (
                  <label key={dp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
                    style={{ background: selected.has(dp.id) ? 'var(--accent)15' : 'transparent' }}>
                    <input type="checkbox" checked={selected.has(dp.id)} onChange={() => toggle(dp.id)} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{dp.name}</div>
                      <div className="text-[10px] truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {dp.id}{dp.rooms.length > 0 ? ` · ${dp.rooms.join(', ')}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 shrink-0" style={{ borderTop: '1px solid var(--app-border)' }}>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--app-border)' }}>
            Abbrechen
          </button>
          <button
            onClick={confirm}
            disabled={selected.size === 0}
            className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {selected.size} Einträge übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Widget ───────────────────────────────────────────────────────────────

export function AutoListWidget({ config, editMode, onConfigChange }: WidgetProps) {
  const opts = (config.options ?? { entries: [] }) as unknown as AutoListOptions;
  const entries: AutoListEntry[] = opts.entries ?? [];
  const { subscribe, setState, getState } = useIoBroker();
  const [states, setStates] = useState<Record<string, ioBrokerState | null>>({});
  const [showWizard, setShowWizard] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const syncMs = (opts.syncIntervalMin ?? 5) * 60_000;

  const saveOpts = useCallback((patch: Partial<AutoListOptions>) => {
    onConfigChange({ ...config, options: { ...opts, ...patch } });
  }, [config, opts, onConfigChange]);

  // Subscribe to all stored entries
  const entryKey = entries.map(e => e.id).join(',');
  const prevKey = useRef('');
  useEffect(() => {
    if (entryKey === prevKey.current) return;
    prevKey.current = entryKey;
    if (entries.length === 0) return;
    // Fetch initial states
    entries.forEach(e => getState(e.id).then(s => setStates(prev => ({ ...prev, [e.id]: s }))));
    const unsubs = entries.map(e =>
      subscribe(e.id, s => setStates(prev => ({ ...prev, [e.id]: s })))
    );
    return () => unsubs.forEach(u => u());
  }, [entryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background auto-sync: add new matching datapoints
  const runSync = useCallback(async () => {
    const hasFilter = opts.filterRoles || opts.filterIdPattern || opts.filterRooms || opts.filterFuncs;
    if (!hasFilter) return;
    setSyncing(true);
    try {
      const found = await discoverDatapoints(opts);
      const existingIds = new Set(entries.map(e => e.id));
      const newEntries = found.filter(d => !existingIds.has(d.id)).map(d => ({ id: d.id }));
      if (newEntries.length > 0) {
        saveOpts({ entries: [...entries, ...newEntries] });
      }
    } finally {
      setSyncing(false);
    }
  }, [opts, entries, saveOpts]);

  useEffect(() => {
    const timer = setInterval(runSync, syncMs);
    return () => clearInterval(timer);
  }, [runSync, syncMs]);

  const removeEntry = (id: string) =>
    saveOpts({ entries: entries.filter(e => e.id !== id) });

  const addManual = () => {
    const id = addInput.trim();
    if (!id || entries.some(e => e.id === id)) return;
    saveOpts({ entries: [...entries, { id }] });
    setAddInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-3 py-1.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--widget-border)' }}>
        <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
          {config.title || 'Auto-Liste'}
          {entries.length > 0 && <span className="ml-1 opacity-50">({entries.length})</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {editMode && (
            <button onClick={() => setShowWizard(true)} title="Konfigurieren / Sync"
              className="text-[10px] px-2 py-0.5 rounded hover:opacity-80"
              style={{ background: 'var(--accent)20', color: 'var(--accent)', border: '1px solid var(--accent)40' }}>
              Einrichten
            </button>
          )}
          <button onClick={runSync} title="Jetzt synchronisieren"
            className="hover:opacity-70 transition-opacity p-0.5" style={{ color: 'var(--text-secondary)' }}>
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
          <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            Noch keine Datenpunkte konfiguriert.
          </p>
          {editMode && (
            <button onClick={() => setShowWizard(true)}
              className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              Einrichten
            </button>
          )}
        </div>
      )}

      {/* List */}
      {entries.length > 0 && (
        <div className="flex-1 overflow-auto min-h-0">
          {entries.map(entry => {
            const state = states[entry.id] ?? null;
            const val = state?.val;
            // Derive type/role from object (approximate from value)
            const isBoolean = typeof val === 'boolean' || val === 0 || val === 1;
            const isNumber = typeof val === 'number';
            const label = entry.label || entry.id.split('.').pop() || entry.id;

            return (
              <div key={entry.id} className="flex items-center gap-2 px-3 py-2"
                style={{ borderBottom: '1px solid var(--widget-border)' }}>
                {editMode && (
                  <button onClick={() => removeEntry(entry.id)} className="shrink-0 hover:opacity-70"
                    style={{ color: 'var(--text-secondary)' }}>
                    <X size={12} />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{label}</div>
                  {opts.showRoom && (
                    <div className="text-[10px] truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {entry.id}
                    </div>
                  )}
                </div>

                {typeof val === 'boolean' && (
                  <button onClick={() => setState(entry.id, !val)}
                    className="shrink-0 relative w-9 h-[18px] rounded-full transition-colors"
                    style={{ background: val ? 'var(--accent)' : 'var(--app-border)' }}>
                    <span className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all"
                      style={{ left: val ? 'calc(100% - 16px)' : '2px' }} />
                  </button>
                )}

                {isNumber && isDimmerRole(entry.id) && (
                  <div className="shrink-0 flex items-center gap-1.5">
                    <input type="range" min={0} max={100} value={typeof val === 'number' ? val : 0}
                      onChange={e => setState(entry.id, Number(e.target.value))}
                      className="w-20 h-1" style={{ accentColor: 'var(--accent)' }} />
                    <span className="text-[10px] w-8 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {Math.round(val as number)}%
                    </span>
                  </div>
                )}

                {!isBoolean && typeof val !== 'boolean' && (
                  <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {val != null ? String(val) : '–'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit-mode add bar */}
      {editMode && entries.length > 0 && (
        <div className="shrink-0 flex gap-1 px-3 py-2" style={{ borderTop: '1px solid var(--widget-border)' }}>
          <input
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addManual()}
            placeholder="Datenpunkt-ID…"
            className="flex-1 text-[11px] rounded px-2 py-1 font-mono focus:outline-none min-w-0"
            style={{ background: 'var(--app-bg)', color: 'var(--text-primary)', border: '1px solid var(--app-border)' }}
          />
          <button onClick={addManual} className="shrink-0 hover:opacity-80 p-1 rounded"
            style={{ color: 'var(--accent)' }} title="Hinzufügen">
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* Wizard */}
      {showWizard && (
        <SetupWizard
          initial={opts}
          onConfirm={newOpts => { saveOpts(newOpts); setShowWizard(false); }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
