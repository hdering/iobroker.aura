import { useMemo } from 'react';
import { Table2 } from 'lucide-react';
import { useDatapoint } from '../../hooks/useDatapoint';
import type { WidgetProps } from '../../types';

interface TableData {
  headers: string[];
  rows: (string | number | boolean | null)[][];
}

function parseJson(raw: unknown): TableData | null {
  let data: unknown;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { return null; }
  } else {
    data = raw;
  }
  if (data === null || data === undefined) return null;

  // Array of objects: [{col1: val, col2: val}, ...]
  if (
    Array.isArray(data) && data.length > 0 &&
    typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])
  ) {
    const headers = Object.keys(data[0] as object);
    const rows = (data as Record<string, unknown>[]).map(
      (row) => headers.map((h) => (row[h] ?? null) as string | number | boolean | null),
    );
    return { headers, rows };
  }

  // Array of arrays: [[header1, header2], [val1, val2], ...]
  if (Array.isArray(data) && data.length > 1 && Array.isArray(data[0])) {
    const [headerRow, ...dataRows] = data as unknown[][];
    return {
      headers: (headerRow as unknown[]).map(String),
      rows: dataRows as (string | number | boolean | null)[][],
    };
  }

  // {headers: [...], rows: [[...]]}
  if (!Array.isArray(data) && typeof data === 'object' && 'headers' in data && 'rows' in data) {
    const d = data as { headers: unknown[]; rows: unknown[][] };
    return {
      headers: d.headers.map(String),
      rows: d.rows as (string | number | boolean | null)[][],
    };
  }

  return null;
}

function formatCell(cell: string | number | boolean | null): string {
  if (cell === null || cell === undefined) return '–';
  if (typeof cell === 'boolean') return cell ? '✓' : '✗';
  return String(cell);
}

export function JsonTableWidget({ config }: WidgetProps) {
  const opts = config.options ?? {};
  const { value } = useDatapoint(config.datapoint);

  const headerBg       = (opts.headerBg       as string)  ?? 'var(--accent)';
  const headerColor    = (opts.headerColor     as string)  ?? '#ffffff';
  const firstColHeader = (opts.firstColHeader  as boolean) ?? false;
  const firstColBg     = (opts.firstColBg      as string)  ?? 'var(--app-bg)';
  const firstColColor  = (opts.firstColColor   as string)  ?? 'var(--text-secondary)';
  const striped        = (opts.striped         as boolean) ?? true;
  const showHeader     = (opts.showHeader      as boolean) ?? true;
  const fontSize       = (opts.fontSize        as number)  ?? 12;

  const tableData = useMemo(() => parseJson(value), [value]);

  if (!config.datapoint) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2"
        style={{ color: 'var(--text-secondary)' }}>
        <Table2 size={32} strokeWidth={1} />
        <p className="text-xs text-center">
          {config.title || 'JSON-Tabelle'}<br />
          <span className="text-[10px] opacity-60">Kein Datenpunkt konfiguriert</span>
        </p>
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2"
        style={{ color: 'var(--text-secondary)' }}>
        <Table2 size={24} strokeWidth={1} />
        <p className="text-xs text-center opacity-60">
          {value !== undefined && value !== null ? 'Ungültiges JSON' : 'Warte auf Daten…'}
        </p>
      </div>
    );
  }

  const fs = fontSize;

  return (
    <div className="flex flex-col h-full">
      {config.title && !opts.hideTitle && (
        <p className="shrink-0 mb-1 truncate" style={{ fontSize: fs - 1, color: 'var(--text-secondary)' }}>
          {config.title}
        </p>
      )}
      <div className="flex-1 overflow-auto min-h-0 min-w-0">
        <table className="border-collapse" style={{ fontSize: fs, width: '100%', tableLayout: 'auto' }}>
          {showHeader && tableData.headers.length > 0 && (
            <thead>
              <tr>
                {tableData.headers.map((h, i) => (
                  <th key={i}
                    className="text-left whitespace-nowrap sticky top-0"
                    style={{
                      padding: `${Math.round(fs * 0.4)}px ${Math.round(fs * 0.6)}px`,
                      background: firstColHeader && i === 0 ? firstColBg : headerBg,
                      color:      firstColHeader && i === 0 ? firstColColor : headerColor,
                      fontWeight: 600,
                      borderBottom: '2px solid var(--app-border)',
                      zIndex: 1,
                    }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {tableData.rows.map((row, ri) => (
              <tr key={ri}
                style={{ background: striped && ri % 2 === 1 ? 'color-mix(in srgb, var(--app-bg) 60%, transparent)' : 'transparent' }}>
                {row.map((cell, ci) => {
                  const isLabel = firstColHeader && ci === 0;
                  return (
                    <td key={ci}
                      className="whitespace-nowrap"
                      style={{
                        padding: `${Math.round(fs * 0.35)}px ${Math.round(fs * 0.6)}px`,
                        color:      isLabel ? firstColColor : 'var(--text-primary)',
                        background: isLabel ? firstColBg : undefined,
                        fontWeight: isLabel ? 600 : 400,
                        borderRight:  isLabel ? '2px solid var(--app-border)' : undefined,
                        borderBottom: `1px solid color-mix(in srgb, var(--app-border) 50%, transparent)`,
                      }}>
                      {formatCell(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
