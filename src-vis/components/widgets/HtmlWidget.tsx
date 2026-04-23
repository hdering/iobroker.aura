import { Code2 } from 'lucide-react';
import { useDatapoint } from '../../hooks/useDatapoint';
import type { WidgetProps } from '../../types';

export function HtmlWidget({ config }: WidgetProps) {
  const opts           = config.options ?? {};
  const htmlContent    = (opts.htmlContent    as string)  ?? '';
  const htmlDatapoint  = (opts.htmlDatapoint  as string)  ?? '';
  const scrollable     = (opts.scrollable     as boolean) ?? true;

  const { value: dpValue } = useDatapoint(htmlDatapoint);

  const html = (() => {
    if (htmlDatapoint && dpValue != null && dpValue !== '') return String(dpValue);
    return htmlContent;
  })();

  if (!html) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2"
        style={{ color: 'var(--text-secondary)' }}>
        <Code2 size={32} strokeWidth={1} />
        <p className="text-xs text-center">
          {config.title || 'HTML'}
          <br />
          <span className="text-[10px] opacity-60">Kein HTML oder Datenpunkt konfiguriert</span>
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full"
      style={{ overflow: scrollable ? 'auto' : 'hidden' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
