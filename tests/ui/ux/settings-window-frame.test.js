import test from "node:test";
import assert from "node:assert/strict";
import { FEATURES_FOLD, HOST_FOLD, OPEN_CLASS, VERSIONS_FOLD, featuresFoldOf } from "../../../src/v2/host-ui.js";
import { SECTION_BODIES } from "../../../src/v2/view/settings/bodies.js";
import { DEFAULT_SECTION, SECTION_IDS, SETTINGS_SECTIONS, WINDOW_TEXT, opensByDefault, routeOf } from "../../../src/v2/view/settings/sections.js";
import { cardOf, diagnosticsDrawn, foldAt, foldsOf, open, page, railItems, shownPages, texts } from "./settings-window.helpers.js";

test('the sections, in the concept\'s order, each with an icon, a title and a line under it', () => {
    assert.deepEqual(SECTION_IDS, ['look', 'features', 'money', 'assist', 'tabs', 'blocks', 'modules', 'diagnostics']);
    assert.deepEqual(SETTINGS_SECTIONS.map(section => section.label), ['Look', 'Features', 'Money', 'Assist', 'Tabs & Packs', 'Blocks', 'Modules', 'Diagnostics']);
    assert.equal(DEFAULT_SECTION, 'features', 'opens on Features though Look is first in the rail');
    for (const section of SETTINGS_SECTIONS) {
        assert.match(section.icon, /^fa-[a-z-]+$/);
        assert.ok(section.title && section.sub.length > 10, section.id);
    }
    assert.deepEqual(Object.keys(SECTION_BODIES), SECTION_IDS, 'a body for each section');
});

test('today\'s folds go to the section they belong to', () => {
    assert.equal(routeOf({ type: 'features' }), 'features');
    assert.equal(routeOf({ type: 'host' }), 'tabs');
    assert.equal(routeOf({ type: 'own-fold', moduleId: 'story-block' }), 'tabs', 'Packs');
    assert.equal(routeOf({ type: 'own-fold', moduleId: 'other' }), 'modules');
    assert.equal(routeOf({ type: 'group', moduleId: 'story-block', group: 'General' }), 'money');
    assert.equal(routeOf({ type: 'group', moduleId: 'story-block', group: 'Assist' }), 'assist');
    assert.equal(routeOf({ type: 'group', moduleId: 'story-block', group: 'Inner chatter' }), 'modules');
    assert.equal(routeOf({ type: 'panel', moduleId: 'story-block' }), 'assist');
    assert.equal(routeOf({ type: 'group', moduleId: 'rpg-battle', group: 'General' }), 'modules', 'only Story Block\'s own General group is Money');
    assert.equal(routeOf({ type: 'panel', moduleId: 'rpg-battle' }), 'modules');
    assert.equal(routeOf({ type: 'module', moduleId: 'rpg-battle' }), 'modules');
    assert.equal(routeOf({ type: 'diagnostics' }), 'diagnostics');
    assert.equal(routeOf({ type: 'versions' }), 'modules');
    assert.equal(routeOf(null), 'modules');
    assert.equal(opensByDefault(FEATURES_FOLD), false, 'Features is not a fold any more');
    assert.equal(opensByDefault('story-block::group:Assist'), true);
    assert.equal(opensByDefault('rpg-battle'), false);
});

