// The Money page's body: the form and its search and focus handles.

import { renderSettingsForm } from '../../form/form.js';
import { showAndFocus } from '../../scroll.js';
import { MONEY_MODULE, MONEY_FOLD } from './names.js';
import { moneySchema } from './schema.js';

/** The Money body: `(pane, ctx) → { filter, refresh, destroy, has, open }` (bodies.js). */
export function moneyBody(pane, ctx) {
    const { registry, settings } = ctx.options;
    const def = typeof registry?.settingsDefs === 'function' ? registry.settingsDefs().find(item => item.moduleId === MONEY_MODULE) : null;
    const form = renderSettingsForm(pane, {
        moduleId: MONEY_MODULE, schema: moneySchema(def?.schema), settings, doc: ctx.doc, quiet: true, className: 'ss-money',
        fold: { prefix: 'money::', only: ['Advanced'], openFirst: false },
    });
    return {
        filter: text => form.filter(text),
        refresh: () => form.refresh(),
        destroy: () => form.destroy(),
        has: key => key === MONEY_FOLD,
        open() {
            const first = form.keys()[0];
            const input = first ? form.field(first).row.querySelector('input, select, textarea, button') : null;
            return showAndFocus(input, 'center');
        },
    };
}
