// The settings layout: folds, groups, compact lists, Packs, promptSize, settings window, NodeList compatibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../core/registry.js';
import { PACKS_FOLD, SETTINGS_TEXT, SUB_FOLD, featuresFoldOf, groupFields, promptSize, renderSettingsHost } from '../../ui/legacy/host-ui.js';
import { openSettingsWindow as openSettingsOverlay } from '../../ui/legacy/view/settings/window.js';
import { createCoreModule } from '../../packages/story-block/src/v2/domains/index.js';
import { packsFor } from '../../core/runtime.js';
import { estimateTokens } from '../../core/prompt.js';
import { cssOf } from './helpers/css-parts.js';
import { change, director, doc, foldAt, rpg, setup, subFolds, topFolds } from './host-ui.helpers.js';

test('folds: the top folds are the root\'s own children, each a summary and a body; sub-folds are another class', () => {
    const { registry, settings } = setup(rpg(), director());
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc });
    assert.ok(root.classList.contains('story-suite-folds'));
    assert.deepEqual(topFolds(root).map(node => node.dataset.fold), ['rpg-battle', 'story-director', 'story-suite-versions']);
    for (const fold of topFolds(root)) {
        assert.equal(fold.tagName, 'DETAILS');
        assert.deepEqual(fold.children.map(node => node.tagName), ['SUMMARY', 'DIV'], 'a summary row, then the body');
        assert.equal(fold.open, false, 'closed until the reader opens one');
    }
    // Opening one changes nothing about the others (the squashed-bars bug was CSS; the DOM stays flat).
    topFolds(root)[1].open = true;
    assert.deepEqual(topFolds(root).map(node => node.children.length), [2, 2, 2]);
    assert.equal(root.querySelectorAll('details.story-suite-fold').length, 3, 'sub-folds are not .story-suite-fold');
    assert.ok(root.querySelectorAll('details.story-suite-subfold').length > 0);
});

