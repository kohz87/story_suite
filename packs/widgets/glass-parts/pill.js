// ss.pill: a short text in a pill (solid, soft or outline), with an optional icon.

import { h, iconNode, shell } from '../dom.js';
import { defineWidget, resolveProps } from '../props.js';
import { pick, short } from './shared-text.js';

export const PILL_STYLES = Object.freeze(['solid', 'soft', 'outline']);

// ---- pill ------------------------------------------------------------------------------------------

const pillProps = {
    text: { type: 'string', required: true, default: '' },
    icon: { type: 'string', default: '' },
    style: { type: 'string', default: 'solid' },   // solid, soft, outline
};

function renderPill(el, input) {
    let p = resolveProps(pillProps, input);
    const view = shell(el, 'span', 'pill', ({ doc, root }) => {
        root.classList.add('ss-pill');
        const icon = h(doc, 'span', 'ss-pill-icon');
        icon.setAttribute('aria-hidden', 'true');
        const text = h(doc, 'span', 'ss-pill-text');
        root.append(icon, text);
        function update() {
            const style = pick(PILL_STYLES, p.style, 'solid');
            root.classList.toggle('ss-pill-soft', style === 'soft');
            root.classList.toggle('ss-pill-outline', style === 'outline');
            const glyph = iconNode(doc, p.icon);
            icon.replaceChildren(...(glyph ? [glyph] : []));
            icon.hidden = !glyph;
            text.textContent = short(p.text, 120);
        }
        update();
        return { update };
    });
    return {
        update(next) {
            p = resolveProps(pillProps, next);
            view.update();
        },
        destroy() { view.destroy(); },
    };
}

export const pill = defineWidget({ props: pillProps, primary: 'text', render: renderPill });
