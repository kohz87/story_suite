// The RPG section record the settings window adds after Features.

import { S, SECTION_ID } from '../settings/constants.js';
import { renderRpgSettings } from '../settings/page.js';

/** The section record the settings window adds after Features (window.js `extraSections`). `body(pane, ctx)` draws the page. */
export function rpgSection({ featureOn = () => true, ...deps } = {}) {
    return Object.freeze({
        id: SECTION_ID, label: S.title, icon: 'fa-dice-d20', title: S.title, sub: S.sub, after: 'features', visible: () => featureOn(),
        body: (pane, ctx) => renderRpgSettings(pane, { settings: ctx.options.settings, doc: ctx.doc, featureOn, onChange: () => ctx.changed?.(), ...deps }),
    });
}
