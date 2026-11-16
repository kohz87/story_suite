// The Assist page's body: the form, the recent-runs card and the search and focus handles.

import { SETTING } from '../../../../../packages/story-block/src/v2/assist/common.js';
import { renderAssistSection } from '../../../../../packages/story-block/src/v2/assist/section.js';
import { renderSettingsForm } from '../../form/form.js';
import { matchesSearch } from '../../form/schema.js';
import { sectionBlock } from '../../form/fields.js';
import { showAndFocus } from '../../scroll.js';
import { ASSIST_MODULE, ASSIST_FOLD, ASSIST_TEXT } from './text.js';
import { assistSchema } from './schema.js';

/** The Assist body: `(pane, ctx) → { filter, refresh, destroy, has, open }` (bodies.js). */
export function assistBody(pane, ctx) {
    const { registry, settings, features = null, sdk = null, profiles = null } = ctx.options;
    const def = typeof registry?.settingsDefs === 'function' ? registry.settingsDefs().find(item => item.moduleId === ASSIST_MODULE) : null;
    const hasPart = Boolean(def?.schema && Object.hasOwn(def.schema, SETTING.profile));
    const list = () => { try { return typeof features?.list === 'function' ? features.list() : []; } catch { return []; } };
    const featureOf = id => list().find(feature => feature.id === id);
    const on = id => { try { return typeof features?.on === 'function' ? features.on(id) === true : featureOf(id)?.on === true; } catch { return false; } };
    const hostSettings = Object.assign(() => settings(null), { set: settings.set });
    const { schema, sources } = hasPart ? assistSchema({ featureOf, on, hostSettings, features }) : { schema: {}, sources: {} };
    const form = renderSettingsForm(pane, {
        moduleId: ASSIST_MODULE, schema, settings, doc: ctx.doc, quiet: true, className: 'ss-assist-page', sources, profiles,
        onChange: () => ctx.changed?.(),
    });
    // What the helpers did lately: the old panel (a status read from the part, with its own Refresh), in a card of its own.
    const runs = sectionBlock(ctx.doc, { title: ASSIST_TEXT.runsTitle, hint: ASSIST_TEXT.runsHint });
    runs.el.classList.add('ss-assist-runs-card');
    const drawRuns = () => {
        runs.body.replaceChildren();
        renderAssistSection(runs.body, () => {
            try { return sdk?.query?.('assist.status') ?? { runs: [] }; } catch { return { runs: [] }; }
        });
    };
    if (hasPart) {
        drawRuns();
        pane.appendChild(runs.el);
    }
    // The value wall, stated plainly under the kinds (the code decides it; there is nothing to set).
    if (hasPart && form.field(SETTING.extractorKinds)) {
        const card = form.field(SETTING.extractorKinds).row.parentNode;
        for (const text of [ASSIST_TEXT.wall, ASSIST_TEXT.late]) {
            const line = ctx.doc.createElement('p');
            line.className = 'ss-assist-wall';
            line.textContent = text;
            card.appendChild(line);
        }
    }
    const first = () => {
        const key = form.keys()[0];
        return key ? form.field(key).row.querySelector('input, select, textarea, button') : null;
    };
    return {
        filter(text) {
            const shown = form.filter(text);
            const match = hasPart && matchesSearch('assist.runs', { label: ASSIST_TEXT.runsTitle, help: ASSIST_TEXT.runsHint }, 'Assist', text);
            runs.setHidden(!match);
            return shown + (hasPart && match && String(text ?? '').trim() ? 1 : 0);
        },
        refresh() {
            form.refresh();
            if (hasPart) drawRuns();
        },
        destroy() {
            form.destroy();
            runs.el.remove();
        },
        has: key => key === ASSIST_FOLD,
        open() {
            const input = first();
            return showAndFocus(input, 'center');
        },
    };
}
