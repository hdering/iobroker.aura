import { useState } from 'react';
import type React from 'react';
import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { useT } from '../../i18n';

// Reordering for the rule lists of both condition editors (issue #623).
//
// Rules are applied top to bottom and the last one wins per property, so their
// order is part of the configuration — until now it was fixed by creation time
// and the only way to change it was deleting and re-adding rules.
//
// Two ways to move a card, sharing one move():
//   • drag the grip — same shape as the datapoint manager (EntryListItem): the
//     grip alone is the drag source, the card is the drop target. Making the card
//     itself draggable would take text selection away from the rule-name input in
//     the very same header.
//   • the arrow buttons — reachable by keyboard and usable on touch

export type RuleReorderProps = {
    index: number;
    /** List length — the arrows disable at the ends, the whole block hides at 1. */
    count: number;
    onMove: (to: number) => void;
    /** Grip props: the drag source that reorders on drop. */
    onDragStart: () => void;
    onDragEnd: () => void;
};

/** What a rule card spreads onto itself to become a drop target. */
export type RuleDragProps = {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    style: React.CSSProperties;
};

export function useRuleReorder<T>(items: T[], onChange: (next: T[]) => void) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    const reset = () => {
        setDragIndex(null);
        setOverIndex(null);
    };

    const move = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
        const next = items.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onChange(next);
    };

    /** Spread onto the rule card. Merge `style` with the card's own border. */
    const itemProps = (i: number): RuleDragProps => {
        const over = (e: React.DragEvent) => {
            e.preventDefault();
            if (overIndex !== i) setOverIndex(i);
        };
        return {
            onDragEnter: over,
            onDragOver: over,
            onDrop: (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragIndex !== null) move(dragIndex, i);
                reset();
            },
            style: dropStyle(i, dragIndex, overIndex),
        };
    };

    const reorderProps = (i: number): RuleReorderProps => ({
        index: i,
        count: items.length,
        onMove: (to) => move(i, to),
        onDragStart: () => setDragIndex(i),
        onDragEnd: reset,
    });

    return { itemProps, reorderProps };
}

function dropStyle(i: number, dragIndex: number | null, overIndex: number | null): React.CSSProperties {
    if (dragIndex === i) return { opacity: 0.4 };
    if (dragIndex === null || overIndex !== i) return {};
    // The marker sits on the edge the dragged card would enter from.
    return dragIndex < i ? { boxShadow: '0 2px 0 0 var(--accent)' } : { boxShadow: '0 -2px 0 0 var(--accent)' };
}

/** The grip — goes at the very left of a rule header. */
export function RuleDragHandle({ count, onDragStart, onDragEnd }: Omit<RuleReorderProps, 'index' | 'onMove'>) {
    const t = useT();
    if (count < 2) return null;
    return (
        <span
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                onDragStart();
            }}
            onDragEnd={onDragEnd}
            className="shrink-0 flex items-center cursor-grab active:cursor-grabbing hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title={t('cond.dragHint')}
            onClick={(e) => e.stopPropagation()}
            data-aura-rule-grip=""
        >
            <GripVertical size={13} />
        </span>
    );
}

/** The two arrows — go next to the delete button of a rule header. */
export function RuleMoveButtons({ index, count, onMove }: Omit<RuleReorderProps, 'onDragStart' | 'onDragEnd'>) {
    const t = useT();
    if (count < 2) return null;
    const btn = (dir: -1 | 1) => {
        const to = index + dir;
        const disabled = to < 0 || to >= count;
        const Icon = dir < 0 ? ArrowUp : ArrowDown;
        return (
            <button
                type="button"
                disabled={disabled}
                title={dir < 0 ? t('cond.moveUp') : t('cond.moveDown')}
                aria-label={dir < 0 ? t('cond.moveUp') : t('cond.moveDown')}
                data-aura-rule-move={dir < 0 ? 'up' : 'down'}
                onClick={(e) => {
                    e.stopPropagation();
                    onMove(to);
                }}
                className="hover:opacity-70 shrink-0"
                style={{ color: 'var(--text-secondary)', opacity: disabled ? 0.25 : undefined }}
            >
                <Icon size={12} />
            </button>
        );
    };
    return (
        <span className="flex items-center gap-0.5 shrink-0">
            {btn(-1)}
            {btn(1)}
        </span>
    );
}
