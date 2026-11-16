// The blocks built from the building blocks (UI stage 1b): ss.tabs, ss.navbar and ss.dialog.
import test from 'node:test';
import assert from 'node:assert/strict';
import { navItems, navbar, revealItem, tabs } from '../../../../src/v2/view/widgets/nav.js';
import { dialog, dialogActions, dialogParagraphs } from '../../../../src/v2/view/widgets/dialog.js';
import { fakeApi, host, installDom } from './fake-dom.js';
import { classes, key, mount } from './blocks.helpers.js';

// ---- tabs and navbar ---------------------------------------------------------------------------------

const ITEMS = { items: [{ id: 'world', label: 'World' }, { id: 'quests', label: 'Quests', count: '3' }, { id: 'party', label: 'Party', disabled: true }, { id: 'bag', label: 'Bag' }], current: 'quests', onSelect: 'ui.go', label: 'Panel sections' };

for (const [kind, widget] of [['tabs', tabs], ['navbar', navbar]]) {
    test(`${kind}: a nav of buttons, the current one aria-current, a roving tabindex, a count chip, disabled ones skipped`, () => {
        const m = mount(widget, ITEMS);
        assert.equal(m.root.tagName, 'NAV');
        assert.ok(classes(m.root).includes(`ss-${kind}`));
        assert.equal(m.root.getAttribute('aria-label'), 'Panel sections');
        const buttons = m.el.querySelectorAll(`.ss-${kind}-item`);
        assert.deepEqual(buttons.map(b => b.querySelector(`.ss-${kind}-label`).textContent), ['World', 'Quests', 'Party', 'Bag']);
        assert.deepEqual(buttons.map(b => b.getAttribute('aria-current')), [null, 'page', null, null]);
        assert.deepEqual(buttons.map(b => b.getAttribute('tabindex')), ['-1', '0', '-1', '-1'], 'one Tab stop: the current item');
        assert.ok(buttons.every(b => b.getAttribute('type') === 'button'));
        assert.equal(buttons[1].getAttribute('aria-label'), 'Quests, 3');
        assert.equal(buttons[1].querySelector(`.ss-${kind}-count`).textContent, '3');
        assert.ok(buttons[2].disabled && buttons[2].getAttribute('aria-disabled') === 'true');
        // No current: the first enabled item is the stop.
        m.handle.update({ ...ITEMS, current: '' });
        assert.deepEqual(m.el.querySelectorAll(`.ss-${kind}-item`).map(b => b.getAttribute('tabindex')), ['0', '-1', '-1', '-1']);
        assert.ok(m.el.querySelectorAll(`.ss-${kind}-item`).every(b => b.getAttribute('aria-current') === null));
    });

    test(`${kind}: a choice runs { ${kind}: id } and shows at once; the screen's new \`current\` wins; a disabled item does nothing`, () => {
        const m = mount(widget, ITEMS);
        const buttons = () => m.el.querySelectorAll(`.ss-${kind}-item`);
        buttons()[3].click();
        assert.deepEqual(m.api.commands, [{ type: 'ui.go', payload: { [kind]: 'bag' } }]);
        assert.deepEqual(buttons().map(b => b.getAttribute('aria-current')), [null, null, null, 'page']);
        assert.equal(buttons()[3].getAttribute('tabindex'), '0');
        buttons()[2].click();
        assert.equal(m.api.commands.length, 1, 'disabled');
        m.handle.update(ITEMS);
        assert.equal(buttons()[3].getAttribute('aria-current'), 'page', 'the same prop: the reader\'s choice stays');
        m.handle.update({ ...ITEMS, current: 'world' });
        assert.deepEqual(buttons().map(b => b.getAttribute('aria-current')), ['page', null, null, null]);
        // No command and no api: still a working nav.
        const bare = mount(widget, { items: ITEMS.items }, undefined);
        bare.el.querySelectorAll(`.ss-${kind}-item`)[0].click();
        assert.equal(bare.el.querySelectorAll(`.ss-${kind}-item`)[0].getAttribute('aria-current'), 'page');
    });

    test(`${kind}: the arrow keys, Home and End move the focus (not the choice), skip disabled items and wrap`, () => {
        const m = mount(widget, ITEMS);
        const buttons = () => m.el.querySelectorAll(`.ss-${kind}-item`);
        buttons()[1].focus();
        let event = key(buttons()[1], 'ArrowRight');
        assert.ok(event.defaultPrevented);
        assert.equal(m.doc.activeElement, buttons()[3], 'the disabled one is skipped');
        assert.equal(buttons()[3].getAttribute('tabindex'), '0');
        assert.equal(buttons()[1].getAttribute('tabindex'), '-1');
        key(buttons()[3], 'ArrowRight');
        assert.equal(m.doc.activeElement, buttons()[0], 'wraps to the first');
        key(buttons()[0], 'ArrowLeft');
        assert.equal(m.doc.activeElement, buttons()[3], 'and back');
        key(buttons()[3], 'Home');
        assert.equal(m.doc.activeElement, buttons()[0]);
        key(buttons()[0], 'End');
        assert.equal(m.doc.activeElement, buttons()[3]);
        key(buttons()[3], 'ArrowUp');
        assert.equal(m.doc.activeElement, buttons()[1]);
        event = key(buttons()[1], 'a');
        assert.ok(!event.defaultPrevented, 'other keys are left alone');
        assert.equal(m.api.commands.length, 0, 'moving the focus chooses nothing');
        assert.deepEqual(buttons().map(b => b.getAttribute('aria-current')), [null, 'page', null, null]);
        // A redraw keeps the focus on the same item.
        buttons()[3].focus();
        m.handle.update({ ...ITEMS, items: [...ITEMS.items, { id: 'fight', label: 'Fight' }] });
        assert.equal(m.doc.activeElement.getAttribute('data-id'), 'bag');
    });

    test(`${kind}: the item the focus moves to is scrolled into view when the row is wider than its box`, () => {
        const m = mount(widget, { ...ITEMS, items: Array.from({ length: 8 }, (_, i) => ({ id: `i${i}`, label: `Item ${i}` })), current: 'i0' });
        const list = m.el.querySelector(`.ss-${kind}-list`);
        list.rect = { left: 0, top: 0, width: 300, height: 50 };
        const buttons = m.el.querySelectorAll(`.ss-${kind}-item`);
        buttons.forEach((b, i) => { b.rect = { left: i * 100 - 40, top: 0, width: 90, height: 44 }; });
        buttons[0].focus();
        key(buttons[0], 'ArrowRight');
        key(buttons[1], 'ArrowRight');
        key(buttons[2], 'ArrowRight');
        assert.equal(list.scrolled.length, 1, 'only the item that was out of view');
        assert.deepEqual(list.scrolled[0], { left: 260 - (300 - 90) / 2, behavior: 'smooth' }, 'centred');
    });
}