test('folds: host.css gives them a summary row with a chevron, no fixed heights; the window scrolls its page', () => {
    const css = cssOf('host');
    const windowCss = cssOf('settings');
    const rule = (source, selector) => {
        const at = source.indexOf(`${selector} {`);
        assert.ok(at >= 0, `${selector} has a rule`);
        return source.slice(at, source.indexOf('}', at));
    };
    assert.match(rule(css, '.story-suite-folds > *'), /flex: none/, 'a closed fold never shrinks');
    assert.match(css, /\.story-suite-fold > summary, \.story-suite-subfold > summary \{[^}]*min-height: 44px/);
    assert.match(css, /summary::before, \.story-suite-subfold > summary::before \{[^}]*border-right/, 'the chevron');
    assert.match(css, /\[open\] > summary::before[^{]*\{ transform: rotate\(45deg\); \}/);
    const content = rule(windowCss, ':where(.story-suite-overlay, .story-suite-sheet, .ss-gameview, .ss-dialog, .ss-cards, .ss-card, .ss-hud, [data-ss-screen], .story-suite-bar, .story-suite-extras, .story-suite-reply-note, .ss-send-note, .rpg-fight-offer, .rpg-fight-pause) .ss-settings-content');
    assert.match(content, /overflow-y: auto/);
    assert.match(content, /min-height: 0/);
    const layer = rule(css, '.story-suite-overlay');
    assert.match(layer, /height: 100dvh/);
    assert.doesNotMatch(layer, /backdrop-filter|filter:/, 'a filter on the layer would hide the page from the window\'s glass');
    assert.doesNotMatch(layer, /background:\s*var\(--story-suite-bg\)/, 'the layer is no opaque surface any more');
    // No fixed heights or negative margins on any settings fold or row.
    const settingsCss = css.slice(css.indexOf('/* ---- the settings window'), css.indexOf('.story-suite-drawer-buttons'));
    assert.doesNotMatch(settingsCss, /margin[^;]*:\s*-\d/);
    const heights = [...settingsCss.matchAll(/(?<![-\w])height:\s*(\d+px)/g)].map(match => match[1]);
    assert.deepEqual([...new Set(heights)].sort(), ['32px', '7px', '8px'], 'fixed heights only on the chevron, the × and the meter; folds and rows have none');
    // On a phone the rows stack.
    assert.match(css, /@media \(max-width: 560px\) \{\s*\.story-suite-row \{ grid-template-columns: minmax\(0, 1fr\);/);
});

test('groups: a field\'s `group`, else its label\'s "X: …" prefix, else General; in the order they first appear', () => {
    const groups = groupFields(director().settings.schema);
    assert.deepEqual(groups.map(group => group.name), ['Calendar', SETTINGS_TEXT.general, 'Quests']);
    assert.deepEqual(groups[0].fields.map(({ field }) => field.label), ['Calendar', 'Era (written before the year)', 'Months'], 'the prefix comes off the label');
    assert.deepEqual(groups[1].fields.map(({ key }) => key), ['tracker.dormantReplies', 'money.scale'], 'a colon inside brackets is no prefix');
    assert.equal(groups[1].fields[1].field.label, 'Money scale (0: the pack\'s)');
    assert.deepEqual(groupFields({ a: { type: 'int', label: 'Pace: Speed', group: 'Pace' }, b: { type: 'bool', label: 'Hard: mode', group: 'Pace' }, c: 'text' }),
        [{ name: 'Pace', fields: [{ key: 'a', field: { type: 'int', label: 'Speed', group: 'Pace' } }, { key: 'b', field: { type: 'bool', label: 'Hard: mode', group: 'Pace' } }] }, { name: 'General', fields: [{ key: 'c', field: 'text' }] }],
        'a group\'s own name comes off its labels; another prefix stays');

    const { registry, settings } = setup(director());
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc });
    const fold = foldAt(root, 'story-director');
    assert.deepEqual(subFolds(fold).map(node => node.dataset.fold), ['story-director::group:Calendar', 'story-director::group:General', 'story-director::group:Quests']);
    assert.deepEqual(subFolds(fold).map(node => node.querySelector('summary b').textContent), ['Calendar', 'General', 'Quests']);
    assert.deepEqual(subFolds(fold).map(node => node.querySelector('summary small').textContent), ['3 settings', '2 settings', '1 setting']);
    assert.deepEqual(subFolds(fold).map(node => node.open), [false, false, false], 'several groups: all closed');
    const calendar = subFolds(fold)[0];
    assert.deepEqual(calendar.querySelectorAll('.story-suite-row > span > b').map(node => node.textContent), ['Calendar', 'Era (written before the year)', 'Months']);
    // The stored keys are the schema's, whatever the label shows.
    const era = calendar.querySelector('.story-suite-row[data-field="tracker.calendar.era"] input');
    era.value = 'AE';
    change(era);
    assert.equal(settings('story-director')['tracker.calendar.era'], 'AE');
    // One group alone (and no features): it opens with its module.
    const single = setup(rpg());
    const only = doc.createElement('div');
    renderSettingsHost(only, { registry: single.registry, settings: single.settings, doc });
    assert.deepEqual(subFolds(foldAt(only, 'rpg-battle')).map(node => [node.dataset.fold, node.open]), [[`rpg-battle${SUB_FOLD}group:General`, true]]);
});

test('labels left, controls right: each row is a label tied to its control; a list\'s group is named by its label', () => {
    const { registry, settings } = setup(director());
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc });
    for (const row of root.querySelectorAll('.story-suite-row').filter(node => node.dataset.type !== 'list')) {
        assert.equal(row.tagName, 'LABEL');
        assert.equal(row.getAttribute('for'), row.querySelector('input, select, textarea').id);
    }
    const months = root.querySelector('.story-suite-row[data-field="tracker.calendar.months"]');
    assert.equal(months.dataset.type, 'list');
    const list = months.querySelector('.story-suite-list');
    assert.equal(list.getAttribute('role'), 'group');
    assert.equal(root.querySelectorAll(`#${list.getAttribute('aria-labelledby')}`)[0].textContent, 'Months');
});

