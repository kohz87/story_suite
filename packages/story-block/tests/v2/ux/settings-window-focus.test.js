import test from "node:test";
import assert from "node:assert/strict";
import { createHost } from "../../../testkit/index.js";
import { setupDom } from "../view/mounts/helpers.js";
import { FEATURES_FOLD, HOST_FOLD, PACKS_FOLD, SENT_FOLD, TABS_FOLD, VERSIONS_FOLD, featuresFoldOf } from "../../../src/v2/host-ui.js";
import { PROMPT_FOLD } from "../../../src/v2/view/settings/prompt.js";
import { openSettingsWindow } from "../../../src/v2/view/settings/window.js";
import { cardOf, diagnosticsDrawn, foldAt, loot, open, page, railItems, rpg, shownPages } from "./settings-window.helpers.js";

test('opened at a fold: that fold\'s page shows, the fold is open and its summary has the focus', async () => {
    const cases = [
        [PACKS_FOLD, 'tabs'],
        [TABS_FOLD, 'tabs'],
        [HOST_FOLD, 'tabs'],
        [PROMPT_FOLD, 'tabs'],
        [SENT_FOLD, 'tabs'],
        [FEATURES_FOLD, 'features'],
        [featuresFoldOf('loot'), 'features'],
        ['loot::features', 'features'],
        [featuresFoldOf('story-block'), 'features'],
        ['rpg-battle', 'modules'],
        ['rpg-battle::group:Trade', 'modules'],
        ['story-block::group:General', 'money'],
        ['story-block::group:Assist', 'assist'],
        ['story-block/events', 'diagnostics'],
        [VERSIONS_FOLD, 'modules'],
    ];
    for (const [fold, section] of cases) {
        const { root, win, host, doc } = await open({ window: { fold, promptParts: () => [{ module: 'story-suite', place: 'static', text: 'Rules.' }] } });
        const wanted = fold.endsWith('::features') ? featuresFoldOf(fold.slice(0, -'::features'.length)) : fold;
        assert.equal(win.section(), section, fold);
        assert.deepEqual(shownPages(root), [section], fold);
        if (section === 'features') {
            // A module's features are a fold of tiles: it is open and its summary has the focus (the whole page: the first group's).
            const group = page(root, 'features').querySelectorAll('.ss-features-group').find(node => node.dataset.fold === (wanted === FEATURES_FOLD ? page(root, 'features').querySelector('.ss-features-group').dataset.fold : wanted));
            assert.ok(group, `${fold} is drawn`);
            assert.ok(doc.activeElement === group.querySelector('summary'), `${fold} has the focus`);
            assert.equal(group.open, true, `${fold} is open`);
            win.close();
            host.close();
            continue;
        }
        if (section === 'money') {
            // The General group is the form engine's Money page: the first field has the focus.
            assert.ok(doc.activeElement === page(root, 'money').querySelector('.ss-field[data-field="coins"] input, .ss-field[data-field="coins"] button'), `${fold} has the focus`);
            win.close();
            host.close();
            continue;
        }
        if (section === 'assist') {
            // The Assist group is the form engine's Assist page: its first control has the focus.
            const first = page(root, 'assist').querySelector('.ss-assist-page .ss-field input, .ss-assist-page .ss-field select, .ss-assist-page .ss-field button');
            assert.ok(first && doc.activeElement === first, `${fold} has the focus`);
            win.close();
            host.close();
            continue;
        }
        if (section === 'tabs') {
            // Tabs & Packs is the form engine's: the Packs fold's Import button, the Tabs card's first control (the Story Suite fold's id
            // too), the Prompt card's first budget, or "Show what's sent" opened with its summary focused.
            const at = page(root, 'tabs');
            const wantedNode = fold === PACKS_FOLD ? at.querySelector('.ss-packs-import')
                : fold === SENT_FOLD ? at.querySelector('details.story-suite-sent summary')
                    : fold === PROMPT_FOLD ? at.querySelector('.ss-prompt-card .ss-field input')
                        : at.querySelector('.ss-tabs-card [role="switch"]');
            assert.ok(wantedNode, `${fold} is drawn`);
            assert.ok(doc.activeElement === wantedNode, `${fold} has the focus`);
            if (fold === SENT_FOLD) assert.equal(at.querySelector('details.story-suite-sent').open, true, 'Show what\'s sent is open');
            win.close();
            host.close();
            continue;
        }
        if (section === 'modules') {
            // Modules is the form engine's: the module's card (its heading), a group of its settings (that group's heading), Versions.
            const at = page(root, 'modules');
            const id = fold.split('::')[0];
            const wantedNode = fold === VERSIONS_FOLD ? at.querySelector('.ss-versions-card .ss-section-title')
                : fold.includes('::group:') ? [...cardOf(root, id).querySelectorAll('.ss-section-title')].find(node => node.textContent === fold.split('::group:')[1])
                    : cardOf(root, id).querySelector('summary');
            assert.ok(wantedNode, `${fold} is drawn`);
            if (fold.includes('::group:')) assert.ok(doc.activeElement === wantedNode || doc.activeElement === wantedNode.closest?.('summary') || doc.activeElement?.contains?.(wantedNode), `${fold} has the focus`);
            else assert.ok(doc.activeElement === wantedNode, `${fold} has the focus`);
            if (fold !== VERSIONS_FOLD) assert.equal(cardOf(root, id).open, true, `${fold}: the module's card is open`);
            win.close();
            host.close();
            continue;
        }
        if (section === 'diagnostics') {
            await diagnosticsDrawn(root);
            // Events is a fold card on the Diagnostics page: opened, its summary focused.
            const card = page(root, 'diagnostics').querySelector('.ss-diagnostics-fold[data-fold="story-block/events"]');
            assert.ok(card, `${fold} is drawn`);
            assert.equal(card.open, true, `${fold} is open`);
            assert.ok(doc.activeElement === card.querySelector('summary'), `${fold} has the focus`);
            win.close();
            host.close();
            continue;
        }
        const node = foldAt(root, wanted);
        assert.ok(node, `${fold} is drawn`);
        assert.equal(node.open, true, `${fold} is open`);
        assert.ok(doc.activeElement === node.querySelector('summary'), `${fold} has the focus`);
        win.close();
        host.close();
    }
    // A fold that is not there: the default page, the focus on the rail.
    const { root, win, host, doc } = await open({ window: { fold: 'nowhere' } });
    assert.equal(win.section(), 'features');
    assert.ok(doc.activeElement === railItems(root)[1]);
    host.close();
});

