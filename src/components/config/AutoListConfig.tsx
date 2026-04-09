import { useState } from 'react';
import { RefreshCw, Search, Check, X } from 'lucide-react';
import type { WidgetConfig } from '../../types';
import { discoverDatapoints } from '../widgets/AutoListWidget';
import type { AutoListOptions, AutoListEntry, DiscoveredDp } from '../widgets/AutoListWidget';

interface Props {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}

export function AutoListConfig({ config, onConfigChange }: Props) {
  const opts = (config.options ?? { entries: [] }) as unknown as AutoListOptions;

  const [roles, setRoles] = useState(opts.filterRoles ?? '');
  const [idPat, setIdPat] = useState(opts.filterIdPattern ?? '');
  const [rooms, setRooms] = useState(opts.filterRooms ?? '');
  const [funcs, setFuncs] = useState(opts.filterFuncs ?? '');
  const [results, setResults] = useState<DiscoveredDp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set((opts.entries ?? []).map(e => e.id)));
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const setOpts = (patch: Partial<AutoListOptions>) =>
    onConfigChange({ ...config, options: { ...opts, ...patch } });

  const search = async () => {
    setLoading(true);
    try {
      const found = await discoverDatapoints({
        filterRoles: roles, filterIdPattern: idPat, filterRooms: rooms, filterFuncs: funcs,
      });
      setResults(found);
      setSearched(true);
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

  const apply = () => {
    const existing = new Map((opts.entries ?? []).map(e => [e.id, e]));
    const entries: AutoListEntry[] = [...selected].map(id => existing.get(id) ?? { id });
    setOpts({
      entries,
      filterRoles: roles || undefined,
      filterIdPattern: idPat || undefined,
      filterRooms: rooms || undefined,
      filterFuncs: funcs || undefined,
    });
  };

  const removeEntry = (id: string) =>
    setOpts({ entries: (opts.entries ?? []).filter(e => e.id !== id) });

  const iCls = 'w-full text-xs rounded-lg px-2.5 py-2 focus:outline-none';
  const iSty = { background: 'var(--app-bg)', color: 'var(--text-primary)', border: '1px solid var(--app-border)' } as React.CSSProperties;
  const canSearch = !!(roles || idPat || rooms || funcs);

  return (
    <>
      {/* ── Filters ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Rollen</label>
          <input className={iCls} style={iSty} placeholder="switch, level" value={roles}
            onChange={e => setRoles(e.target.value)} onKeyDown={e => e.key === 'Enter' && canSearch && search()} />
        </div>
        <div>
          <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>ID enthält</label>
          <input className={iCls} style={iSty} placeholder="hm-rpc, shelly" value={idPat}
            onChange={e => setIdPat(e.target.value)} onKeyDown={e => e.key === 'Enter' && canSearch && search()} />
        </div>
        <div>
          <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Raum</label>
          <input className={iCls} style={iSty} placeholder="Wohnzimmer" value={rooms}
            onChange={e => setRooms(e.target.value)} onKeyDown={e => e.key === 'Enter' && canSearch && search()} />
        </div>
        <div>
          <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Funktion</label>
          <input className={iCls} style={iSty} placeholder="Beleuchtung" value={funcs}
            onChange={e => setFuncs(e.target.value)} onKeyDown={e => e.key === 'Enter' && canSearch && search()} />
        </div>
      </div>

      <button
        onClick={search}
        disabled={loading || !canSearch}
        className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg hover:opacity-80 disabled:opacity-40"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        Suchen
      </button>

      {/* ── Search results ── */}
      {searched && results.length === 0 && (
        <p className="text-[11px] text-center py-2" style={{ color: 'var(--text-secondary)' }}>
          Keine Datenpunkte gefunden
        </p>
      )}
      {searched && results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {results.length} gefunden · {selected.size} ausgewählt
            </span>
            <div className="flex gap-2">
              <button className="text-[10px] hover:opacity-70" style={{ color: 'var(--accent)' }}
                onClick={() => setSelected(new Set(results.map(d => d.id)))}>Alle</button>
              <button className="text-[10px] hover:opacity-70" style={{ color: 'var(--text-secondary)' }}
                onClick={() => setSelected(new Set())}>Keine</button>
            </div>
          </div>

          <div className="space-y-0.5 max-h-44 overflow-y-auto -mx-1 px-1">
            {results.map(dp => (
              <label key={dp.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:opacity-90"
                style={{ background: selected.has(dp.id) ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}>
                <div className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
                  style={{ background: selected.has(dp.id) ? 'var(--accent)' : 'var(--app-border)' }}>
                  {selected.has(dp.id) && <Check size={9} color="#fff" />}
                </div>
                <input type="checkbox" className="sr-only" checked={selected.has(dp.id)}
                  onChange={() => toggle(dp.id)} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] truncate" style={{ color: 'var(--text-primary)' }}>{dp.name}</div>
                  <div className="text-[9px] truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {dp.id}{dp.rooms.length > 0 ? ` · ${dp.rooms[0]}` : ''}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={apply}
            disabled={selected.size === 0}
            className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--accent-green)', color: '#fff' }}
          >
            <Check size={11} /> {selected.size} Einträge übernehmen
          </button>
        </>
      )}

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'var(--app-border)' }} />

      {/* ── Current entries ── */}
      {(opts.entries ?? []).length > 0 && (
        <div>
          <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            Aktuelle Einträge ({opts.entries.length})
          </label>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {opts.entries.map(e => (
              <div key={e.id} className="flex items-center gap-1.5 px-2 py-1 rounded"
                style={{ background: 'var(--app-bg)' }}>
                <span className="flex-1 text-[10px] truncate font-mono" style={{ color: 'var(--text-primary)' }}>
                  {e.label || e.id.split('.').pop() || e.id}
                </span>
                <button onClick={() => removeEntry(e.id)} className="shrink-0 hover:opacity-70"
                  style={{ color: 'var(--text-secondary)' }}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      <div>
        <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Auto-Sync (Minuten)</label>
        <input type="number" min={1} className={iCls} style={iSty}
          value={(opts.syncIntervalMin ?? 5)}
          onChange={e => setOpts({ syncIntervalMin: Number(e.target.value) })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Raum anzeigen</label>
        <button onClick={() => setOpts({ showRoom: !(opts.showRoom ?? false) })}
          className="relative w-9 h-5 rounded-full transition-colors"
          style={{ background: (opts.showRoom ?? false) ? 'var(--accent)' : 'var(--app-border)' }}>
          <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
            style={{ left: (opts.showRoom ?? false) ? '18px' : '2px' }} />
        </button>
      </div>
    </>
  );
}