test('revealItem in a zoomed root (size.css): the drawn distance is turned into the list\'s own pixels', () => {
    const list = { getBoundingClientRect: () => ({ left: 0, right: 240, width: 240 }), currentCSSZoom: 0.8, scrollBy(o) { this.did = o; }, ownerDocument: {} };
    const item = { getBoundingClientRect: () => ({ left: 320, right: 392, width: 72 }) };
    assert.equal(revealItem(list, item), true);
    assert.deepEqual(list.did, { left: (320 - (240 - 72) / 2) / 0.8, behavior: 'auto' });
});

test('revealItem: only an item that is cut off is scrolled, centred; nothing before layout', () => {
    const list = { getBoundingClientRect: () => ({ left: 0, right: 300, width: 300 }), scrollBy(o) { this.did = o; }, ownerDocument: {} };
    const item = rect => ({ getBoundingClientRect: () => rect });
    assert.equal(revealItem(list, item({ left: 10, right: 100, width: 90 })), false);
    assert.equal(revealItem(list, item({ left: 400, right: 490, width: 90 })), true);
    assert.deepEqual(list.did, { left: 400 - (300 - 90) / 2, behavior: 'auto' });
    revealItem(list, item({ left: -50, right: 40, width: 90 }), true);
    assert.deepEqual(list.did, { left: -50 - 105, behavior: 'smooth' });
    assert.equal(revealItem({ getBoundingClientRect: () => ({ left: 0, right: 0, width: 0 }) }, item({ left: 5, right: 9, width: 4 })), false, 'not laid out');
    assert.equal(revealItem(null, null), false);
    const plain = { getBoundingClientRect: () => ({ left: 0, right: 300, width: 300 }), scrollLeft: 20, ownerDocument: {} };
    revealItem(plain, item({ left: 400, right: 490, width: 90 }));
    assert.equal(plain.scrollLeft, 20 + 295, 'no scrollBy: scrollLeft');
    // Reduced motion: no smooth scrolling.
    const calm = { getBoundingClientRect: () => ({ left: 0, right: 300, width: 300 }), scrollBy(o) { this.did = o; }, ownerDocument: { defaultView: { matchMedia: () => ({ matches: true }) } } };
    revealItem(calm, item({ left: 400, right: 490, width: 90 }), true);
    assert.equal(calm.did.behavior, 'auto');
});

