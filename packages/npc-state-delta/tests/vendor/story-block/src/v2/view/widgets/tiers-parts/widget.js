// The tiers widget: the tiered grid of tiles, drawn, kept up to date and wired to its command.

import { h, num, runCommand, shell } from '../dom.js';
import { defineWidget, resolveProps } from '../props.js';
import { tile } from '../glass.js';
import { short } from './shared-short.js';
import { tierList } from './list.js';

export const COLUMNS_MAX = 6;

const tiersProps = {
    tiers: { type: 'array', required: true, default: Object.freeze([]) },  // [{ title, tiles: [{ id, label, icon, count, state, tone, hint, kind }] }]
    selected: { type: 'string', default: '' },                              // the chosen tile's id
    columns: { type: 'number', default: 3 },                                // tiles per row (1–6)
    onSelect: { type: 'string', default: '' },
    label: { type: 'string', default: 'Tiers' },
};

function renderTiers(el, input, api) {
    let p = resolveProps(tiersProps, input);
    let shown = p.selected;
    let lastProp = p.selected;
    let signature = '';
    let handles = [];   // [{ id, handle, spec }]
    return shell(el, 'div', 'tiers', ({ doc, root, cleanup }) => {
        root.classList.add('ss-tiers');
        cleanup(() => { for (const entry of handles) entry.handle.destroy(); handles = []; });
        root.setAttribute('role', 'group');
        const interactive = () => Boolean(p.onSelect);
        // The tiles ask their api for the command; the choice is this block's (`{ tiers: id }`).
        const inner = {
            command: (type, payload) => {
                const id = payload?.tile;
                if (typeof id !== 'string') return undefined;
                shown = id;
                paint();
                runCommand(api, p.onSelect, { tiers: id });
                return undefined;
            },
        };
        const tileProps = spec => ({
            label: spec.label, icon: spec.icon, count: spec.count, state: spec.state, tone: spec.tone, hint: spec.hint, kind: spec.kind, id: spec.id,
            selected: shown === spec.id, onSelect: interactive() ? 'select' : '',
        });
        function paint() {
            for (const entry of handles) entry.handle.update(tileProps(entry.spec));
        }
        function build(tiers) {
            for (const entry of handles) entry.handle.destroy();
            handles = [];
            root.replaceChildren();
            const columns = Math.min(COLUMNS_MAX, Math.max(1, Math.round(num(p.columns, 3))));
            tiers.forEach((tier, index) => {
                const section = h(doc, 'div', 'ss-tiers-tier');
                section.setAttribute('role', 'group');
                if (tier.title) section.setAttribute('aria-label', tier.title);
                if (index > 0) {
                    const link = h(doc, 'div', 'ss-tiers-link');
                    link.setAttribute('aria-hidden', 'true');
                    link.append(h(doc, 'span', 'ss-tiers-dot'), h(doc, 'span', 'ss-tiers-line'));
                    section.appendChild(link);
                }
                const title = h(doc, 'p', 'ss-tiers-label', tier.title);
                title.hidden = !tier.title;
                title.setAttribute('aria-hidden', 'true');
                const grid = h(doc, 'div', 'ss-glass ss-tiers-grid');
                grid.style.setProperty('--ss-cols', String(columns));
                section.append(title, grid);
                for (const spec of tier.tiles) handles.push({ id: spec.id, spec, handle: tile.render(grid, tileProps(spec), inner) });
                root.appendChild(section);
            });
        }
        function update() {
            root.setAttribute('aria-label', short(p.label, 60) || 'Tiers');
            const tiers = tierList(p.tiers);
            const columns = Math.min(COLUMNS_MAX, Math.max(1, Math.round(num(p.columns, 3))));
            // The same shape: the tiles are updated in place (the focus stays); another: drawn again.
            const next = JSON.stringify([columns, interactive(), tiers.map(t => [t.title, t.tiles.map(x => [x.id, x.state === 'locked'])])]);
            if (next !== signature) {
                signature = next;
                build(tiers);
            } else {
                const specs = tiers.flatMap(t => t.tiles);
                handles.forEach((entry, i) => { entry.spec = specs[i]; });
                paint();
            }
        }
        update();
        return {
            update(next) {
                p = resolveProps(tiersProps, next);
                if (p.selected !== lastProp) shown = p.selected;
                lastProp = p.selected;
                update();
            },
        };
    });
}

export const tiers = defineWidget({ props: tiersProps, primary: 'tiers', render: renderTiers });