test('a list is compact: one line per item with its fields inline, a small × named for the item, Add at the end', () => {
    const { registry, settings } = setup(director());
    const root = doc.createElement('div');
    doc.body.appendChild(root);
    renderSettingsHost(root, { registry, settings, doc });
    const list = root.querySelector('.story-suite-row[data-field="tracker.calendar.months"] .story-suite-list');
    const items = () => list.querySelectorAll('.story-suite-list-item');
    assert.deepEqual(list.children.map(node => node.className.split(' ').at(-1)), ['story-suite-list-head', 'story-suite-list-item', 'story-suite-list-item', 'story-suite-list-foot']);
    assert.deepEqual(list.querySelector('.story-suite-list-foot').children.map(node => node.className.split(' ').at(-1)), ['story-suite-list-add', 'story-suite-list-toggle'], 'Add, then Edit as text');
    assert.deepEqual(list.querySelectorAll('.story-suite-list-head .story-suite-list-cell').map(node => node.textContent), ['Name', 'Days']);
    assert.equal(list.querySelector('.story-suite-list-head').getAttribute('aria-hidden'), 'true');
    const [first] = items();
    // [January ] [31] × — no rows, labels or Remove words inside an item.
    assert.deepEqual(first.children.map(node => node.className), ['story-suite-list-cell', 'story-suite-list-cell', 'menu_button story-suite-list-remove']);
    assert.equal(first.querySelector('.story-suite-row'), null);
    assert.deepEqual(first.querySelectorAll('input').map(input => [input.value, input.type, input.getAttribute('aria-label')]), [['January', 'text', 'Name, item 1'], ['31', 'number', 'Days, item 1']]);
    const remove = first.querySelector('.story-suite-list-remove');
    assert.equal(remove.tagName, 'BUTTON');
    assert.equal(remove.type, 'button');
    assert.equal(remove.getAttribute('aria-label'), 'Remove January');
    assert.equal(remove.textContent, '×');
    const add = list.querySelector('.story-suite-list-add');
    assert.equal(add.textContent, 'Add');
    assert.equal(add.getAttribute('aria-label'), 'Add to Months', 'its name starts with what it says');
    // Add: a new empty line, the focus in its first field.
    add.click();
    assert.equal(items().length, 3);
    assert.deepEqual(settings('story-director')['tracker.calendar.months'], [{ name: 'January', days: 31 }, { name: 'February', days: 28 }, { name: '', days: 1 }]);
    assert.ok(doc.activeElement === items()[2].querySelector('input'));
    assert.equal(items()[2].querySelector('.story-suite-list-remove').getAttribute('aria-label'), 'Remove item 3');
    const name = items()[2].querySelector('[data-field="name"] input');
    name.value = 'March';
    change(name);
    const days = items()[2].querySelector('[data-field="days"] input');
    days.value = '31';
    change(days);
    assert.deepEqual(settings('story-director')['tracker.calendar.months'][2], { name: 'March', days: 31 });
    // Remove: that line goes, the focus moves to the next ×, then to Add when none is left after it.
    items()[0].querySelector('.story-suite-list-remove').click();
    assert.deepEqual(settings('story-director')['tracker.calendar.months'].map(month => month.name), ['February', 'March']);
    assert.ok(doc.activeElement === items()[0].querySelector('.story-suite-list-remove'));
    items()[1].querySelector('.story-suite-list-remove').click();
    items()[0].querySelector('.story-suite-list-remove').click();
    assert.deepEqual(settings('story-director')['tracker.calendar.months'], []);
    assert.ok(doc.activeElement === list.querySelector('.story-suite-list-add'));
    assert.equal(list.querySelector('.story-suite-list-head'), null, 'no heads over an empty list');
    root.remove();
});

test('Packs: its own fold first, titled Packs with "import a pack", even with no pack installed', () => {
    const ctx = { extensionSettings: {} };
    const core = createCoreModule({ packs: packsFor(ctx) });
    const { registry: reg, settings } = setup(core, director(), rpg());
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry: reg, settings, doc });
    assert.deepEqual(topFolds(root).map(node => node.dataset.fold), [PACKS_FOLD, 'rpg-battle', 'story-block', 'story-director', 'story-suite-versions']);
    const packs = foldAt(root, PACKS_FOLD);
    assert.deepEqual(packs.querySelectorAll(':scope > summary > *').map(node => node.textContent), ['Packs', 'import a pack']);
    assert.equal(packs.querySelector('.ss-packs-import').textContent.trim(), 'Import pack file');
    assert.equal(packs.querySelector('.ss-packs-empty').textContent, 'No packs installed.');
    assert.equal(foldAt(root, 'story-block').querySelector('.ss-packs-import'), null, 'not drawn twice: Story Block\'s own fold keeps Assist');
    assert.ok(!foldAt(root, 'story-block').querySelectorAll('.story-suite-subsection > h4').map(node => node.textContent).includes('Events'), 'Events is in Diagnostics');
    // Any subset of modules: without Story Block's core there is no Packs fold, and nothing breaks.
    const alone = setup(director());
    const bare = doc.createElement('div');
    renderSettingsHost(bare, { registry: alone.registry, settings: alone.settings, doc });
    assert.deepEqual(topFolds(bare).map(node => node.dataset.fold), ['story-director', 'story-suite-versions']);
    // A module's own fold is checked when it registers.
    const bad = createRegistry();
    assert.throws(() => bad.register({ id: 'odd', settings: { folds: [{ id: 'X Y', title: '', render: 'no' }] } }), /settings fold 1 has no usable id/);
});