test('navItems: the first of each id, at most 24, text cut, junk dropped', () => {
    assert.equal(navItems(Array.from({ length: 40 }, (_, i) => ({ id: `i${i}`, label: 'x' }))).length, 24);
    assert.deepEqual(navItems([{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }, null, 7, {}, { label: 'No id' }]).map(i => [i.id, i.label]), [['a', 'A'], ['No id', 'No id']]);
    assert.equal(navItems([{ id: 'a', label: 'y'.repeat(99) }])[0].label.length, 40);
    assert.deepEqual(navItems('nope'), []);
});

// ---- dialog ------------------------------------------------------------------------------------------

const DIALOG = { title: 'Rest at the Guild Office?', text: 'Resting takes eight hours.\n\nThe bleeding will close.', actions: [{ id: 'cancel', label: 'Not now' }, { id: 'rest', label: 'Rest', kind: 'primary', icon: 'fa-moon' }], onSelect: 'ui.dialog' };

function openDialog(props = DIALOG, api = fakeApi()) {
    const doc = installDom();
    const opener = doc.createElement('button');
    doc.body.appendChild(opener);
    opener.focus();
    const el = host(doc);
    const handle = dialog.render(el, props, api);
    return { doc, el, api, handle, opener, root: el.children[0], panel: el.querySelector('.ss-modal-panel') };
}

test('dialog: a labelled modal, described by its text, with its actions; the main action takes the focus', () => {
    const m = openDialog();
    assert.ok(classes(m.root).includes('ss-modal'), 'ss-modal*, not the mount\'s ss-dialog*');
    assert.ok(!m.el.querySelector('.ss-dialog'));
    assert.equal(m.panel.getAttribute('role'), 'dialog');
    assert.equal(m.panel.getAttribute('aria-modal'), 'true');
    const title = m.el.querySelector('.ss-modal-title');
    assert.equal(title.textContent, 'Rest at the Guild Office?');
    assert.equal(m.panel.getAttribute('aria-labelledby'), title.id);
    assert.equal(m.panel.getAttribute('aria-describedby'), m.el.querySelector('.ss-modal-text').id);
    assert.ok(title.id && title.id.startsWith('ss-modal-'));
    assert.deepEqual(m.el.querySelectorAll('.ss-modal-paragraph').map(n => n.textContent), ['Resting takes eight hours.', 'The bleeding will close.']);
    const actions = m.el.querySelectorAll('.ss-modal-action');
    assert.deepEqual(actions.map(a => a.textContent), ['Not now', 'Rest']);
    assert.ok(classes(actions[1]).includes('ss-modal-primary') && classes(actions[0]).includes('ss-modal-plain'));
    assert.ok(m.el.querySelector('i.fa-moon'));
    assert.equal(m.el.querySelector('.ss-modal-close').getAttribute('aria-label'), 'Close');
    assert.equal(m.doc.activeElement, actions[1], 'the main action');
    assert.ok(!m.root.hidden);
    // Alert: alertdialog; no title: named by `label`.
    m.handle.update({ ...DIALOG, title: '', alert: true, label: 'Confirm rest' });
    assert.equal(m.panel.getAttribute('role'), 'alertdialog');
    assert.equal(m.panel.getAttribute('aria-labelledby'), null);
    assert.equal(m.panel.getAttribute('aria-label'), 'Confirm rest');
});

test('dialog: Escape closes it with { dialog: "close" }, and the focus goes back to where it was', () => {
    const m = openDialog();
    const event = m.doc.fire('keydown', { key: 'Escape' });
    assert.ok(event.defaultPrevented && event.stopped);
    assert.deepEqual(m.api.commands, [{ type: 'ui.dialog', payload: { dialog: 'close' } }]);
    assert.ok(m.root.hidden);
    assert.equal(m.doc.activeElement, m.opener);
    assert.equal(m.doc.docListeners.length, 0, 'its document listeners are gone');
    // Closed: the keys are not its business any more.
    m.doc.fire('keydown', { key: 'Escape' });
    assert.equal(m.api.commands.length, 1);
});

test('dialog: Tab and Shift+Tab stay inside the panel, and a focus that lands outside is brought back', () => {
    const m = openDialog();
    const nodes = [m.el.querySelector('.ss-modal-close'), ...m.el.querySelectorAll('.ss-modal-action')];
    nodes.at(-1).focus();
    let event = m.doc.fire('keydown', { key: 'Tab', shiftKey: false });
    assert.ok(event.defaultPrevented);
    assert.equal(m.doc.activeElement, nodes[0], 'past the last: the first');
    event = m.doc.fire('keydown', { key: 'Tab', shiftKey: true });
    assert.ok(event.defaultPrevented);
    assert.equal(m.doc.activeElement, nodes.at(-1), 'before the first: the last');
    nodes[1].focus();
    event = m.doc.fire('keydown', { key: 'Tab', shiftKey: false });
    assert.ok(!event.defaultPrevented, 'in the middle: the browser moves on');
    // Focus on the page behind goes back in.
    m.opener.focus();
    m.doc.fire('focusin', {}, m.opener);
    assert.ok(m.panel.contains(m.doc.activeElement));
    // Without a close button or actions the panel itself keeps the focus.
    const lone = openDialog({ title: 'Note', closable: false });
    lone.doc.fire('keydown', { key: 'Tab' });
    assert.equal(lone.doc.activeElement, lone.panel);
});

