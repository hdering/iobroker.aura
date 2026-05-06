import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Check, Pencil, Layers } from 'lucide-react';
import { usePopupConfigStore } from '../../store/popupConfigStore';
import { WIDGET_REGISTRY } from '../../widgetRegistry';

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'w-full text-xs rounded-lg px-2.5 py-2 focus:outline-none';
const inputStyle: React.CSSProperties = {
  background: 'var(--app-bg)',
  color: 'var(--text-primary)',
  border: '1px solid var(--app-border)',
};
const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)' };

// ── PopupView picker ──────────────────────────────────────────────────────────

function ViewSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const views = usePopupConfigStore((s) => s.views);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} style={inputStyle}>
      <option value="">— keine View —</option>
      {views.map((v) => (
        <option key={v.id} value={v.id}>{v.name}</option>
      ))}
    </select>
  );
}

// ── Popup-Views section ───────────────────────────────────────────────────────

function PopupViewsSection() {
  const navigate = useNavigate();
  const { views, addView, removeView, updateViewName } = usePopupConfigStore();

  const [newViewName, setNewViewName] = useState('');
  const [addingView, setAddingView] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAddView = () => {
    if (!newViewName.trim()) return;
    const id = addView(newViewName.trim());
    setNewViewName('');
    setAddingView(false);
    navigate(`/admin/popups/${id}`);
  };

  const commitName = (viewId: string) => {
    if (editingName.trim()) updateViewName(viewId, editingName.trim());
    setEditingNameId(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Popup-Views</h2>
        {!addingView && (
          <button
            onClick={() => { setAddingView(true); setNewViewName(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={13} /> View hinzufügen
          </button>
        )}
      </div>

      <div className="space-y-2">
        {/* Add-view form */}
        {addingView && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
          >
            <input
              autoFocus
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddView(); if (e.key === 'Escape') setAddingView(false); }}
              placeholder="View-Name"
              className={inputCls}
              style={inputStyle}
            />
            <button
              onClick={handleAddView}
              disabled={!newViewName.trim()}
              className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => setAddingView(false)}
              className="flex items-center justify-center w-7 h-7 shrink-0 rounded-lg hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-secondary)', background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
            >
              ✕
            </button>
          </div>
        )}

        {views.length === 0 && !addingView && (
          <div className="px-4 py-6 text-xs text-center rounded-xl" style={{ color: 'var(--text-secondary)', background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            Noch keine Popup-Views angelegt.
          </div>
        )}

        {views.map((view) => (
          <div
            key={view.id}
            className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
          >
            {editingNameId === view.id ? (
              <input
                autoFocus
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => commitName(view.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(view.id); if (e.key === 'Escape') setEditingNameId(null); }}
                className="text-xs rounded-lg px-2 py-1 flex-1 focus:outline-none"
                style={{ background: 'var(--app-bg)', color: 'var(--text-primary)', border: '1px solid var(--accent)' }}
              />
            ) : (
              <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {view.name}
              </span>
            )}

            <span className="text-[10px] shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {view.widgets.length} Widget{view.widgets.length !== 1 ? 's' : ''}
            </span>

            <button
              onClick={() => navigate(`/admin/popups/${view.id}`)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity shrink-0"
              style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--text-primary)' }}
              title="View bearbeiten"
            >
              <Layers size={11} /> Bearbeiten
            </button>

            <button
              onClick={() => { setEditingNameId(view.id); setEditingName(view.name); }}
              className="flex items-center justify-center w-6 h-6 shrink-0 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
              title="Umbenennen"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={() => removeView(view.id)}
              className="flex items-center justify-center w-6 h-6 shrink-0 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--accent-red, #ef4444)' }}
              title="View löschen"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Type defaults section ─────────────────────────────────────────────────────

function TypeDefaultsSection() {
  const { typeDefaults, setTypeDefault, removeTypeDefault } = usePopupConfigStore();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState('');
  const [newViewId, setNewViewId] = useState('');

  const configuredTypes = Object.keys(typeDefaults);
  const availableTypes = WIDGET_REGISTRY.filter((m) => !configuredTypes.includes(m.type));

  const handleAdd = () => {
    if (!newType) return;
    setTypeDefault(newType, newViewId);
    setNewType('');
    setNewViewId('');
    setAdding(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Widget-Typ-Standards</h2>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setNewType(availableTypes[0]?.type ?? ''); setNewViewId(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={13} /> Typ-Standard hinzufügen
          </button>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
        <div
          className="grid gap-3 px-4 py-2 text-[11px] font-medium"
          style={{ gridTemplateColumns: '160px 1fr 28px', background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)', color: 'var(--text-secondary)' }}
        >
          <span>Widget-Typ</span><span>Popup-View</span><span />
        </div>

        {configuredTypes.length === 0 && !adding && (
          <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            Noch keine Typ-Standards konfiguriert.
          </div>
        )}

        {configuredTypes.map((wType) => {
          const meta = WIDGET_REGISTRY.find((m) => m.type === wType);
          return (
            <div
              key={wType}
              className="grid items-center gap-3 px-4 py-2"
              style={{ gridTemplateColumns: '160px 1fr 28px', borderBottom: '1px solid var(--app-border)', background: 'var(--app-bg)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{meta?.label ?? wType}</span>
              <ViewSelect value={typeDefaults[wType]} onChange={(v) => setTypeDefault(wType, v)} />
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
            style={{ gridTemplateColumns: '160px 1fr 28px', background: 'var(--app-bg)' }}
          >
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">— Typ wählen —</option>
              {availableTypes.map((m) => <option key={m.type} value={m.type}>{m.label}</option>)}
            </select>
            <ViewSelect value={newViewId} onChange={setNewViewId} />
            <button
              onClick={handleAdd}
              disabled={!newType}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Check size={13} />
            </button>
          </div>
        )}
      </div>
      <p className="text-[11px] mt-2" style={labelStyle}>
        Gilt für alle Widgets des jeweiligen Typs ohne individuelle Klick-Aktion.
      </p>
    </section>
  );
}

// ── Groups section ────────────────────────────────────────────────────────────

function GroupsSection() {
  const { groups, addGroup, updateGroup, removeGroup } = usePopupConfigStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newViewId, setNewViewId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addGroup(newName.trim(), newViewId);
    setNewName('');
    setNewViewId('');
    setAdding(false);
  };

  const commitEdit = (id: string) => {
    if (editingName.trim()) updateGroup(id, { name: editingName.trim() });
    setEditingId(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Popup-Gruppen</h2>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setNewName(''); setNewViewId(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={13} /> Gruppe hinzufügen
          </button>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
        <div
          className="grid gap-3 px-4 py-2 text-[11px] font-medium"
          style={{ gridTemplateColumns: '180px 1fr 28px', background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)', color: 'var(--text-secondary)' }}
        >
          <span>Name</span><span>Popup-View</span><span />
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
            style={{ gridTemplateColumns: '180px 1fr 28px', borderBottom: '1px solid var(--app-border)', background: 'var(--app-bg)' }}
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
                onClick={() => { setEditingId(g.id); setEditingName(g.name); }}
                title="Umbenennen"
              >
                <span className="truncate">{g.name}</span>
                <Pencil size={11} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
              </button>
            )}
            <ViewSelect value={g.viewId} onChange={(v) => updateGroup(g.id, { viewId: v })} />
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
            style={{ gridTemplateColumns: '180px 1fr 28px', background: 'var(--app-bg)' }}
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
            <ViewSelect value={newViewId} onChange={setNewViewId} />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Check size={13} />
            </button>
          </div>
        )}
      </div>
      <p className="text-[11px] mt-2" style={labelStyle}>
        Widgets können einer Gruppe beitreten (Klick-Aktion → Popup: Gruppe). Umbenennen bricht keine Widget-Zuordnungen.
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
          Eigene Popup-Views erstellen und als Standard für Typen oder Gruppen zuweisen
        </p>
      </div>
      <PopupViewsSection />
      <TypeDefaultsSection />
      <GroupsSection />
    </div>
  );
}
