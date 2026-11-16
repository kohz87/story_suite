// The Inventory screen's List | Grid switch, its choice kept per device.

import { STRINGS } from '../../../../../../core/strings.js';
import { h, shell } from '../../view/widgets/dom.js';

const S = STRINGS.inventory;

export const INVENTORY_VIEW_WIDGET = 'story-block.inventory-view';
const VIEWS = Object.freeze(['grid', 'list']);

/**
 * The List | Grid switch. Props: `view` ('grid', 'list', or '' not chosen yet this visit). The choice is kept per device (localStorage, never game state; a storage
 * that throws means `fallback`, Grid, and the choice then lasts this page). The screen's draft `view` carries it to the template, which shows the List rows only while it is 'list'.
 */
export function createInventoryViewWidget({ storage = undefined, fallback = 'grid' } = {}) {
    const KEY = 'story-block.inventoryView';
    const area = () => { try { return storage === undefined ? globalThis.localStorage : storage; } catch { return null; } };
    let kept = null;
    const stored = () => {
        if (kept) return kept;
        try { const value = area()?.getItem?.(KEY); return VIEWS.includes(value) ? value : fallback; } catch { return fallback; }
    };
    const keep = value => { kept = value; try { area()?.setItem?.(KEY, value); } catch { /* the choice lasts this page only */ } };
    return Object.freeze({
        props: {}, primary: null, validate: () => [],
        render(el, first, api) {
            return shell(el, 'span', 'inventory-view', ({ doc, root, listen }) => {
                let props = first ?? {};
                const draw = () => {
                    const view = VIEWS.includes(props.view) ? props.view : stored();
                    root.replaceChildren();
                    const group = h(doc, 'span', 'inv-view');
                    group.setAttribute('role', 'group');
                    group.setAttribute('aria-label', S.viewLabel);
                    for (const value of ['list', 'grid']) {
                        const button = h(doc, 'button', 'ss-tap-pill', value === 'list' ? S.viewList : S.viewGrid);   // about 30px drawn, a 44px tap area (size.css)
                        button.setAttribute('type', 'button');
                        button.setAttribute('aria-pressed', String(view === value));
                        listen(button, 'click', () => { keep(value); api?.draft?.set?.('view', value); });
                        group.append(button);
                    }
                    root.append(group);
                };
                draw();
                if (!VIEWS.includes(props.view)) Promise.resolve().then(() => api?.draft?.set?.('view', stored()));
                return { update(next) { props = next ?? {}; draw(); } };
            });
        },
    });
}
