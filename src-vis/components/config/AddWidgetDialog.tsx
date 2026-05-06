import { useState } from 'react';
import type { WidgetConfig, WidgetType } from '../../types';
import { useT } from '../../i18n';
import { ensureDatapointCache } from '../../hooks/useDatapointList';
import { WIDGET_REGISTRY, WIDGET_GROUPS } from '../../widgetRegistry';

interface AddWidgetDialogProps {
  onAdd: (config: WidgetConfig) => void;
  onClose: () => void;
}

const ADDABLE = WIDGET_REGISTRY.filter((m) => m.addMode !== 'wizard-only');

export function AddWidgetDialog({ onAdd, onClose }: AddWidgetDialogProps) {
  const t = useT();
  const [selectedType, setSelectedType] = useState<WidgetType>('value');
  const [title, setTitle] = useState('');
  const [datapoint, setDatapoint] = useState('');
  const [unit, setUnit] = useState('');
  const [adding, setAdding] = useState(false);

  const meta = ADDABLE.find((m) => m.type === selectedType)!;
  const needsDatapoint = meta.addMode === 'datapoint';
  const supportsUnit = selectedType === 'value' || selectedType === 'chart';
  const canAdd = !adding && (needsDatapoint ? !!datapoint.trim() : true);

  const handleAdd = async () => {
    if (!canAdd) return;
    setAdding(true);
    try {
      let finalTitle = title.trim();
      let finalUnit = unit.trim();

      if (needsDatapoint && (!finalTitle || (supportsUnit && !finalUnit))) {
        const entries = await ensureDatapointCache();
        const entry = entries.find((e) => e.id === datapoint.trim());
        if (entry) {
          if (!finalTitle && entry.name) finalTitle = entry.name;
          if (supportsUnit && !finalUnit && entry.unit) finalUnit = entry.unit;
        }
      }

      onAdd({
        id: `w-${Date.now()}`,
        type: selectedType,
        title: finalTitle || meta.label,
        datapoint: needsDatapoint ? datapoint.trim() : '',
        gridPos: { x: 0, y: 9999, w: meta.defaultW, h: meta.defaultH },
        options: finalUnit ? { unit: finalUnit } : {},
      });
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 flex flex-col gap-4 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white font-bold text-lg flex-shrink-0">{t('editor.manual.title')}</h2>

        {/* Widget type picker grouped */}
        <div className="overflow-y-auto flex-shrink-0 max-h-56 space-y-3 pr-1">
          {WIDGET_GROUPS.filter((g) => ADDABLE.some((m) => m.widgetGroup === g.id)).map((group) => (
            <div key={group.id}>
              <div className="text-gray-500 text-xs uppercase tracking-wide mb-1.5">{group.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {ADDABLE.filter((m) => m.widgetGroup === group.id).map((m) => {
                  const active = selectedType === m.type;
                  return (
                    <button
                      key={m.type}
                      onClick={() => setSelectedType(m.type as WidgetType)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={
                        active
                          ? { backgroundColor: m.color + '28', color: m.color, outline: `1px solid ${m.color}` }
                          : { backgroundColor: 'rgb(55 65 81)', color: 'rgb(209 213 219)' }
                      }
                    >
                      <m.Icon size={12} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Hint for selected type */}
        {meta.hint && (
          <p className="text-gray-400 text-xs bg-gray-700/50 border border-gray-700 rounded-lg px-3 py-2 flex-shrink-0">
            {meta.hint}
          </p>
        )}

        {/* Form fields */}
        <div className="space-y-3 flex-shrink-0">
          <div className="space-y-1">
            <label className="text-gray-400 text-xs">{t('editor.manual.titleField')}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={meta.label}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm placeholder-gray-500"
            />
          </div>

          {needsDatapoint && (
            <div className="space-y-1">
              <label className="text-gray-400 text-xs">{t('editor.manual.datapointId')}</label>
              <input
                value={datapoint}
                onChange={(e) => setDatapoint(e.target.value)}
                placeholder="z.B. system.adapter.admin.0.alive"
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm placeholder-gray-500"
              />
            </div>
          )}

          {supportsUnit && (
            <div className="space-y-1">
              <label className="text-gray-400 text-xs">{t('editor.manual.unit')}</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t('endpoints.dp.unitPh')}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm placeholder-gray-500"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => void handleAdd()}
            disabled={!canAdd}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded px-4 py-2 text-sm font-medium"
          >
            {adding ? '…' : t('editor.manual.add')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded bg-gray-700 hover:bg-gray-600"
          >
            {t('editor.manual.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