test('Escape closes the window when the focus has fallen to the page (a control that held it was disabled or removed)', async () => {
    const doc = setupDom();
    const listeners = [];
    doc.addEventListener = (type, fn) => listeners.push({ type, fn });
    doc.removeEventListener = (type, fn) => { const at = listeners.findIndex(entry => entry.type === type && entry.fn === fn); if (at >= 0) listeners.splice(at, 1); };
    const host = await createHost({ modules: [loot(), rpg()] });
    const closed = [];
    const win = openSettingsWindow({ registry: host.registry, settings: host.settings, features: host.features, doc, sdk: host.sdk, openState: new Map(), onClose: () => closed.push(true) });
    const key = listeners.filter(entry => entry.type === 'keydown');
    assert.equal(key.length, 1, 'one listener on the page');
    // A key from inside the window: the search box holds text, so its own Escape empties it and the window stays open (the field stops
    // the key before the window's layer sees it).
    const search = win.root.querySelector('.ss-search-input');
    search.value = 'pack';
    search.dispatch('keydown', { key: 'Escape' });
    assert.equal(search.value, '', 'the search box emptied itself');
    assert.equal(win.isOpen(), true);
    key[0].fn({ key: 'Enter', target: doc.body, preventDefault() {} });
    assert.equal(win.isOpen(), true, 'only Escape');
    // From the page (the focus fell to the body): it closes.
    key[0].fn({ key: 'Escape', target: doc.body, preventDefault() {} });
    assert.equal(win.isOpen(), false);
    assert.deepEqual(closed, [true]);
    assert.equal(listeners.length, 0, 'the listener left with the window');
    host.close();
});

