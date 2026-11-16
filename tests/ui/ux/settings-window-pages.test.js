import test from "node:test";
import assert from "node:assert/strict";
import { createHost } from "../../../packages/story-block/testkit/index.js";
import { setupDom } from "../view/mounts/helpers.js";
import { FEATURES_FOLD, HOST_FOLD, PACKS_FOLD, SENT_FOLD, TABS_FOLD, VERSIONS_FOLD, SUB_FOLD, featuresFoldOf } from "../../../ui/legacy/host-ui.js";
import { FORM_TEXT } from "../../../ui/legacy/view/form/schema.js";
import { PROMPT_FOLD } from "../../../ui/legacy/view/settings/prompt.js";
import { LOOK_KEYS } from "../../../ui/legacy/view/settings/sections.js";
import { openSettingsWindow } from "../../../ui/legacy/view/settings/window.js";
import { cardOf, foldAt, loot, open, page, railItems, rpg, search, shownPages, status, tabsControl, texts } from "./settings-window.helpers.js";

// ---- Look and Features (step 3b)

test('Look: Panel style, Glass strength and Font come from the host schema, are written to the host settings and applied through the theme; the budgets are the Prompt card\'s', async () => {
    const applied = [];
    const { root, host } = await open({ window: { theme: { apply: () => applied.push(host.settings().panelStyle) } } });
    const look = page(root, 'look');
    assert.deepEqual(look.querySelectorAll('.ss-field').map(row => row.dataset.field), LOOK_KEYS);
    assert.deepEqual(texts(look, '.ss-field-label'), ['Panel style', 'Glass strength (%)', 'Font', 'Text size', 'Send pending note']);
    assert.equal(look.querySelectorAll('details').length, 0, 'no folds');
    // The budgets are the Prompt card's (Tabs & Packs), the call queue the Assist page's; the Story Suite fold is gone.
    assert.deepEqual(page(root, 'tabs').querySelectorAll('.ss-prompt-card .ss-field').map(row => row.dataset.field), ['tailBudget', 'contextShare', 'maxChangeLines']);
    assert.ok(page(root, 'assist').querySelector('.ss-field[data-field="callQueue"]'), 'the call queue is on the Assist page now');
    assert.equal(foldAt(root, HOST_FOLD), undefined);
    // A choice goes through the settings store (the host's own, `settings.set(null, key, value)`) and the look follows at once.
    const select = look.querySelector('.ss-field[data-field="panelStyle"] select');
    select.value = 'solid';
    select.dispatch('change');
    assert.equal(host.settings().panelStyle, 'solid');
    assert.deepEqual(applied, ['solid']);
    const slider = look.querySelector('.ss-field[data-field="glassStrength"] input');
    slider.value = '70';
    slider.dispatch('change');
    assert.equal(host.settings().glassStrength, 70);
    assert.equal(applied.length, 2);
    const font = look.querySelector('.ss-field[data-field="font"] select');
    font.value = 'theme';
    font.dispatch('change');
    assert.equal(host.settings().font, 'theme');
    host.close();
});

test('Look: Text size is a three-button row (Normal, 110%, 120%) under Font; a press stores it, the look follows at once, and Normal is the default', async () => {
    const applied = [];
    const { root, host } = await open({ window: { theme: { apply: () => applied.push(host.settings().textSize) } } });
    const look = page(root, 'look');
    const row = look.querySelector('.ss-field[data-field="textSize"]');
    assert.equal(row.dataset.kind, 'segmented');
    assert.equal(look.querySelectorAll('.ss-field')[3], row, 'after Font');
    assert.equal(host.settings().textSize, '100', 'Normal by default');
    const group = row.querySelector('.ss-segmented');
    assert.equal(group.getAttribute('role'), 'radiogroup');
    const buttons = () => row.querySelectorAll('.ss-chip');
    assert.deepEqual(buttons().map(button => button.textContent), ['Normal', '110%', '120%']);
    assert.deepEqual(buttons().map(button => button.getAttribute('aria-checked')), ['true', 'false', 'false']);
    buttons()[2].click();
    assert.equal(host.settings().textSize, '120');
    assert.deepEqual(applied, ['120']);
    assert.deepEqual(buttons().map(button => button.getAttribute('aria-checked')), ['false', 'false', 'true']);
    buttons()[1].click();
    assert.equal(host.settings().textSize, '110');
    buttons()[0].click();
    assert.equal(host.settings().textSize, '100');
    assert.deepEqual(applied, ['120', '110', '100']);
    assert.match(texts(row, '.ss-field-help').join(' '), /SillyTavern chat text keeps its own size/);
    host.close();
});

