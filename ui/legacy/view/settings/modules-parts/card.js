// One module's card on the Modules page (and the Diagnostics page): panels, folds, settings, search and focus.

import { FEATURE_TEXT, SUB_FOLD, featuresFoldOf } from '../../../host-ui.js';
import { LIFE_TEXT } from '../../../../../../../core/persist/compat.js';
import { featureOf } from '../../../../../../../core/features.js';
import { fill } from '../../../../../../../core/strings.js';
import { newId, sectionBlock } from '../../form/fields.js';
import { renderModuleForm } from '../../form/form.js';
import { matchesSearch } from '../../form/schema.js';
import { routeOf } from '../sections.js';
import { showAndFocus } from '../../scroll.js';
import { FOLD_ABOVE, MODULES_TEXT, KNOWN_DESCRIPTIONS } from './text.js';
import { h, clean, CUT, clip } from './shared-draw.js';
import { moduleSchema, parseGroup } from './schema.js';

/**
 * One module's card (the Modules page's, and the Diagnostics page's for a module whose settings are placed there). `env` is
 * { doc, registry, settings, sdk, features, openState, changed(), open(key) } (what the page was given); `sdef` the module's registry
 * settings entry or null; `placed`: 'diagnostics' draws a module whose settings are placed in Diagnostics (a Modules card leaves those
 * out); `collapsible` makes the card a fold (closed until opened; its state in `openState` under the module's id).
 * → { id, el, card, form, filter(text) → count, refresh(), destroy(), has(key), open(key), groups, folds }.
 */