test('dialog: an action runs { dialog: id } and closes; a click on the dimmed page closes, one on the panel does not; closable: false keeps it', () => {
    const m = openDialog();
    m.el.querySelectorAll('.ss-modal-action')[1].click();
    assert.deepEqual(m.api.commands, [{ type: 'ui.dialog', payload: { dialog: 'rest' } }]);
    assert.ok(m.root.hidden);
    assert.equal(m.doc.activeElement, m.opener);
    const b = openDialog();
    b.panel.dispatch('click', {});
    assert.ok(!b.root.hidden, 'a click inside the panel');
    b.root.dispatch('click', { target: b.root });
    assert.ok(b.root.hidden);
    assert.deepEqual(b.api.commands, [{ type: 'ui.dialog', payload: { dialog: 'close' } }]);
    const c = openDialog({ ...DIALOG, closable: false });
    assert.ok(c.el.querySelector('.ss-modal-close').hidden);
    c.doc.fire('keydown', { key: 'Escape' });
    c.root.dispatch('click', { target: c.root });
    assert.ok(!c.root.hidden && c.api.commands.length === 0);
    // The close button.
    const d = openDialog();
    d.el.querySelector('.ss-modal-close').click();
    assert.ok(d.root.hidden);
    // No command, no api: closes all the same.
    const e = openDialog({ title: 'x', actions: [{ label: 'Ok' }] }, undefined);
    e.el.querySelector('.ss-modal-action').click();
    assert.ok(e.root.hidden);
});

test('dialog: `open` toggles it; one the reader closed stays closed until the screen asks again; destroying frees the page', () => {
    const m = openDialog({ ...DIALOG, open: false });
    assert.ok(m.root.hidden);
    assert.equal(m.doc.docListeners.length, 0);
    m.handle.update({ ...DIALOG, open: true });
    assert.ok(!m.root.hidden);
    assert.equal(m.doc.docListeners.length, 2);
    m.doc.fire('keydown', { key: 'Escape' });
    assert.ok(m.root.hidden);
    m.handle.update({ ...DIALOG, open: true });
    assert.ok(m.root.hidden, 'a redraw with the same prop does not reopen it');
    m.handle.update({ ...DIALOG, open: false });
    m.handle.update({ ...DIALOG, open: true });
    assert.ok(!m.root.hidden, 'asked again');
    m.opener.focus();
    m.handle.destroy();
    assert.equal(m.el.children.length, 0);
    assert.equal(m.doc.docListeners.length, 0);
    // Destroyed while open: the focus goes back.
    const n = openDialog();
    n.handle.destroy();
    assert.equal(n.doc.activeElement, n.opener);
});

test('dialog: only the topmost of two open dialogs takes the keys', () => {
    const doc = installDom();
    const a = dialog.render(host(doc), { title: 'A', onSelect: 'a' }, fakeApi());
    const apiB = fakeApi();
    const b = dialog.render(host(doc), { title: 'B', onSelect: 'b' }, apiB);
    doc.fire('keydown', { key: 'Escape' });
    assert.equal(apiB.commands.length, 1, 'B closed');
    doc.fire('keydown', { key: 'Escape' });
    a.destroy();
    b.destroy();
});

test('dialogActions and dialogParagraphs: capped, tidied, kinds from a list', () => {
    assert.equal(dialogActions(Array.from({ length: 9 }, (_, i) => ({ label: `a${i}` }))).length, 4);
    assert.deepEqual(dialogActions([{ label: 'A', kind: 'evil' }, { id: 'b', label: 'B', kind: 'danger' }, { id: 'c' }, null]).map(a => [a.id, a.kind]), [['A', 'plain'], ['b', 'danger']]);
    assert.deepEqual(dialogParagraphs('One  two\nthree\n\n\n\nFour'), ['One two three', 'Four']);
    assert.equal(dialogParagraphs('x'.repeat(2000))[0].length, 600);
    assert.equal(dialogParagraphs(Array.from({ length: 20 }, (_, i) => `p${i}`).join('\n\n')).length, 8);
    assert.deepEqual(dialogParagraphs(null), []);
});
