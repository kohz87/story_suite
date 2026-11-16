// The Ripples card widget: each power's sway bar and top reasons.

import { maker } from '../dom.js';

export const RIPPLES_WIDGET = 'story-director.ripples';
const TOP_REASONS = 3;
const signed = n => (n > 0 ? `+${n}` : String(n));

function renderRipples(el, props) {
    const doc = el.ownerDocument ?? globalThis.document;
    const make = maker(doc);
    const root = make('div', 'sd-ripples');
    el.replaceChildren(root);
    let rows = Array.isArray(props?.value) ? props.value : [];
    function draw() {
        if (!rows.length) return root.replaceChildren();
        const section = make('section', 'sd-kind ss-glass', undefined, { 'data-kind': 'ripples' });
        section.append(make('h4', 'sd-h', 'Ripples'), ' ');
        const list = make('ul', 'sd-list sd-ripple-list');
        for (const row of rows) {
            const item = make('li', 'sd-ripple', undefined, { 'data-power': row.id });
            const bar = make('span', 'sd-ripple-bar', undefined, { role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': row.sway, 'aria-label': `${row.name} sway` });
            const fill = make('span', 'sd-ripple-fill');
            fill.style.width = `${Math.max(0, Math.min(100, row.sway))}%`;
            bar.append(fill);
            item.append(make('span', 'sd-key', row.name), ' ', make('small', '', String(row.sway)), ' ', bar);
            const reasons = Array.isArray(row.reasons) ? row.reasons : [];
            for (const reason of reasons.slice(0, TOP_REASONS)) item.append(' ', make('p', 'sd-meta sd-reason', `${signed(reason.delta)} · ${reason.text}`));
            if (reasons.length > TOP_REASONS) item.append(' ', make('p', 'sd-meta sd-more', `+${reasons.length - TOP_REASONS} more`));
            list.append(item);
        }
        section.append(list);
        root.replaceChildren(section);
    }
    draw();
    return {
        update(next) {
            rows = Array.isArray(next?.value) ? next.value : [];
            draw();
        },
        destroy() {
            root.remove();
        },
    };
}

/** The widget `story-director.ripples` (bound to `ripples.sway`): no Reveal step; the Director screen is where spoilers live. */
export function createRipplesWidget() {
    return Object.freeze({
        props: Object.freeze({ value: Object.freeze({ type: 'array', default: Object.freeze([]) }) }),
        primary: 'value',
        validate: props => (props?.value !== undefined && props.value !== null && !Array.isArray(props.value) ? ['value must be the ripples.sway rows.'] : []),
        render: (el, props) => renderRipples(el, props),
    });
}

export const ripplesWidget = createRipplesWidget();