test('promptSize: per module and in all, against the budget, counted at four characters a token (the Prompt card paints it: settings-prompt.test.js)', () => {
    const parts = [
        { module: 'story-suite', place: 'static', text: 'x'.repeat(400) },
        { module: 'rpg-battle', place: 'static', text: 'y'.repeat(80) },
        { module: 'story-suite', place: 'tail', text: '[Happened]\nA wolf ran off.' },
        { module: 'rpg-battle', place: 'tail', text: 'z'.repeat(203) },
    ];
    const stat = estimateTokens(`${'x'.repeat(400)}\n\n${'y'.repeat(80)}`);
    const tail = estimateTokens(`[Happened]\nA wolf ran off.\n${'z'.repeat(203)}`);
    assert.deepEqual(promptSize(parts, { budget: 5 }), { modules: [{ id: 'story-suite', name: 'story-suite', static: 100, tail: estimateTokens('[Happened]\nA wolf ran off.') }, { id: 'rpg-battle', name: 'rpg-battle', static: 20, tail: 51 }], static: stat, tail, own: [], total: stat + tail, budget: 5 });
});

test('open folds stay open across a redraw, sub-folds too; a closed default-open one stays closed', () => {
    const loot = { id: 'loot', name: 'Loot', features: [{ id: 'loot.weight', label: 'Weight' }], settings: { schema: { a: { type: 'int', label: 'Bag: Size' }, b: { type: 'int', label: 'Shop: Mark-up' } } } };
    const { registry, settings } = setup(loot, director());
    const features = { list: () => [{ id: 'loot.weight', moduleId: 'loot', moduleName: 'Loot', label: 'Weight', on: true }], set() {} };
    const root = doc.createElement('div');
    const host = renderSettingsHost(root, { registry, settings, doc, features });
    const key = part => `loot${SUB_FOLD}${part}`;
    assert.equal(foldAt(root, featuresFoldOf('loot')).open, true, 'the only module with features: its sub-fold of Features opens by default');
    assert.equal(foldAt(root, key('group:Bag')).open, false);
    foldAt(root, 'loot').open = true;
    foldAt(root, featuresFoldOf('loot')).open = false;
    foldAt(root, key('group:Shop')).open = true;
    foldAt(root, 'story-director::group:Calendar').open = true;
    host.refresh();
    assert.deepEqual(['loot', featuresFoldOf('loot'), key('group:Bag'), key('group:Shop'), 'story-director', 'story-director::group:Calendar'].map(fold => foldAt(root, fold).open), [true, false, false, true, false, true]);
    // A real browser's toggle event is remembered too (the overlay reopened keeps it).
    const shop = foldAt(root, key('group:Shop'));
    shop.open = false;
    shop.dispatch('toggle');
    const state = new Map();
    const again = doc.createElement('div');
    renderSettingsHost(again, { registry, settings, doc, features, openState: state });
    foldAt(again, key('group:Bag')).open = true;
    foldAt(again, key('group:Bag')).dispatch('toggle');
    assert.equal(state.get(key('group:Bag')), true);
    const third = doc.createElement('div');
    renderSettingsHost(third, { registry, settings, doc, features, openState: state });
    assert.equal(foldAt(third, key('group:Bag')).open, true, 'another render with the same state');
});

