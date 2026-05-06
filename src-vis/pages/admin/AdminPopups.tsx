import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ExternalLink, Check, Pencil } from 'lucide-react';
import { usePopupConfigStore } from '../../store/popupConfigStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { WIDGET_REGISTRY } from '../../widgetRegistry';

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'w-full text-xs rounded-lg px-2.5 py-2 focus:outline-none';
const inputStyle: React.CSSProperties = {
  background: 'var(--app-bg)',
  color: 'var(--text-primary)',
  border: '1px solid var(--app-border)',
};

// ── View helpers ──────────────────────────────────────────────────────────────

interface ViewEntry {
  tabId: string;
  label: string;
  layoutId: string;
}

function useAllViews(): ViewEntry[] {
  const layouts = useDashboardStore((s) => s.layouts);
  return layouts.flatMap((l) =>
    l.tabs.map((t) => ({ tabId: t.id, label: `${l.name} / ${t.name}`, layoutId: l.id })),
  );
}

function ViewSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const views = useAllViews();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} style={inputStyle}>
      <option value="">— keine View —</option>
      {views.map((v) => (
        <option key={v.tabId} value={v.tabId}>{v.label}</option>
      ))}
    </select>
  );
}

// ── OpenViewButton ─────────────────────────────────────────────────────────────

function OpenViewButton({ tabId }: { tabId: string }) {
  const navigate = useNavigate();
  const layouts = useDashboardStore((s) => s.layouts);

  const open = () => {
    for (const layout of layouts) {
      const tab = layout.tabs.find((t) => t.id === tabId);
      if (tab) {
        useDashboardStore.getState().setActiveLayoutAndTab(layout.id, tab.id);
        navigate('/admin/editor');
        return;
      }
    }
  };

  if (!tabId) return null;

  return (
    <button
      onClick={open}
      title="View im Editor öffnen"
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs hover:opacity-80 transition-opacity shrink-0"
      style={{ background: 'var(--app-bg)', color: 'var(--text-secondary)', border: '1px solid var(--app-border)' }}
    >
      <ExternalLink size={12} />
    </button>
  );
}

// ── TypeDefaultsSection ───────────────────────────────────────────────────────

