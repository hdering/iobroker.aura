import { Heading2 } from 'lucide-react';
import { getWidgetIcon } from '../../utils/widgetIconMap';
import type { WidgetConfig } from '../../types';

interface Props {
    config: WidgetConfig;
}

export function HeaderWidget({ config }: Props) {
    const opts = config.options ?? {};
    const subtitle = opts.subtitle as string | undefined;
    const showTitle = opts.showTitle !== false;
    const showSubtitle = opts.showSubtitle !== false;
    const showIcon = opts.showIcon !== false;
    const iconSize = (opts.iconSize as number) || 20;
    const titleAlign = (opts.titleAlign as string) ?? 'left';
    const WidgetIcon = getWidgetIcon(opts.icon as string | undefined, Heading2);
    const layout = config.layout ?? 'default';

    const justifyContent = titleAlign === 'center' ? 'center' : titleAlign === 'right' ? 'flex-end' : 'flex-start';

    // The subtitle belongs to every style, not just the default one — the option and
    // its "Untertitel anzeigen" switch are offered regardless of the chosen style, so
    // compact and minimal used to swallow a subtitle the user had filled in.
    // `align` only follows the title alignment where that option has an effect at all
    // (the default style); compact and minimal always draw the title on the left, so a
    // centred subtitle underneath would just look misaligned.
    const renderSubtitle = (align?: string) =>
        subtitle && showSubtitle ? (
            <p
                className="aura-widget-value text-xs mt-0.5"
                style={{ color: 'var(--text-secondary)', textAlign: align as React.CSSProperties['textAlign'] }}
            >
                {subtitle}
            </p>
        ) : null;

    if (layout === 'minimal') {
        return (
            <div className="aura-widget-row flex flex-col justify-center h-full px-1">
                <div className="flex items-center gap-3">
                    {showIcon && (
                        <WidgetIcon
                            className="aura-widget-icon"
                            size={iconSize}
                            style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
                        />
                    )}
                    {showTitle && (
                        <span
                            className="aura-widget-title text-xs font-semibold tracking-widest uppercase shrink-0"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            {config.title}
                        </span>
                    )}
                    <div className="flex-1 h-px" style={{ background: 'var(--app-border)' }} />
                </div>
                {renderSubtitle()}
            </div>
        );
    }

    if (layout === 'compact') {
        // The accent rule spans the full widget height here (self-stretch in an
        // h-full row) — that is the compact look and stays true with a subtitle.
        return (
            <div className="aura-widget-row flex items-center gap-3 h-full">
                <div
                    className="w-1 self-stretch rounded-full"
                    style={{ background: 'var(--header-accent, var(--accent))' }}
                />
                {showIcon && (
                    <WidgetIcon
                        className="aura-widget-icon"
                        size={iconSize}
                        style={{ color: 'var(--header-text, var(--text-primary))', flexShrink: 0 }}
                    />
                )}
                <div className="flex flex-col min-w-0 flex-1">
                    {showTitle && (
                        <span
                            className="aura-widget-title font-semibold text-base"
                            style={{ color: 'var(--header-text, var(--text-primary))' }}
                        >
                            {config.title}
                        </span>
                    )}
                    {renderSubtitle()}
                </div>
            </div>
        );
    }

    // default / card — the accent rule sits BESIDE title and subtitle (not inside the
    // title row), so it spans the whole text block instead of stopping above the
    // subtitle. Its w-1 plus the gap-3 is exactly the pl-4 the subtitle used to carry
    // to line up under the icon, so the indent now comes from the layout itself.
    return (
        <div className="aura-widget-row flex flex-col justify-center h-full">
            <div className="flex gap-3">
                {titleAlign === 'left' && (
                    <div
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ background: 'var(--header-accent, var(--accent))' }}
                    />
                )}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-3" style={{ justifyContent }}>
                        {showIcon && (
                            <WidgetIcon
                                className="aura-widget-icon"
                                size={iconSize}
                                style={{ color: 'var(--header-text, var(--text-primary))', flexShrink: 0 }}
                            />
                        )}
                        {showTitle && (
                            <h2
                                className="aura-widget-title font-bold text-xl leading-tight"
                                style={{ color: 'var(--header-text, var(--text-primary))' }}
                            >
                                {config.title}
                            </h2>
                        )}
                    </div>
                    {renderSubtitle(titleAlign)}
                </div>
            </div>
        </div>
    );
}
