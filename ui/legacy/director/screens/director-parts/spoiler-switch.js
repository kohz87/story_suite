// Story Director v2, part screens: the header spoiler switch widget that hides or shows the Director screen's spoiler group.

import { spoilerPreference } from './spoiler-preference.js';

export const SPOILER_WIDGET = 'story-director.spoiler-switch';

/** The header switch and the restore line operate on the Director screen's spoiler group. */
export function createSpoilerSwitchWidget({ preference = spoilerPreference } = {}) {
    return Object.freeze({
        props: Object.freeze({}),
        validate: () => [],
        render(el) {
            const root = el.closest('.sd-director');
            const group = root?.querySelector('.sd-spoilers');
            const note = root?.querySelector('.sd-spoiler-note');
            const toggle = (el.ownerDocument ?? globalThis.document).createElement('button');
            toggle.className = 'ss-pill sd-spoil';
            toggle.setAttribute('type', 'button');
            toggle.setAttribute('role', 'switch');
            toggle.setAttribute('aria-label', 'Show spoilers');
            el.replaceChildren(toggle);
            const draw = () => {
                const shown = preference.shown();
                toggle.setAttribute('aria-checked', String(shown));
                toggle.textContent = shown ? 'shows spoilers' : 'spoilers hidden';
                if (group) group.hidden = !shown;
                if (note) note.hidden = shown;
            };
            const change = event => { event?.stopPropagation?.(); preference.set(!preference.shown()); };
            const show = event => { event?.stopPropagation?.(); preference.set(true); toggle.focus?.(); };
            toggle.addEventListener('click', change);
            note?.addEventListener('click', show);
            const off = preference.subscribe(draw);
            draw();
            return { destroy() { off(); note?.removeEventListener('click', show); toggle.removeEventListener('click', change); toggle.remove(); } };
        },
    });
}

export const spoilerSwitchWidget = createSpoilerSwitchWidget();