function TypeDefaultsSection() {
  const { typeDefaults, setTypeDefault, removeTypeDefault } = usePopupConfigStore();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState('');
  const [newTabId, setNewTabId] = useState('');

  const configuredTypes = Object.keys(typeDefaults);
  const availableTypes = WIDGET_REGISTRY.filter((m) => !configuredTypes.includes(m.type));

  const handleAdd = () => {
    if (!newType) return;
    setTypeDefault(newType, newTabId);
    setNewType('');
    setNewTabId('');
    setAdding(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Widget-Typ-Standards
        </h2>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setNewType(availableTypes[0]?.type ?? ''); setNewTabId(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={13} /> Typ-Standard hinzufügen
          </button>
        )}
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--app-border)' }}
      >
        {/* Header row */}
        <div
          className="grid gap-3 px-4 py-2 text-[11px] font-medium"
          style={{
            gridTemplateColumns: '160px 1fr 28px 28px',
            background: 'var(--app-surface)',
            borderBottom: '1px solid var(--app-border)',
            color: 'var(--text-secondary)',
          }}
        >
          <span>Widget-Typ</span>
          <span>View</span>
          <span />
          <span />
        </div>

        {configuredTypes.length === 0 && !adding && (
          <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            Noch keine Typ-Standards konfiguriert.
          </div>
        )}

        {configuredTypes.map((wType) => {
          const meta = WIDGET_REGISTRY.find((m) => m.type === wType);
          const tabId = typeDefaults[wType];
          return (
            <div
              key={wType}
              className="grid items-center gap-3 px-4 py-2"
              style={{
                gridTemplateColumns: '160px 1fr 28px 28px',
                borderBottom: '1px solid var(--app-border)',
                background: 'var(--app-bg)',
              }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {meta?.label ?? wType}
              </span>
              <ViewSelect value={tabId} onChange={(v) => setTypeDefault(wType, v)} />
              <OpenViewButton tabId={tabId} />
              <button
                onClick={() => removeTypeDefault(wType)}
                className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 transition-opacity"
                style={{ color: 'var(--accent-red, #ef4444)', background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}

        {adding && (
          <div
            className="grid items-center gap-3 px-4 py-2"
            style={{
              gridTemplateColumns: '160px 1fr 28px 28px',
              background: 'var(--app-bg)',
            }}
          >
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">— Typ wählen —</option>
              {availableTypes.map((m) => (
                <option key={m.type} value={m.type}>{m.label}</option>
              ))}
            </select>
            <ViewSelect value={newTabId} onChange={setNewTabId} />
            <button
              onClick={handleAdd}
              disabled={!newType}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-secondary)', background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] mt-2" style={{ color: 'var(--text-secondary)' }}>
        Gilt für alle Widgets des jeweiligen Typs ohne individuelle Popup-Einstellung.
      </p>
    </section>
  );
}

// ── GroupsSection ─────────────────────────────────────────────────────────────

function GroupsSection() {
  const { groups, addGroup, updateGroup, removeGroup } = usePopupConfigStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTabId, setNewTabId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addGroup(newName.trim(), newTabId);
    setNewName('');
    setNewTabId('');
    setAdding(false);
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const commitEdit = (id: string) => {
    if (editingName.trim()) updateGroup(id, { name: editingName.trim() });
    setEditingId(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Popup-Gruppen
        </h2>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setNewName(''); setNewTabId(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={13} /> Gruppe hinzufügen
          </button>
        )}
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--app-border)' }}
      >
        {/* Header row */}
        <div
          className="grid gap-3 px-4 py-2 text-[11px] font-medium"
          style={{
            gridTemplateColumns: '180px 1fr 28px 28px',
            background: 'var(--app-surface)',
            borderBottom: '1px solid var(--app-border)',
            color: 'var(--text-secondary)',
          }}
        >
          <span>Name</span>
          <span>View</span>
          <span />
          <span />
        </div>

        {groups.length === 0 && !adding && (
          <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            Noch keine Gruppen konfiguriert.
          </div>
        )}

        {groups.map((g) => (
          <div
            key={g.id}
            className="grid items-center gap-3 px-4 py-2"
            style={{
              gridTemplateColumns: '180px 1fr 28px 28px',
              borderBottom: '1px solid var(--app-border)',
              background: 'var(--app-bg)',
            }}
          >
            {editingId === g.id ? (
              <input
                autoFocus
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => commitEdit(g.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(g.id); if (e.key === 'Escape') setEditingId(null); }}
                className={inputCls}
                style={inputStyle}
              />
            ) : (
              <button
                className="flex items-center gap-1.5 text-xs text-left hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => startEdit(g.id, g.name)}
                title="Umbenennen"
              >
                <span className="truncate">{g.name}</span>
                <Pencil size={11} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
              </button>
            )}
            <ViewSelect value={g.tabId} onChange={(v) => updateGroup(g.id, { tabId: v })} />
            <OpenViewButton tabId={g.tabId} />
            <button
              onClick={() => removeGroup(g.id)}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-red, #ef4444)', background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {adding && (
          <div
            className="grid items-center gap-3 px-4 py-2"
            style={{ gridTemplateColumns: '180px 1fr 28px 28px', background: 'var(--app-bg)' }}
          >
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Gruppenname"
              className={inputCls}
              style={inputStyle}
            />
            <ViewSelect value={newTabId} onChange={setNewTabId} />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-secondary)', background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] mt-2" style={{ color: 'var(--text-secondary)' }}>
        Widgets können einer Gruppe beitreten (Klick-Aktion → Popup: Gruppe). Die interne ID bleibt beim Umbenennen erhalten.
      </p>
    </section>
  );
}

// ── AdminPopups ───────────────────────────────────────────────────────────────

export function AdminPopups() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Popups</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Zentrale Popup-Konfiguration für Widget-Typen und Gruppen
        </p>
      </div>

      <TypeDefaultsSection />
      <GroupsSection />
    </div>
  );
}
