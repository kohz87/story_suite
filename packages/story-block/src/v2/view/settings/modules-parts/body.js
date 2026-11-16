// The Modules page's body: a card per module, the Versions card, and the search and focus handles.

import { VERSIONS_FOLD } from '../../../host-ui.js';
import { compatReport, renderCompat } from '../../../../../../../core/persist/compat.js';
import { fill } from '../../../../../../../core/strings.js';
import { newId, sectionBlock } from '../../form/fields.js';
import { matchesSearch } from '../../form/schema.js';
import { showAndFocus } from '../../scroll.js';
import { MODULES_TEXT } from './text.js';
import { h } from './shared-draw.js';
import { parseGroup } from './schema.js';
import { createModuleCard } from './card.js';

/** The Modules body: `(pane, ctx) → { filter, refresh, destroy, has, open }` (bodies.js). */
export function modulesBody(pane, ctx) {
    const { doc } = ctx;
    const { registry } = ctx.options;
    const root = h(doc, 'div', 'ss-modules');
    pane.appendChild(root);
    const settingsOf = new Map((typeof registry.settingsDefs === 'function' ? registry.settingsDefs() : []).map(def => [def.moduleId, def]));
    const env = { ...ctx.options, doc, openState: ctx.openState, changed: () => ctx.changed?.(), open: key => ctx.open?.(key) };
    const cards = [];
    const mods = typeof registry.modules === 'function' ? registry.modules() : [];
    for (const mod of mods) {
        const entry = createModuleCard(env, mod, settingsOf.get(mod.id) ?? null, { collapsible: true });
        cards.push(entry);
        root.appendChild(entry.el);
    }

    // Versions: a small card at the end.
    const versions = sectionBlock(doc, { title: MODULES_TEXT.versionsTitle, id: newId('versions') });
    versions.el.classList.add('ss-versions-card');
    versions.el.dataset.fold = VERSIONS_FOLD;
    versions.title.tabIndex = -1;
    function paintVersions() {
        const report = compatReport({ hostVersion: registry.hostVersion?.() ?? '', modules: registry.modules(), refusals: registry.refusals?.() ?? [], lifecycle: id => registry.lifecycle?.(id) ?? null });
        const hint = report.outOfStep ? fill(MODULES_TEXT.outOfStep, { n: report.outOfStep }) : MODULES_TEXT.inStep;
        // The hint sits in the head: rebuilt with the card's body.
        let note = versions.el.querySelector('.ss-section-hint');
        if (!note) {
            note = h(doc, 'small', 'ss-section-hint');
            versions.el.querySelector('.ss-section-head').appendChild(note);
        }
        note.textContent = hint;
        versions.el.classList.toggle('ss-versions-warn', report.outOfStep > 0);
        renderCompat(versions.body, report, { doc });
    }
    paintVersions();
    root.appendChild(versions.el);

    // A module whose settings are placed in Diagnostics is that page's: its card here says nothing of them and is not a fold target.
    const mine = key => !settingsOf.get(key)?.place || settingsOf.get(key).place !== 'diagnostics';
    return {
        filter(text) {
            const query = String(text ?? '').trim();
            let shown = 0;
            for (const entry of cards) {
                shown += entry.filter(text);
                if (!query) entry.restore?.();
            }
            const versionsHit = matchesSearch('versions', { label: MODULES_TEXT.versionsTitle, help: '' }, 'Modules', text);
            versions.setHidden(Boolean(query) && !versionsHit);
            return shown + (query && versionsHit ? 1 : 0);
        },
        refresh() {
            for (const entry of cards) entry.refresh();
            paintVersions();
        },
        destroy() {
            for (const entry of cards) entry.destroy();
            root.remove();
        },
        has(key) {
            if (key === VERSIONS_FOLD) return true;
            const group = parseGroup(key);
            const id = group ? group.id : cards.find(entry => entry.id === key || entry.has(key))?.id;
            return Boolean(id) && cards.some(entry => entry.id === id && mine(id) && entry.has(key));
        },
        open(key) {
            if (key === VERSIONS_FOLD) return showAndFocus(versions.title);
            const entry = cards.find(item => item.has(key));
            return entry ? entry.open(key) : false;
        },
    };
}
