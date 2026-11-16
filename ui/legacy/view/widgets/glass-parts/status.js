// ss.status: a status effect as an icon in a tinted square with its time left, spoken in full words.

import { fmt, h, iconNode, setData, shell } from '../dom.js';
import { defineWidget, resolveProps } from '../props.js';
import { setGlassTone } from './tones.js';
import { LABEL_MAX, pick, short } from './shared-text.js';

/** Units a status's time left may be in; `minutes` are story minutes. */
export const STATUS_UNITS = Object.freeze(['turns', 'rounds', 'minutes']);

// ---- status badge ----------------------------------------------------------------------------------

const statusProps = {
    label: { type: 'string', required: true, default: '' }, // "Bleeding"
    icon: { type: 'string', default: '' },
    left: { type: 'number', default: null },                // the time left; null: no set end (∞)
    unit: { type: 'string', default: 'turns' },             // turns, rounds or (story) minutes
    tone: { type: 'string', default: 'accent' },
    id: { type: 'string', default: '' },
    kind: { type: 'string', default: '' },
};

/**
 * The time left as shown in the corner: turns and rounds "2t" / "2r"; story minutes "40m", whole hours
 * "3h" (rounded down from 60 minutes), whole days "2d" (from 48 hours); none "∞"; more than 99 of a
 * unit "99+".
 */
export function leftText(left, unit = 'turns') {
    if (left === null || left === undefined || left === '' || !Number.isFinite(Number(left))) return '∞';
    const n = Math.max(0, Math.floor(Number(left)));
    const cap = (value, suffix) => (value > 99 ? `99+${suffix}` : `${value}${suffix}`);
    if (unit === 'minutes') {
        if (n < 60) return cap(n, 'm');
        if (n < 48 * 60) return cap(Math.floor(n / 60), 'h');
        return cap(Math.floor(n / 1440), 'd');
    }
    return cap(n, unit === 'rounds' ? 'r' : 't');
}

/** The time left in words: "2 turns left", "1 round left", "40 story minutes left", "no set end". */
export function leftSpoken(left, unit = 'turns') {
    if (left === null || left === undefined || left === '' || !Number.isFinite(Number(left))) return 'no set end';
    const n = Math.max(0, Math.floor(Number(left)));
    const word = unit === 'minutes' ? (n === 1 ? 'minute' : 'minutes') : unit === 'rounds' ? (n === 1 ? 'round' : 'rounds') : n === 1 ? 'turn' : 'turns';
    return `${fmt(n)} ${word} left`;
}

function renderStatus(el, input) {
    let p = resolveProps(statusProps, input);
    const view = shell(el, 'span', 'status', ({ doc, root }) => {
        root.classList.add('ss-status');
        root.setAttribute('role', 'img');
        const icon = h(doc, 'span', 'ss-status-icon');
        const left = h(doc, 'span', 'ss-status-left');
        icon.setAttribute('aria-hidden', 'true');
        left.setAttribute('aria-hidden', 'true');
        root.append(icon, left);
        function update() {
            const unit = pick(STATUS_UNITS, p.unit, 'turns');
            setGlassTone(root, p.tone, 'accent');
            setData(root, 'kind', p.kind);
            const glyph = iconNode(doc, p.icon);
            icon.replaceChildren(...(glyph ? [glyph] : []));
            if (!glyph) icon.textContent = Array.from(short(p.label, LABEL_MAX))[0] ?? '?';
            // A condition with no count (no set end) shows no counter at all, as the old badges did: the "∞" is only in the words.
            const counted = p.left !== null && p.left !== undefined && p.left !== '' && Number.isFinite(Number(p.left));
            left.hidden = !counted;
            left.textContent = counted ? leftText(p.left, unit) : '';
            // the name a screen reader says: "Bleeding, 10 minutes left"
            const spoken = `${short(p.label, LABEL_MAX) || 'Status'}, ${leftSpoken(p.left, unit)}`;
            root.setAttribute('aria-label', spoken);
            root.setAttribute('title', spoken);
        }
        update();
        return { update };
    });
    return {
        update(next) {
            p = resolveProps(statusProps, next);
            view.update();
        },
        destroy() { view.destroy(); },
    };
}

export const status = defineWidget({ props: statusProps, primary: 'left', render: renderStatus });