test('the frame: a dialog with the title, the search and the rail in its side, Close at its top right and one page per section, each labelled by its heading', async () => {
    const { doc, root, win, host } = await open();
    assert.equal(root.id, 'story_suite_v2_overlay');
    assert.ok(root.classList.contains('story-suite-overlay'), 'a Story Suite root, so the tokens reach it');
    assert.ok(doc.body.classList.contains(OPEN_CLASS));
    const frame = root.querySelector('.ss-settings');
    assert.equal(frame.getAttribute('role'), 'dialog');
    assert.equal(frame.getAttribute('aria-modal'), 'true');
    assert.equal(frame.getAttribute('aria-labelledby'), 'story_suite_v2_overlay_title');
    assert.equal(root.querySelector('#story_suite_v2_overlay_title').textContent, WINDOW_TEXT.title);
    // Close first (it sits at the window's top right on every width), then the side (the title, the search under it, the
    // rail), then the page. The concept's layout: the search is in the rail under the title.
    assert.deepEqual(frame.children.map(node => node.className), ['ss-settings-close story-suite-close', 'ss-settings-side', 'ss-settings-content', 'ss-settings-foot']);
    const side = root.querySelector('.ss-settings-side');
    assert.deepEqual(side.children.map(node => node.className), ['ss-settings-title', 'ss-search ss-settings-search', 'ss-settings-rail']);
    assert.equal(side.children[1].getAttribute('role'), 'search');
    assert.equal(side.querySelector('label').textContent, WINDOW_TEXT.searchLabel);
    assert.equal(side.querySelector('.ss-search-input').placeholder, WINDOW_TEXT.searchPlaceholder);
    const close = root.querySelector('.ss-settings-close');
    assert.equal(close.tagName, 'BUTTON');
    assert.equal(close.getAttribute('aria-label'), WINDOW_TEXT.close);
    assert.ok(close.classList.contains('story-suite-close'));
    // One page per section, in the rail's order, each a labelled region named by its heading.
    const pages = root.querySelectorAll('.ss-settings-page');
    assert.deepEqual(pages.map(node => node.dataset.ssSection), SECTION_IDS);
    for (const node of pages) {
        assert.equal(node.tagName, 'SECTION');
        const heading = root.querySelectorAll('h3').find(h => h.id === node.getAttribute('aria-labelledby'));
        assert.ok(heading, `${node.dataset.ssSection} has its heading`);
        assert.equal(heading.textContent, SETTINGS_SECTIONS.find(section => section.id === node.dataset.ssSection).title);
    }
    // The rail: the tabs block, a nav of buttons; only the default page (Features, though Look is first) shows.
    const nav = root.querySelector('.ss-settings-rail nav');
    assert.equal(nav.getAttribute('aria-label'), WINDOW_TEXT.railLabel);
    assert.deepEqual(texts(nav, '.ss-tabs-label'), SETTINGS_SECTIONS.map(section => section.label));
    assert.deepEqual(shownPages(root), ['features']);
    assert.equal(win.section(), 'features');
    close.click();
    assert.equal(doc.querySelector('#story_suite_v2_overlay'), null);
    assert.ok(!doc.body.classList.contains(OPEN_CLASS));
    assert.equal(win.isOpen(), false);
    host.close();
});

test('the rail: aria-current on the chosen section, one Tab stop, arrow keys move along it, a click or Enter shows the page', async () => {
    const { root, win, host, doc } = await open();
    const items = () => railItems(root);
    assert.equal(items().length, 8);
    assert.deepEqual(items().map(node => node.getAttribute('aria-current')), [null, 'page', null, null, null, null, null, null]);
    assert.deepEqual(items().map(node => node.getAttribute('tabindex')), ['-1', '0', '-1', '-1', '-1', '-1', '-1', '-1'], 'roving tabindex');
    assert.ok(doc.activeElement === items()[1], 'the window opens with the focus on the rail\'s chosen item');
    // Arrow keys move the focus (and the Tab stop), not the choice.
    items()[1].dispatch('keydown', { key: 'ArrowDown' });
    assert.ok(doc.activeElement === items()[2]);
    assert.equal(items()[2].getAttribute('tabindex'), '0');
    assert.equal(items()[1].getAttribute('tabindex'), '-1');
    assert.deepEqual(shownPages(root), ['features']);
    items()[2].dispatch('keydown', { key: 'End' });
    assert.ok(doc.activeElement === items()[7]);
    items()[7].dispatch('keydown', { key: 'ArrowRight' });
    assert.ok(doc.activeElement === items()[0], 'wraps to Look, the first');
    // Choosing: the page, aria-current and the stop follow.
    items()[4].focus();
    items()[4].click();
    assert.deepEqual(shownPages(root), ['tabs']);
    assert.equal(win.section(), 'tabs');
    assert.deepEqual(items().map(node => node.getAttribute('aria-current')), [null, null, null, null, 'page', null, null, null]);
    assert.equal(items()[4].getAttribute('tabindex'), '0');
    items()[0].focus();
    items()[0].click();
    assert.deepEqual(shownPages(root), ['look'], 'Look, first in the rail, is a page like the others');
    assert.equal(win.select('nonsense'), 'features', 'an unknown section is the default one');
    host.close();
});

