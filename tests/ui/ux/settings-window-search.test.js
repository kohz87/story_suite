import test from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "../view/mounts/helpers.js";
import { SETTINGS_TEXT } from "../../../ui/legacy/host-ui.js";
import { FORM_TEXT } from "../../../ui/legacy/view/form/schema.js";
import { SECTION_BODIES, createLegacySettings } from "../../../ui/legacy/view/settings/bodies.js";
import { filterPane } from "../../../ui/legacy/view/settings/search.js";
import { SECTION_IDS, WINDOW_TEXT } from "../../../ui/legacy/view/settings/sections.js";
import { cardOf, open, page, railItems, search, shownPages, status, texts } from "./settings-window.helpers.js";

// ---- search

test('search: typing filters every section at once, shows only the pages with matches, counts them for the rail and a live region', async () => {
    const { root, host } = await open();
    const live = status(root);
    assert.equal(live.getAttribute('role'), 'status');
    assert.equal(live.getAttribute('aria-live'), 'polite');
    assert.equal(live.hidden, true);
    search(root, 'coin');
    assert.ok(shownPages(root).includes('money'), 'the Money page');
    assert.ok(shownPages(root).length > 1 || shownPages(root)[0] === 'money');
    assert.equal(live.hidden, false);
    const n = Number(/^(\d+) settings shown$/.exec(live.textContent)?.[1]);
    assert.ok(n > 1, live.textContent);
    // The rail says how many each page has, and a page with none is left out.
    const counts = Object.fromEntries(railItems(root).map(node => [node.getAttribute('data-id'), node.querySelector('.ss-tabs-count')?.textContent ?? '']));
    assert.equal(Object.values(counts).filter(Boolean).map(Number).reduce((a, b) => a + b, 0), n, 'the pages\' counts add up to what is said');
    assert.deepEqual(shownPages(root), Object.keys(counts).filter(id => counts[id]), 'a page with no match is not shown');
    assert.equal(root.querySelector('.ss-form-empty').hidden, true);
    // On the Money page only the matching rows show.
    const visible = page(root, 'money').querySelectorAll('.ss-field').filter(row => !row.hidden).map(row => row.dataset.field);
    assert.ok(visible.includes('coins') && visible.includes('coinDisplay'));
    assert.ok(!visible.includes('currencyShort'), 'its label has no "coin" in it');
    // Clearing shows the chosen page again.
    root.querySelector('.ss-search-clear').click();
    assert.deepEqual(shownPages(root), ['features']);
    assert.equal(live.hidden, true);
    assert.equal(railItems(root).filter(node => node.querySelector('.ss-tabs-count')).length, 0);
    assert.equal(page(root, 'money').querySelectorAll('.story-suite-row[data-field]').filter(row => row.hidden).length, 0, 'every row shows again');
    host.close();
});

test('search words: one match says "1 setting shown", none says so with the text, and the rows, features and panels are all found', async () => {
    const { root, host } = await open();
    const live = status(root);
    search(root, 'hard mode');
    assert.equal(live.textContent, FORM_TEXT.shownOne);
    assert.deepEqual(shownPages(root), ['modules']);
    assert.equal(cardOf(root, 'rpg-battle').hidden, false, 'the module with the match');
    assert.equal(cardOf(root, 'story-block').hidden, true, 'a card with no match is out');
    search(root, 'xyzzy nothing');
    assert.equal(live.textContent, '');
    const empty = root.querySelector('.ss-form-empty');
    assert.equal(empty.hidden, false);
    assert.equal(empty.textContent, 'No settings match "xyzzy nothing".');
    assert.deepEqual(shownPages(root), []);
    // A feature by what it says; a panel by its name; a module's settings by the module's name.
    search(root, 'items weigh');
    assert.deepEqual(shownPages(root), ['features']);
    assert.equal(live.textContent, FORM_TEXT.shownOne);
    assert.equal(root.querySelectorAll('.ss-feature').filter(row => !row.hidden).map(row => row.dataset.feature).join(), 'loot.weight');
    search(root, 'packs');
    assert.ok(shownPages(root).includes('tabs'), 'the Packs card, found by its name');
    assert.equal(page(root, 'tabs').querySelector('.ss-packs-card').hidden, false);
    assert.equal(page(root, 'tabs').querySelector('.ss-prompt-card').hidden, true, 'a card with no match is out');
    search(root, 'rpg battle');
    assert.deepEqual(shownPages(root), ['features', 'modules'], 'the module, and the RPG feature (its battle log)');
    assert.equal(page(root, 'modules').querySelectorAll('.ss-field').filter(row => !row.hidden && !row.parentNode.hidden).length, 3, 'its three settings (the module\'s name shows them all)');
    // What it says finds it ("money" → "Money scale" and the "Money words" card), not the section's own name.
    search(root, 'money');
    assert.ok(shownPages(root).includes('money'));
    assert.equal(page(root, 'money').querySelectorAll('.ss-field').filter(row => !row.hidden).map(row => row.dataset.field).join(), 'currency,currencyPlural,currencyShort,economyScale');
    // Words are all needed, in any order, any case.
    search(root, 'SHOP trade');
    assert.deepEqual(page(root, 'modules').querySelectorAll('.ss-field').filter(row => !row.hidden).map(row => row.dataset.field), ['title']);
    host.close();
});

