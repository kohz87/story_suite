// ss.bar: a labelled progress bar in the suite's bar colours, with the fill as a custom property.

import { BAR_STEPS, barStep, clamp, fmt, h, num, shell } from '../dom.js';
import { defineWidget, resolveProps } from '../props.js';
import { LABEL_MAX, short } from './shared-text.js';

/** The suite's bar colours (tokens --ss-hp, --ss-mp, --ss-sp, --ss-exp). */
export const BAR_KINDS = Object.freeze(['hp', 'mp', 'sp', 'exp']);

// ---- bar -------------------------------------------------------------------------------------------

const barProps = {
    value: { type: 'number', required: true, default: 0 },
    max: { type: 'number', default: 100 },
    label: { type: 'string', default: '' },
    kind: { type: 'string', default: '' },        // hp, mp, sp, exp
    text: { type: 'string', default: '' },        // the value as shown ("50 / 82" by default)
    showValue: { type: 'boolean', default: true },
};

/** The fill in [0, 1] (0 for an empty range). */
export function barRatio(value, max) {
    const top = num(max, 0);
    if (!(top > 0)) return 0;
    return clamp(num(value, 0) / top, 0, 1);
}

function renderBar(el, input) {
    let p = resolveProps(barProps, input);
    const view = shell(el, 'div', 'bar', ({ doc, root }) => {
        root.classList.add('ss-bar');
        root.setAttribute('role', 'meter');
        const head = h(doc, 'div', 'ss-bar-head');
        const label = h(doc, 'span', 'ss-bar-label');
        const value = h(doc, 'span', 'ss-bar-value');
        head.setAttribute('aria-hidden', 'true');
        head.append(label, value);
        const track = h(doc, 'div', 'ss-bar-track');
        track.appendChild(h(doc, 'div', 'ss-bar-fill'));
        root.append(head, track);
        function update() {
            for (const kind of BAR_KINDS) root.classList.remove(`ss-bar-${kind}`);
            if (BAR_KINDS.includes(p.kind)) root.classList.add(`ss-bar-${p.kind}`);
            // (a Health, Mana or Stamina strip dulls in steps as it empties, bars.css; the experience bar does not)
            for (const step of BAR_STEPS) root.classList.toggle(`ss-bar-step-${step}`, p.kind !== 'exp' && BAR_KINDS.includes(p.kind) && step === barStep(barRatio(p.value, num(p.max, 0))));
            const max = Math.max(0, num(p.max, 0));
            const now = clamp(num(p.value, 0), 0, max);
            const shown = p.text ? short(p.text, LABEL_MAX) : `${fmt(num(p.value, 0))} / ${fmt(max)}`;
            label.textContent = short(p.label, LABEL_MAX);
            label.hidden = !p.label;
            value.textContent = shown;
            value.hidden = !p.showValue;
            head.hidden = !p.label && !p.showValue;
            track.style.setProperty('--ss-fill', String(Math.round(barRatio(p.value, max) * 10000) / 10000));
            root.setAttribute('aria-label', short(p.label, LABEL_MAX) || 'Bar');
            root.setAttribute('aria-valuemin', '0');
            root.setAttribute('aria-valuemax', fmt(max));
            root.setAttribute('aria-valuenow', fmt(now));
            root.setAttribute('aria-valuetext', shown);
        }
        update();
        return { update };
    });
    return {
        update(next) {
            p = resolveProps(barProps, next);
            view.update();
        },
        destroy() { view.destroy(); },
    };
}

export const bar = defineWidget({ props: barProps, primary: 'value', render: renderBar });