test('each section holds what it should: every section is the form engine\'s', async () => {
    const { root, host, win } = await open();
    await diagnosticsDrawn(root, win);
    assert.deepEqual(foldsOf(root, 'look'), [], 'no folds: the form engine');
    assert.deepEqual(foldsOf(root, 'features'), [], 'no folds: the form engine');
    assert.equal(root.querySelector('details[data-fold="story-suite-features"]'), null, 'the old Features fold is gone');
    assert.ok(page(root, 'features').querySelector('.ss-features-group'));
    assert.deepEqual(foldsOf(root, 'tabs'), [], 'the form engine: Tabs, Packs and Prompt cards, no fold');
    assert.equal(foldAt(root, HOST_FOLD), undefined, 'Story Suite\'s own fold is gone');
    assert.deepEqual(texts(page(root, 'tabs'), '.ss-section-title').filter(Boolean), ['Tabs', 'Packs', 'Prompt']);
    assert.deepEqual(foldsOf(root, 'modules'), [], 'the form engine: a card per module, then Versions');
    assert.deepEqual(page(root, 'modules').querySelectorAll('.ss-module-card').map(node => node.dataset.module), ['loot', 'rpg-battle', 'story-block']);
    assert.equal(page(root, 'modules').querySelector('.ss-versions-card').dataset.fold, VERSIONS_FOLD);
    assert.deepEqual(foldsOf(root, 'diagnostics'), [], 'the form engine: Events as a fold card (no report without a source)');
    assert.equal(page(root, 'diagnostics').querySelector('.ss-diagnostics-fold[data-fold="story-block/events"]').open, false, 'folded until opened');
    assert.deepEqual(foldsOf(root, 'money'), [], 'the form engine');
    assert.equal(page(root, 'money').querySelectorAll('details').length, 1);
    assert.equal(root.querySelector('details[data-fold="story-block::group:General"]'), null, 'the General group is the Money page now');
    assert.deepEqual(foldsOf(root, 'assist'), [], 'the form engine');
    assert.equal(root.querySelector('details[data-fold="story-block::group:Assist"]'), null, 'the Assist group is the Assist page now');
    assert.ok(page(root, 'assist').querySelector('.ss-assist-page .ss-field[data-field="assistExtractorKinds"]'), 'the safety net\'s kinds');
    assert.ok(page(root, 'assist').querySelector('.ss-assist-runs-card .ss-assist'), 'the old Assist panel, as Recent runs');
    // What is left of Story Block's settings stays in its card in Modules, with the line to its features.
    const kept = cardOf(root, 'story-block');
    assert.ok(page(root, 'modules').contains(kept));
    assert.ok(kept.querySelector('.ss-module-features'));
    assert.equal(kept.querySelector('.story-suite-section'), null, 'its Assist panel is the Assist page\'s');
    assert.equal(kept.querySelector('[data-field="currency"]'), null, 'its money settings are the Money page\'s');
    // Every settings row is on exactly one page: the money ones are the form engine's fields, not the old rows.
    assert.equal(page(root, 'modules').querySelectorAll('.story-suite-row').length, 0, 'the Modules page draws no old rows');
    assert.deepEqual(cardOf(root, 'rpg-battle').querySelectorAll('.ss-field').map(row => row.dataset.field), ['hardMode', 'level', 'title']);
    assert.equal(page(root, 'money').querySelectorAll('.story-suite-row').length, 0);
    assert.deepEqual(page(root, 'money').querySelectorAll('.ss-field').map(row => row.dataset.field), ['coins', 'coinDisplay', 'currency', 'currencyPlural', 'currencyShort', 'economyScale']);
    host.close();
});

test('the Features line in a module\'s fold goes to that module\'s group on the Features page, even from another one', async () => {
    const { root, win, host, doc } = await open();
    win.select('modules');
    assert.deepEqual(shownPages(root), ['modules']);
    const link = cardOf(root, 'story-block').querySelector('.ss-module-features');
    link.click();
    assert.deepEqual(shownPages(root), ['features']);
    const group = page(root, 'features').querySelectorAll('.ss-features-group').find(node => node.dataset.fold === featuresFoldOf('story-block'));
    assert.ok(group);
    assert.ok(doc.activeElement === group.querySelector('summary'), 'the focus on that module\'s heading');
    host.close();
});

test('a switch stores the choice, tells the other pages, and keeps the reader where they are', async () => {
    const { root, win, host } = await open();
    win.select('features');
    const input = () => root.querySelectorAll('.ss-feature').find(row => row.dataset.feature === 'loot.weight').querySelector('.ss-switch');
    assert.equal(input().getAttribute('aria-checked'), 'false');
    input().click();
    assert.equal(host.sdk.feature('loot.weight'), true);
    assert.equal(host.ctx.extensionSettings.storySuite.features['loot.weight'], true, 'the reader\'s store, as before');
    assert.equal(input().getAttribute('aria-checked'), 'true', 'drawn from the store');
    assert.deepEqual(shownPages(root), ['features']);
    assert.equal(win.section(), 'features');
    // Another page: a redraw from outside (a feature switched elsewhere) keeps it.
    win.select('modules');
    win.refresh();
    assert.deepEqual(shownPages(root), ['modules']);
    host.close();
});