test('Look is searched with the rest: "glass" finds its rows and says how many', async () => {
    const { root, host } = await open();
    search(root, 'glass');
    assert.ok(shownPages(root).includes('look'));
    assert.deepEqual(page(root, 'look').querySelectorAll('.ss-field').filter(row => !row.hidden).map(row => row.dataset.field), ['panelStyle', 'glassStrength']);
    assert.equal(railItems(root)[0].querySelector('.ss-tabs-count').textContent, '2');
    search(root, 'font');
    assert.deepEqual(page(root, 'look').querySelectorAll('.ss-field').filter(row => !row.hidden).map(row => row.dataset.field), ['font', 'textSize'], 'Text size\'s help names the font scale too');
    search(root, '');
    assert.equal(page(root, 'look').querySelectorAll('.ss-field').filter(row => row.hidden).length, 0);
    host.close();
});

test('Features: a group of switch tiles per module, "N of M on", the same store as before; a switch redraws the other pages', async () => {
    const { root, host, win } = await open();
    const features = page(root, 'features');
    const groups = features.querySelectorAll('.ss-features-group');
    const names = groups.map(node => node.querySelector('.ss-section-title').textContent);
    assert.deepEqual(names, ['Loot', 'RPG Battle', 'Story Block'].filter(name => names.includes(name)), 'by name');
    assert.ok(names.includes('Loot') && names.includes('Story Block'));
    const loot = groups.find(node => node.dataset.module === 'loot');
    assert.equal(loot.dataset.fold, featuresFoldOf('loot'));
    assert.equal(loot.querySelector('.ss-section-hint').textContent, '1 of 2 on');
    assert.deepEqual(loot.querySelectorAll('.ss-feature').map(node => node.dataset.feature), ['loot.picker', 'loot.weight']);
    const weight = loot.querySelectorAll('.ss-feature')[1];
    assert.equal(weight.querySelector('.ss-feature-name').textContent, 'Weight');
    assert.equal(weight.querySelector('.ss-switch').getAttribute('role'), 'switch');
    // Switching it stores the reader's choice, the count follows, and the line in the module's fold (Modules) says so too.
    const link = () => cardOf(root, 'story-block').querySelector('.ss-module-features').textContent;
    const before = link();
    const sb = host.features.list().filter(feature => feature.moduleId === 'story-block');
    const off = sb.find(feature => feature.on === false && feature.available !== false);
    const tile = features.querySelectorAll('.ss-feature').find(node => node.dataset.feature === off.id);
    tile.querySelector('.ss-switch').click();
    assert.equal(host.sdk.feature(off.id), true);
    assert.equal(host.ctx.extensionSettings.storySuite.features[off.id], true);
    assert.equal(features.querySelectorAll('.ss-features-group').find(node => node.dataset.module === 'story-block').querySelector('.ss-section-hint').textContent, `${sb.filter(feature => feature.on).length + 1} of ${sb.length} on`);
    assert.notEqual(link(), before, 'the other page drew it again');
    assert.equal(win.section(), 'features');
    host.close();
});

test('Features: searched with the rest; a feature found by its description or its module', async () => {
    const { root, host } = await open();
    search(root, 'items weigh');
    assert.deepEqual(shownPages(root), ['features']);
    assert.deepEqual(page(root, 'features').querySelectorAll('.ss-feature').filter(node => !node.hidden).map(node => node.dataset.feature), ['loot.weight']);
    assert.equal(status(root).textContent, FORM_TEXT.shownOne);
    assert.equal(page(root, 'features').querySelectorAll('.ss-features-group').filter(node => !node.hidden).length, 1, 'the groups with no match are left out');
    search(root, 'story block');
    assert.deepEqual(page(root, 'features').querySelectorAll('.ss-feature').filter(node => !node.hidden).map(node => node.dataset.feature), host.features.list().filter(feature => feature.moduleId === 'story-block').map(feature => feature.id), 'by the module\'s name');
    host.close();
});