test('search takes the Features line into account: it opens its page from another one', async () => {
    const { root, win, host } = await open();
    win.select('modules');
    search(root, 'story block');
    const link = root.querySelectorAll('.ss-module-features').find(node => !node.hidden && !node.parentNode.parentNode.hidden);
    assert.ok(link);
    link.click();
    assert.equal(root.querySelector('.ss-search-input').value, '', 'going to Features ends the search');
    assert.deepEqual(shownPages(root), ['features']);
    host.close();
});

// ---- the bodies

test('a section can take another body: it gets its own pane, the shared host does not draw there, and its filter is used', async () => {
    const calls = [];
    const bodies = {
        ...SECTION_BODIES,
        money: (pane, ctx) => {
            const own = ctx.doc.createElement('p');
            own.className = 'own-money';
            own.textContent = `Money body for ${ctx.label}`;
            pane.appendChild(own);
            return {
                filter: text => { calls.push(['filter', text]); return text.includes('coin') ? 4 : 0; },
                refresh: () => calls.push(['refresh']),
                destroy: () => calls.push(['destroy']),
            };
        },
    };
    const { root, win, host } = await open({ window: { bodies } });
    assert.equal(page(root, 'money').querySelector('.own-money').textContent, 'Money body for Money');
    assert.equal(page(root, 'money').querySelectorAll('details').length, 0, 'the shared host drew nothing there');
    assert.equal(page(root, 'assist').querySelectorAll('details').length, 0, 'the rest are as before: Assist is the form engine\'s');
    assert.ok(page(root, 'assist').querySelector('.ss-assist-page'));
    assert.equal(root.querySelector('details[data-fold="story-block::group:General"]'), null);
    search(root, 'coin');
    assert.ok(calls.some(call => call[0] === 'filter' && call[1] === 'coin'));
    assert.equal(page(root, 'money').hidden, false);
    assert.equal(railItems(root)[2].querySelector('.ss-tabs-count').textContent, '4', 'its count');
    assert.equal(Number(/\d+/.exec(status(root).textContent)[0]) >= 4, true);
    win.refresh();
    assert.ok(calls.some(call => call[0] === 'refresh'));
    win.close();
    assert.ok(calls.some(call => call[0] === 'destroy'));
    host.close();
});

test('an extra section (a module that is on only sometimes) goes in the rail after the one it names, and comes and goes with visible()', async () => {
    const calls = [];
    let on = true;
    const extra = {
        id: 'extra', label: 'Extra', icon: 'fa-dice-d20', title: 'Extra', sub: 'An extra page.', after: 'features', visible: () => on,
        body: (pane, ctx) => {
            const own = ctx.doc.createElement('p');
            own.className = 'own-extra';
            pane.appendChild(own);
            return { filter: text => (text.includes('zebra') ? 2 : 0), refresh: () => calls.push('refresh'), destroy: () => calls.push('destroy') };
        },
    };
    const { root, win, host } = await open({ window: { extraSections: [extra] } });
    assert.deepEqual(texts(root, '.ss-tabs-label'), ['Look', 'Features', 'Extra', 'Money', 'Assist', 'Tabs & Packs', 'Blocks', 'Modules', 'Diagnostics']);
    assert.deepEqual(root.querySelectorAll('.ss-settings-page').map(node => node.dataset.ssSection), [...SECTION_IDS.slice(0, 2), 'extra', ...SECTION_IDS.slice(2)]);
    assert.equal(page(root, 'extra').querySelector('.ss-settings-page-title').textContent, 'Extra');
    assert.ok(page(root, 'extra').querySelector('.own-extra'));
    assert.equal(win.select('extra'), 'extra');
    assert.deepEqual(shownPages(root), ['extra']);
    search(root, 'zebra');
    assert.deepEqual(shownPages(root), ['extra'], 'found by its own filter');
    search(root, '');
    on = false;
    win.refresh();
    assert.deepEqual(texts(root, '.ss-tabs-label').slice(0, 3), ['Look', 'Features', 'Money'], 'gone from the rail');
    assert.equal(win.section(), 'features', 'a window left on it moves to the default page');
    assert.equal(page(root, 'extra').hidden, true);
    search(root, 'zebra');
    assert.ok(!shownPages(root).includes('extra'), 'and out of a search');
    search(root, '');
    assert.equal(win.select('extra'), 'features', 'it cannot be chosen while it is off');
    on = true;
    win.refresh();
    assert.equal(win.select('extra'), 'extra');
    // An extra section with an unknown `after` goes last.
    win.close();
    assert.ok(calls.includes('destroy'));
    const last = await open({ window: { extraSections: [{ ...extra, after: 'nowhere' }] } });
    assert.equal(texts(last.root, '.ss-tabs-label').at(-1), 'Extra');
    last.win.close();
    host.close();
    last.host.close();
});

