// The folded "Worn (N)" row of the Inventory screen (gear on), kept open or shut per chat on this device.

import { STRINGS } from '../../../../core/strings.js';
import { h, s as svg, shell } from '../../view/widgets/dom.js';

const S = STRINGS.inventory;

export const WORN_FOLD_WIDGET = 'story-block.worn-fold';
const G = S.gear;

/**
 * The "Worn (N)" row: a drawn chevron on the left (as the Party card's Left row), the count, and, folded, who wears how many ("Astra 5 · Sister Temiwa 1").
 * Props: `rows` (the screen's `q.gx.rows`) and `open` ('1' open, '0' closed, '' not chosen yet this view). Open or folded is the viewer's choice, per chat on this device
 * (localStorage, never game state; a storage that throws means folded); the screen's draft `wornOpen` carries it to the rows below (the template shows them while it is '1').
 */
export function createWornFoldWidget({ chatKey = () => '', storage = undefined } = {}) {
    const key = () => `story-block.inventoryWornOpen|${chatKey()}`;
    const area = () => { try { return storage === undefined ? globalThis.localStorage : storage; } catch { return null; } };
    const kept = new Map();
    const stored = () => { if (kept.has(key())) return kept.get(key()); try { return area()?.getItem?.(key()) === '1'; } catch { return false; } };
    const keep = on => { kept.set(key(), on); try { if (on) area()?.setItem?.(key(), '1'); else area()?.removeItem?.(key()); } catch { /* the choice lasts this page only */ } };
    return Object.freeze({
        props: {}, primary: null, validate: () => [],
        render(el, first, api) {
            return shell(el, 'div', 'worn-fold', ({ doc, root, listen }) => {
                let props = first ?? {};
                const draw = () => {
                    const worn = Object.values(props.rows ?? {}).filter(row => row && typeof row.place === 'string' && row.place !== '');
                    root.hidden = worn.length === 0;
                    const hadFocus = Boolean(doc.activeElement && root.contains?.(doc.activeElement));   // (the redraw replaces the button: its replacement keeps the focus)
                    root.replaceChildren();
                    if (!worn.length) return;
                    const opened = props.open === '1';
                    const by = new Map();
                    for (const row of worn) by.set(row.by, (by.get(row.by) ?? 0) + 1);
                    const button = h(doc, 'button', `worn-fold-btn${opened ? ' worn-open' : ''}`);
                    button.setAttribute('type', 'button');
                    button.setAttribute('aria-expanded', String(opened));
                    button.setAttribute('title', G.wornFoldTitle);
                    const chevron = h(doc, 'span', 'worn-chev');
                    const drawn = svg(doc, 'svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
                    drawn.appendChild(svg(doc, 'path', { d: 'M4.5 2.5 8 6l-3.5 3.5' }));
                    chevron.appendChild(drawn);
                    button.append(chevron, h(doc, 'b', '', G.wornFold.replace('{n}', String(worn.length))));
                    if (!opened) button.appendChild(h(doc, 'span', 'worn-names', [...by].map(([name, n]) => `${name} ${n}`).join(' \u00b7 ')));
                    listen(button, 'click', () => { keep(!opened); api?.draft?.set?.('wornOpen', opened ? '0' : '1'); });
                    root.appendChild(button);
                    if (hadFocus) button.focus?.();
                };
                draw();
                // Folded for the first look, unless this chat was left open on this device: the draft is filled once the draw is done.
                if (props.open === '' && stored()) Promise.resolve().then(() => api?.draft?.set?.('wornOpen', '1'));
                return { update(next) { props = next ?? {}; draw(); } };
            });
        },
    });
}
