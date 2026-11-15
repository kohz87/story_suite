// ss.tile: an icon in a rounded square with a label, count, tick or lock, as a button when it has onSelect.

import { h, iconNode, runCommand, setData, shell } from '../dom.js';
import { defineWidget, resolveProps } from '../props.js';
import { setGlassTone } from './tones.js';
import { LABEL_MAX, pick, short } from './shared-text.js';

export const TILE_STATES = Object.freeze(['none', 'ready', 'locked']);
const COUNT_MAX = 6;

// ---- tile ------------------------------------------------------------------------------------------

const tileProps = {
    label: { type: 'string', required: true, default: '' },
    icon: { type: 'string', default: '' },
    count: { type: 'string', default: '' },          // a number or a short text ("3", "–"); '' for none
    countStyle: { type: 'string', default: 'badge' }, // badge (under the icon) or corner
    state: { type: 'string', default: 'none' },       // none, ready (a tick) or locked (a lock)
    tone: { type: 'string', default: '' },            // the ring: a tone or a rarity ('' = the hairline)
    selected: { type: 'boolean', default: false },
    showLabel: { type: 'boolean', default: true },
    hint: { type: 'string', default: '' },             // said after the label ("Lv 3", "Uncommon")
    id: { type: 'string', default: '' },
    kind: { type: 'string', default: '' },
    onSelect: { type: 'string', default: '' },
};

/** What a tile says to a screen reader: "Moonlight Slash, Lv 3, ready" / "Death Soul, locked". */
export function tileSpoken(p) {
    const parts = [short(p.label, LABEL_MAX) || 'Tile'];
    if (p.hint) parts.push(short(p.hint, LABEL_MAX));
    else if (p.count !== '' && p.count !== null && p.count !== undefined) parts.push(short(p.count, COUNT_MAX));
    if (p.state === 'ready') parts.push('ready');
    if (p.state === 'locked') parts.push('locked');
    return parts.join(', ');
}

function renderTile(el, input, api) {
    let p = resolveProps(tileProps, input);
    let current = null;
    function build() {
        const state = pick(TILE_STATES, p.state, 'none');
        const clickable = Boolean(p.onSelect) && typeof api?.command === 'function' && state !== 'locked';
        current = shell(el, clickable ? 'button' : 'div', 'tile', ({ doc, root, listen }) => {
            root.classList.add('ss-tile');
            if (clickable) {
                root.setAttribute('type', 'button');
                listen(root, 'click', () => runCommand(api, p.onSelect, { tile: p.id || p.label }));
            } else root.setAttribute('role', 'group');
            const box = h(doc, 'span', 'ss-tile-box');
            const icon = h(doc, 'span', 'ss-tile-icon');
            const count = h(doc, 'span', 'ss-tile-count');
            const mark = h(doc, 'span', 'ss-tile-mark');
            const label = h(doc, 'span', 'ss-tile-label');
            for (const node of [icon, count, mark, label]) node.setAttribute('aria-hidden', 'true');
            box.append(icon, count, mark);
            root.append(box, label);
            function update() {
                const now = pick(TILE_STATES, p.state, 'none');
                setGlassTone(box, p.tone, '');
                root.classList.toggle('ss-tile-ready', now === 'ready');
                root.classList.toggle('ss-tile-locked', now === 'locked');
                setData(root, 'kind', p.kind);
                const glyph = iconNode(doc, p.icon);
                icon.replaceChildren(...(glyph ? [glyph] : []));
                if (!glyph) icon.textContent = Array.from(short(p.label, LABEL_MAX))[0] ?? '';
                const shown = short(p.count, COUNT_MAX);
                count.textContent = shown;
                count.hidden = !shown;
                count.classList.toggle('ss-tile-corner', p.countStyle === 'corner');
                mark.replaceChildren();
                if (now !== 'none') {
                    const sign = h(doc, 'i', `fa-solid ${now === 'ready' ? 'fa-check' : 'fa-lock'}`);
                    sign.setAttribute('aria-hidden', 'true');
                    mark.appendChild(sign);
                }
                mark.hidden = now === 'none';
                label.textContent = short(p.label, LABEL_MAX);
                label.hidden = !p.showLabel;
                const spoken = tileSpoken({ ...p, state: now });
                root.setAttribute('aria-label', spoken);
                root.setAttribute('title', spoken);
                if (clickable) root.setAttribute('aria-pressed', p.selected ? 'true' : 'false');
                else if (p.selected) root.setAttribute('aria-current', 'true');
                else root.removeAttribute('aria-current');
            }
            update();
            return { update };
        });
        current.clickable = clickable;
    }
    build();
    return {
        update(next) {
            if (!current) return;
            p = resolveProps(tileProps, next);
            const clickable = Boolean(p.onSelect) && typeof api?.command === 'function' && pick(TILE_STATES, p.state, 'none') !== 'locked';
            if (clickable !== current.clickable) {
                current.destroy();
                build();
            } else current.update();
        },
        destroy() {
            current?.destroy();
            current = null;
        },
    };
}

export const tile = defineWidget({ props: tileProps, primary: 'label', render: renderTile });