test('a body that is missing leaves that section\'s page empty, and a body that counts nothing is left out of a search', async () => {
    const bodies = { ...SECTION_BODIES, assist: undefined, diagnostics: () => ({}) };
    const { root, host } = await open({ window: { bodies } });
    assert.equal(page(root, 'assist').querySelectorAll('.ss-settings-pane > *').length, 0);
    search(root, 'report');
    assert.ok(!shownPages(root).includes('diagnostics'));
    host.close();
});

test('filterPane on its own: matches, covered panels and the count', async () => {
    const doc = setupDom();
    const pane = doc.createElement('div');
    const mk = (tag, className) => { const node = doc.createElement(tag); node.className = className; return node; };
    const outer = mk('details', 'story-suite-fold');
    outer.dataset.fold = 'outer';
    const body = mk('div', 'story-suite-fold-body');
    const rowA = mk('div', 'story-suite-row');
    const rowB = mk('div', 'story-suite-row');
    const panelFold = mk('details', 'story-suite-subfold');
    panelFold.dataset.fold = 'panel';
    const inner = mk('div', 'inner');
    panelFold.appendChild(inner);
    body.append(rowA, rowB, panelFold);
    outer.appendChild(body);
    pane.appendChild(outer);
    const entries = [
        { kind: 'row', key: 'alpha', field: { label: 'Alpha', help: 'first' }, group: 'G', node: rowA },
        { kind: 'row', key: 'beta', field: { label: 'Beta', help: 'second' }, group: 'G', node: rowB },
        { kind: 'panel', key: 'panel', field: { label: 'Panel', help: 'things' }, group: 'G', node: panelFold },
        { kind: 'row', key: 'gamma', field: { label: 'Gamma', help: '' }, group: 'G', node: inner },
    ];
    const state = new Map();
    assert.equal(filterPane({ pane, entries, text: '', openState: state }), 4, 'no search: every entry');
    assert.equal(filterPane({ pane, entries, text: 'alpha', openState: state }), 1);
    assert.deepEqual([rowA.hidden, rowB.hidden, panelFold.hidden, outer.hidden, outer.open], [false, true, true, false, true]);
    // A panel that matches shows whole, and counts once, not for what is inside.
    assert.equal(filterPane({ pane, entries, text: 'panel', openState: state }), 1);
    assert.deepEqual([rowA.hidden, panelFold.hidden, inner.hidden], [true, false, false]);
    // A match inside a panel that does not match shows the panel.
    assert.equal(filterPane({ pane, entries, text: 'gamma', openState: state }), 1);
    assert.deepEqual([panelFold.hidden, inner.hidden], [false, false]);
    assert.equal(filterPane({ pane, entries, text: 'zzz', openState: state }), 0);
    assert.equal(outer.hidden, true);
    // An entry no longer in the pane (replaced by a redraw) is ignored.
    assert.equal(filterPane({ pane, entries: [...entries, { kind: 'row', key: 'alpha', field: { label: 'Alpha' }, group: '', node: doc.createElement('div') }], text: 'alpha', openState: state }), 1);
    assert.equal(outer.open, true);
    filterPane({ pane, entries, text: '', openState: state });
    assert.equal(outer.open, false);
    assert.equal(outer.hidden, false);
});

test('createLegacySettings: nothing attached draws nothing; refresh before start does nothing', () => {
    const legacy = createLegacySettings({});
    legacy.start({});
    assert.equal(legacy.refresh(), undefined);
    const body = legacy.attach('features', {}, { label: 'Features', openState: new Map() });
    assert.equal(body.filter('x'), 0, 'not started: no matches');
});

test('the old host text is still where it was: the window adds none to SETTINGS_TEXT', () => {
    assert.equal(SETTINGS_TEXT.general, 'General');
    assert.equal(WINDOW_TEXT.title, 'Story Suite');
});