test('the settings window: a side with the rail and a page; Escape closes it and the focus goes back; it can open at a fold', () => {
    const ctx = { extensionSettings: {} };
    const { registry, settings } = setup(createCoreModule({ packs: packsFor(ctx) }), rpg());
    const opener = doc.createElement('button');
    doc.body.appendChild(opener);
    opener.focus();
    // The document's own listeners (the fake one has none): the window's focus guard goes there.
    const listeners = [];
    doc.addEventListener = (type, fn) => listeners.push({ type, fn });
    doc.removeEventListener = (type, fn) => { const at = listeners.findIndex(entry => entry.type === type && entry.fn === fn); if (at >= 0) listeners.splice(at, 1); };
    const overlay = openSettingsOverlay({ registry, settings, doc, openState: new Map() });
    const win = overlay.root.querySelector('.ss-settings');
    assert.equal(win.getAttribute('role'), 'dialog');
    assert.equal(win.getAttribute('aria-modal'), 'true');
    assert.equal(win.getAttribute('aria-labelledby'), 'story_suite_v2_overlay_title');
    assert.equal(overlay.root.querySelector('#story_suite_v2_overlay_title').textContent, 'Story Suite');
    assert.deepEqual(win.children.map(node => node.className), ['ss-settings-close story-suite-close', 'ss-settings-side', 'ss-settings-content', 'ss-settings-foot']);
    assert.deepEqual(overlay.root.querySelectorAll('.ss-settings-pane').map(node => node.parentNode.dataset.ssSection), ['look', 'features', 'money', 'assist', 'tabs', 'blocks', 'modules', 'diagnostics']);
    assert.ok(doc.activeElement === overlay.root.querySelector('.ss-tabs-item[aria-current="page"]'), 'the focus starts on the rail');
    // The page behind cannot take the focus while it is open.
    opener.focus();
    for (const entry of listeners.filter(item => item.type === 'focusin')) entry.fn({ target: opener });
    assert.ok(win.contains(doc.activeElement));
    // Escape from inside the window (a key on its content): the window's layer on the page takes it.
    const escape = { type: 'keydown', key: 'Escape', target: overlay.root.querySelector('.ss-settings-content'), defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
    for (const entry of listeners.filter(item => item.type === 'keydown')) entry.fn(escape);
    assert.equal(doc.querySelectorAll('#story_suite_v2_overlay').length, 0);
    assert.equal(overlay.isOpen(), false);
    assert.ok(doc.activeElement === opener, 'back where it was');
    // Opened at the Packs fold (Home's "Import a pack"): its section shown, the Import button focused.
    const atPacks = openSettingsOverlay({ registry, settings, doc, fold: PACKS_FOLD, openState: new Map() });
    assert.equal(atPacks.section(), 'tabs');
    assert.equal(foldAt(atPacks.root, PACKS_FOLD), undefined, 'the Packs fold is the Packs card now');
    assert.ok(doc.activeElement === atPacks.root.querySelector('.ss-packs-import'), 'the Import button has the focus');
    // Opening again closes the first one (one window, one focus guard).
    const second = openSettingsOverlay({ registry, settings, doc, openState: new Map() });
    assert.equal(atPacks.isOpen(), false);
    assert.equal(doc.querySelectorAll('#story_suite_v2_overlay').length, 1);
    second.close();
    assert.equal(listeners.length, 0, 'every window took its focus guard with it');
    opener.remove();
    delete doc.addEventListener;
    delete doc.removeEventListener;
});

test('a real browser\'s querySelectorAll gives a NodeList (no find, no at): the switch, Add and opening at a fold still work', () => {
    const proto = Object.getPrototypeOf(doc.createElement('div'));
    const plain = proto.querySelectorAll;
    // A NodeList: indexable and iterable, with forEach and item, but none of an Array's other methods.
    proto.querySelectorAll = function (selector) {
        const found = plain.call(this, selector);
        const list = { length: found.length, item: at => found[at] ?? null, forEach: fn => found.forEach(fn), [Symbol.iterator]: () => found[Symbol.iterator]() };
        found.forEach((node, at) => { list[at] = node; });
        return list;
    };
    const find = (root, selector, test) => [...root.querySelectorAll(selector)].find(test);
    try {
        const loot = { id: 'loot', name: 'Loot', features: [{ id: 'loot.weight', label: 'Weight' }] };
        const { registry, settings } = setup(loot, director());
        const stored = {};
        const features = { list: () => [{ id: 'loot.weight', moduleId: 'loot', moduleName: 'Loot', label: 'Weight', on: stored['loot.weight'] !== false }], set: (id, on) => { stored[id] = on; } };
        const root = doc.createElement('div');
        doc.body.appendChild(root);
        renderSettingsHost(root, { registry, settings, doc, features });
        const input = find(root, '.story-suite-feature input', node => node.id.includes('overview'));
        input.checked = false;
        input.dispatch('change');
        assert.equal(stored['loot.weight'], false);
        assert.ok(doc.activeElement === find(root, '.story-suite-feature input', node => node.id === input.id), 'the switch keeps the focus');
        find(root, '.story-suite-list-add', () => true).click();
        assert.equal(settings('story-director')['tracker.calendar.months'].length, 3);
        root.remove();
        const overlay = openSettingsOverlay({ registry, settings, doc, features, fold: 'story-director', openState: new Map() });
        assert.ok(doc.activeElement === find(overlay.root, '.ss-module-card', node => node.dataset.module === 'story-director').querySelector('summary'), 'the module\'s card has the focus');
        overlay.close();
    } finally {
        proto.querySelectorAll = plain;
    }
});