export function createModuleCard(env, mod, sdef = null, { placed = null, collapsible = false } = {}) {
    const { doc, registry, settings, sdk = null, features = null, openState = null } = env;
    const featureList = () => { try { return typeof features?.list === 'function' ? features.list() : []; } catch { return []; } };
    const hiddenByFeature = item => {
        const id = featureOf(item);
        return id !== null && typeof registry.featureOn === 'function' && !registry.featureOn(id);
    };
    const here = Boolean(sdef) && (placed === 'diagnostics' ? sdef.place === 'diagnostics' : sdef.place !== 'diagnostics');
    const title = clip(mod.name, CUT.name) || clip(mod.id, CUT.name);
    const hint = clip(mod.version, CUT.version) ? `v${clip(mod.version, CUT.version)}` : '';
    let searching = false;
    const wasOpen = collapsible && openState instanceof Map ? openState.get(mod.id) === true : false;
    const card = sectionBlock(doc, { title, hint, id: newId(`module-${mod.id}`), collapsible, open: wasOpen });
    card.el.classList.add('ss-module-card');
    card.el.dataset.fold = mod.id;
    card.el.dataset.module = mod.id;
    // A fold's heading is its summary; a card's is its title.
    const heading = collapsible ? card.el.querySelector('summary') : card.title;
    if (!collapsible) card.title.tabIndex = -1;
    if (collapsible) {
        card.el.classList.add('ss-section-fold');
        card.el.classList.toggle('ss-section-fold-open', wasOpen);
        card.el.addEventListener('toggle', () => {
            card.el.classList.toggle('ss-section-fold-open', card.el.open === true);
            // A search opens the cards with a match: that is not the reader's choice, which comes back when the search ends.
            if (!searching && openState instanceof Map) openState.set(mod.id, card.el.open === true);
        });
    }
    const entry = { id: mod.id, mod, panelTitle: '', card, form: null, panel: null, panelBox: null, link: null, folds: [], groups: [], description: clip(mod.description || KNOWN_DESCRIPTIONS[mod.id], CUT.description) };
    if (entry.description) card.body.appendChild(h(doc, 'p', 'ss-card-help ss-module-description', entry.description));
    // Where the module stands when it is not running (dormant: what it waits for; a restore pending), read-only.
    entry.status = h(doc, 'p', 'ss-card-help ss-module-status');
    card.body.appendChild(entry.status);
    entry.paintStatus = () => {
        let life = null;
        try { life = registry.lifecycle?.(mod.id) ?? null; } catch { life = null; }
        const quiet = !life || life.status === 'ready';
        entry.status.hidden = quiet;
        entry.status.dataset.status = quiet ? 'ready' : life.status;
        entry.status.textContent = quiet ? '' : `${LIFE_TEXT[life.status] ?? life.status}${life.reason ? `: ${clip(life.reason, CUT.description)}` : ''}`;
    };
    entry.paintStatus();
    // The line to this module's features (their switches are on the Features page).
    entry.link = h(doc, 'button', 'ss-button ss-button-quiet ss-module-features');
    entry.link.type = 'button';
    entry.link.addEventListener('click', () => env.open?.(featuresFoldOf(mod.id)));
    card.body.appendChild(entry.link);
    entry.paintLink = () => {
        const list = featureList().filter(feature => feature.moduleId === mod.id);
        entry.link.hidden = !list.length;
        if (!list.length) return;
        const on = list.filter(feature => feature.on === true && feature.available !== false).length;
        entry.link.textContent = fill(FEATURE_TEXT.link, { on, n: list.length });
        entry.link.title = fill(FEATURE_TEXT.linkTitle, { name: mod.name ?? mod.id, on, n: list.length });
        entry.link.setAttribute('aria-label', entry.link.title);
    };
    entry.paintLink();
    if (here) {
        // Its custom panel (not a schema field: the module draws it), embedded as it was drawn in the fold, with its title as a heading.
        const panelApi = Object.freeze({
            get: key => settings(mod.id)[key],
            set: (key, value) => settings.set(mod.id, key, value),
            values: () => settings(mod.id),
            sdk,
        });
        if (sdef.section && (placed === 'diagnostics' || routeOf({ type: 'panel', moduleId: mod.id }) === 'modules')) {
            const box = h(doc, 'div', 'ss-module-panel');
            const heading4 = sdef.title !== (mod.name ?? mod.id) ? h(doc, 'h4', 'story-suite-section-title', sdef.title) : null;
            const section = h(doc, 'div', 'story-suite-section');
            section.dataset.module = mod.id;
            box.append(...[heading4, section].filter(Boolean));
            entry.panelBox = box;
            entry.panelTitle = sdef.title;
            // What the module's section function returned is its unmount (NPC State Delta returns one): it takes the module's own nodes
            // back out of the section. It runs before the section is cleared and again when the card goes, so the module finds its panel
            // in the page on the next draw instead of a node this card has detached.
            let release = null;
            const unmount = () => {
                const done = release;
                release = null;
                try { done?.(); } catch { /* a module's unmount that fails does not keep the card from drawing */ }
            };
            entry.release = unmount;
            entry.panel = () => {
                unmount();
                section.replaceChildren();
                box.hidden = hiddenByFeature(sdef.section);
                if (box.hidden) return;
                try {
                    const back = sdef.section(section, panelApi);
                    release = typeof back === 'function' ? back : null;
                } catch (error) {
                    section.replaceChildren(h(doc, 'p', 'story-suite-muted', fill(MODULES_TEXT.panelFailed, { name: mod.name ?? mod.id, why: error?.message ?? error })));
                }
            };
            entry.panel();
            card.body.appendChild(box);
        }
        // Its own folds (Story Block's Packs and Events are other pages'), each a sub-card with its title.
        if (placed === 'diagnostics' || routeOf({ type: 'own-fold', moduleId: mod.id }) === 'modules') {
            for (const item of sdef.folds ?? []) {
                if (item.place === 'diagnostics') continue;
                const sub = sectionBlock(doc, { title: item.title, hint: item.hint, id: newId(`own-${mod.id}-${item.id}`), level: 4 });
                sub.el.classList.add('ss-module-own');
                sub.el.dataset.fold = `${mod.id}/${item.id}`;
                sub.title.tabIndex = -1;
                try { item.render(sub.body, panelApi); } catch (error) {
                    sub.body.replaceChildren(h(doc, 'p', 'story-suite-muted', fill(MODULES_TEXT.panelFailed, { name: mod.name ?? mod.id, why: error?.message ?? error })));
                }
                entry.folds.push({ id: item.id, key: `${mod.id}/${item.id}`, sub, title: item.title, hint: item.hint ?? '' });
                card.body.appendChild(sub.el);
            }
        }
        // Its settings: a group each, folded when there are many.
        const { schema, count, groups } = moduleSchema(mod.id, sdef.schema);
        entry.groups = groups;
        if (count) {
            const fold = groups.length > 1 && count > FOLD_ABOVE ? { prefix: `${mod.id}::group:`, state: openState, openFirst: true } : null;
            entry.form = renderModuleForm(card.body, { ...sdef, schema, title: '' }, {
                settings, doc, quiet: true, className: 'ss-module-form', fold, featureOn: id => (typeof registry.featureOn === 'function' ? registry.featureOn(id) : true),
                onChange: () => env.changed?.(),
            });
        }
    }
    const nameHit = text => matchesSearch(`module.${mod.id}`, { label: `${clean(mod.name)} ${mod.id}`, help: entry.description }, '', text);
    Object.assign(entry, {
        el: card.el,
        /** Shows what matches `text` (the module's own name shows everything of it); returns how many matches it shows, 0 hides the card. */
        filter(text) {
            const query = String(text ?? '').trim();
            searching = Boolean(query);
            if (!query) {
                entry.form?.filter('');
                card.setHidden(false);
                for (const own of entry.folds) own.sub.setHidden(false);
                return 0;
            }
            const byName = nameHit(text);
            const rows = entry.form ? entry.form.filter(byName ? '' : text) : 0;
            const folds = entry.folds.filter(own => matchesSearch(own.key, { label: own.title, help: own.hint }, mod.name ?? mod.id, text));
            for (const own of entry.folds) own.sub.setHidden(!byName && !folds.includes(own));
            const panel = Boolean(entry.panelBox) && !entry.panelBox.hidden && matchesSearch(`${mod.id}${SUB_FOLD}panel`, { label: entry.panelTitle, help: '' }, mod.name ?? mod.id, text);
            const hit = byName || rows > 0 || folds.length > 0 || panel;
            card.setHidden(!hit);
            // A match opens a card that is a fold; the reader's own choice comes back with an empty search.
            if (collapsible && hit) card.el.open = true;
            return hit ? (byName ? Math.max(rows, 1) : rows) + folds.length + (panel ? 1 : 0) : 0;
        },
        refresh() {
            entry.paintStatus();
            entry.paintLink();
            entry.panel?.();
            entry.form?.refresh();
        },
        destroy() {
            entry.release?.();
            entry.form?.destroy();
        },
        has(key) {
            if (key === mod.id) return true;
            const group = parseGroup(key);
            if (group) return group.id === mod.id && entry.groups.includes(group.group);
            return entry.folds.some(own => own.key === key);
        },
        open(key) {
            const group = parseGroup(key);
            if (collapsible) {
                card.el.open = true;
                card.el.classList.add('ss-section-fold-open');
                if (openState instanceof Map) openState.set(mod.id, true);
            }
            if (group) {
                const el = entry.form?.openGroup(group.group) ?? null;
                if (!el) return false;
                return showAndFocus(el.querySelector('summary') ?? el.querySelector('.ss-section-title, input, select, textarea, button'));
            }
            const own = entry.folds.find(item => item.key === key);
            if (own) return showAndFocus(own.sub.title);
            return key === mod.id ? showAndFocus(heading) : false;
        },
    });
    if (collapsible) {
        // Closing the search gives the card back as the reader left it.
        const restore = () => { card.el.open = openState instanceof Map ? openState.get(mod.id) === true : false; card.el.classList.toggle('ss-section-fold-open', card.el.open === true); };
        entry.restore = restore;
    }
    return entry;
}