// ---- a phone must not be scrolled around the window (hotfix): only the page scroller moves, nothing else is asked to
test('jumping to a fold scrolls nothing but the page: no scrollIntoView anywhere, every programmatic focus is preventScroll', async () => {
    const { FakeElement } = await import('../../helpers/ui-fake-dom.js');
    const scrolled = [];
    const focused = [];
    const proto = FakeElement.prototype;
    const hadScroll = Object.getOwnPropertyDescriptor(proto, 'scrollIntoView');
    const focus = proto.focus;
    proto.scrollIntoView = function scrollIntoView(options) { scrolled.push(options); };
    proto.focus = function recordedFocus(options) { focused.push(options); focus.call(this); };
    try {
        const { root, win, host } = await open({ window: { fold: featuresFoldOf('loot') } });
        // the Modules page's line to a module's Features, the footer, the other fold ids
        win.select('modules');
        const link = root.querySelectorAll('.ss-module-features').find(node => !node.hidden);
        link?.click();
        for (const key of [PACKS_FOLD, PROMPT_FOLD, SENT_FOLD, TABS_FOLD, FEATURES_FOLD, VERSIONS_FOLD, featuresFoldOf('rpg-battle'), 'rpg-battle', `rpg-battle${SUB_FOLD}group:Trade`]) {
            const again = await open({ window: { fold: key } });
            again.win.close();
            again.host.close();
        }
        root.querySelector('.ss-footer-open, .ss-settings-foot button')?.click();
        assert.deepEqual(scrolled, [], 'scrollIntoView is never used inside the window');
        assert.ok(focused.length > 0, 'some focus moved');
        assert.ok(focused.every(options => options && options.preventScroll === true), `every focus is preventScroll: ${JSON.stringify(focused)}`);
        win.close();
        host.close();
    } finally {
        proto.focus = focus;
        if (hadScroll) Object.defineProperty(proto, 'scrollIntoView', hadScroll); else delete proto.scrollIntoView;
    }
});

test('the window\'s layer and window never stay scrolled; the document is held while it is open and let go on close', async () => {
    const doc = setupDom();
    const style = { overscrollBehavior: 'auto' };
    doc.documentElement = { style };
    doc.scrollingElement = { scrollTop: 25, scrollLeft: 0 };
    const docListeners = [];
    const add = doc.addEventListener;
    doc.addEventListener = (type, fn, options) => { docListeners.push([type, fn]); add(type, fn, options); };
    const remove = doc.removeEventListener;
    doc.removeEventListener = (type, fn) => { const at = docListeners.findIndex(item => item[0] === type && item[1] === fn); if (at >= 0) docListeners.splice(at, 1); remove(type, fn); };
    const host = await createHost({ modules: [loot(), rpg()] });
    const win = openSettingsWindow({ registry: host.registry, settings: host.settings, features: host.features, doc, sdk: host.sdk, tabs: tabsControl(), openState: new Map() });
    assert.equal(style.overscrollBehavior, 'none', 'no scroll chaining into the page behind');
    // a browser scrolling the layer or the window to show a focused box is undone
    win.root.scrollTop = 140;
    win.root.dispatch('scroll');
    assert.equal(win.root.scrollTop, 0);
    const frame = win.root.querySelector('.ss-settings');
    frame.scrollTop = 90;
    frame.scrollLeft = 12;
    frame.dispatch('scroll');
    assert.deepEqual([frame.scrollTop, frame.scrollLeft], [0, 0]);
    // and so is the document
    doc.scrollingElement.scrollTop = 300;
    for (const [type, fn] of docListeners) if (type === 'scroll') fn();
    assert.equal(doc.scrollingElement.scrollTop, 25);
    win.close();
    assert.equal(style.overscrollBehavior, 'auto', 'let go on close');
    doc.scrollingElement.scrollTop = 99;
    for (const [type, fn] of docListeners) if (type === 'scroll') fn();
    assert.equal(doc.scrollingElement.scrollTop, 99, 'no longer held');
    host.close();
});

test('source: nothing in the settings window or the form engine calls scrollIntoView or a bare focus()', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const dirs = ['src/v2/view/settings', 'src/v2/view/form'];
    const offenders = [];
    for (const dir of dirs) {
        for (const name of readdirSync(new URL(`../../../${dir}/`, import.meta.url))) {
            if (!name.endsWith('.js')) continue;
            const text = readFileSync(new URL(`../../../${dir}/${name}`, import.meta.url), 'utf8').split('\n');
            text.forEach((line, index) => {
                const code = line.replace(/\/\/.*$/, '');
                if (/scrollIntoView\s*[(?]/.test(code)) offenders.push(`${dir}/${name}:${index + 1} scrollIntoView`);
                if (/\.focus\??\.?\(\s*\)/.test(code) && !/prompt\.focus\(|tabsCard\.focus\(/.test(code) && !/^\s*focus\(\)\s*\{/.test(code)) offenders.push(`${dir}/${name}:${index + 1} focus()`);
            });
        }
    }
    assert.deepEqual(offenders, []);
});