test('Escape closes the window and the focus goes back; Tab stays inside; the page behind cannot take the focus', async () => {
    const doc = setupDom();
    const opener = doc.createElement('button');
    doc.body.appendChild(opener);
    opener.focus();
    const host = await createHost({ modules: [loot(), rpg()] });
    const closed = [];
    const win = openSettingsWindow({ registry: host.registry, settings: host.settings, features: host.features, doc, sdk: host.sdk, openState: new Map(), onClose: () => closed.push(true) });
    const frame = win.window;
    const reachable = () => {
        const out = [];
        const walk = node => {
            if (node.hidden) return;
            if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName) && node.getAttribute('tabindex') !== '-1' && !node.disabled) out.push(node);
            if (node.tagName === 'SUMMARY') out.push(node);
            if (node.tagName === 'DETAILS' && !node.open) { node.children.filter(child => child.tagName === 'SUMMARY').forEach(walk); return; }
            node.children.forEach(walk);
        };
        walk(frame);
        return out;
    };
    const stops = reachable();
    assert.ok(stops.length > 4);
    // Tab on the last stop wraps to the first, Shift+Tab on the first to the last.
    stops.at(-1).focus();
    const forward = frame.dispatch('keydown', { key: 'Tab' });
    assert.equal(forward.defaultPrevented, true);
    assert.ok(win.window.contains(doc.activeElement));
    assert.ok(doc.activeElement === stops[0], 'wrapped to the first');
    stops[0].focus();
    const back = stops[0].dispatch('keydown', { key: 'Tab', shiftKey: true });
    assert.equal(back.defaultPrevented, true);
    assert.ok(doc.activeElement === stops.at(-1), 'wrapped to the last');
    // A Tab in the middle is left to the browser.
    stops[1].focus();
    assert.equal(stops[1].dispatch('keydown', { key: 'Tab' }).defaultPrevented, false);
    // Escape.
    const escape = frame.dispatch('keydown', { key: 'Escape' });
    assert.equal(escape.defaultPrevented, true);
    assert.equal(win.isOpen(), false);
    assert.equal(doc.querySelector('#story_suite_v2_overlay'), null);
    assert.deepEqual(closed, [true]);
    assert.ok(doc.activeElement === opener, 'back where it was');
    host.close();
});

test('a click on the dimmed page beside the window closes it; a drag that starts inside does not', async () => {
    const { root, win, host } = await open();
    root.dispatch('mousedown');
    root.querySelector('.ss-settings-content').dispatch('click');
    assert.equal(win.isOpen(), true, 'a click inside the window');
    root.querySelector('.ss-settings-content').dispatch('mousedown');
    root.dispatch('click');
    assert.equal(win.isOpen(), true, 'pressed inside, released outside: a text selection');
    root.dispatch('mousedown');
    root.dispatch('click');
    assert.equal(win.isOpen(), false);
    host.close();
});

test('opening it again closes the one there; the focus guard goes with each window', async () => {
    const doc = setupDom();
    const host = await createHost({ modules: [loot(), rpg()] });
    const options = { registry: host.registry, settings: host.settings, features: host.features, doc, sdk: host.sdk, openState: new Map() };
    const first = openSettingsWindow(options);
    const second = openSettingsWindow(options);
    assert.equal(first.isOpen(), false);
    assert.equal(doc.querySelectorAll('#story_suite_v2_overlay').length, 1);
    assert.equal(doc.listeners.filter(entry => entry.type === 'focusin').length, 1);
    second.close();
    assert.equal(doc.listeners.filter(entry => entry.type === 'focusin').length, 0);
    host.close();
});
