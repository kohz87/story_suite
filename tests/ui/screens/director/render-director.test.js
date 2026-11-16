// Screens part: the Director screen, spoiler preference, Ripples card, and World pulse card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.js';
import { headState, makeQueries, makeState, plot, raid, smuggler, thread } from './helpers/fixtures.js';
import { DIRECTOR_ID, STATUS_CARD_ID, createBehindWidget, createScreensPart, createRipplesWidget, planWidget, questsWidget, screens } from '../../../../ui/legacy/director/screens/index.js';
import { SPOILER_STORE, createSpoilerPreference, createSpoilerSwitchWidget, spoilerSwitchWidget } from '../../../../ui/legacy/director/screens/director.js';
import { createArcWidget } from '../../../../modules/arc/widget.js';
import { draw as drawBase, pulseState, rolls, skip, squash } from './render.helpers.js';

let shown = true;
const stillReveal = { guard: () => true, revealed: () => shown, set: on => { shown = on; }, hidden: () => !shown, subscribe: () => () => {} };
const noPlanner = { status: () => ({ available: true, busy: false, draft: null, error: '', hidden: !shown, arc: null }), subscribe: () => () => {}, plan() {}, end() {} };
const moduleWidgets = () => ({ ...runtime.widgets, 'story-director.arc': createArcWidget({ controller: noPlanner }), 'story-director.behind': createBehindWidget({ reveal: stillReveal }), 'story-director.quests': questsWidget, 'story-director.plan': planWidget, 'story-director.ripples': createRipplesWidget(), 'story-director.spoiler-switch': spoilerSwitchWidget });
const draw = (id, state, opts = {}) => drawBase(id, state, { widgets: moduleWidgets(), ...opts });

test('every screen compiles and renders without a warning, and its CSS scopes cleanly', { skip }, () => {
    for (const screen of screens) {
        const { warnings } = draw(screen.id, headState());
        assert.deepEqual(warnings, [], screen.id);
        const scoped = runtime.scopeCss(screen.css, screen.id);
        assert.deepEqual(scoped.warnings, [], `${screen.id} css`);
        const prefix = `[data-ss-screen="${screen.id}"]`;
        // Every selector of every rule starts at the screen root.
        for (const match of scoped.css.matchAll(/(^|})\s*([^{}@]+)\{/g)) {
            const selectors = match[2].split(',').map(part => part.trim()).filter(Boolean);
            for (const selector of selectors) assert.ok(selector.startsWith(prefix), `${screen.id}: ${selector}`);
        }
    }
});

test('director: the arc then the plan cards; secrets by name; problems (visible, then behind the scenes); nothing tracked says so', { skip }, () => {
    const { el } = draw(DIRECTOR_ID, headState());
    const kinds = el.querySelectorAll('section.sd-kind').map(node => node.getAttribute('data-kind'));
    assert.deepEqual(kinds, ['pulse', 'arc', 'clock', 'agenda', 'secret', 'problem'], 'a Clocks card, but no Quests or World list');
    const agenda = squash(el.querySelector('section[data-kind="agenda"]').textContent);
    assert.match(agenda, /Smuggler Vane wants: moving crates at night At: the docks · Next: meet the reeve/);
    assert.equal(squash(el.querySelector('section[data-kind="secret"] .sd-thread').textContent), 'The Reeve Is Bought', 'a secret shows only its name');
    assert.equal(el.querySelectorAll('.sd-problem').length, 2);
    assert.equal(el.querySelector('.sd-empty'), null);
    const { el: none } = draw(DIRECTOR_ID, makeState());
    assert.match(squash(none.textContent), /Director shows spoilers .*No arc planned yet\. Plan arc Nothing planned yet\.$/);
});

test('director spoiler switch hides all planning cards, keeps pulse and quiet, survives redraws and restores from either control', { skip }, () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const preference = createSpoilerPreference({ storage });
    const widgets = { ...moduleWidgets(), 'story-director.spoiler-switch': createSpoilerSwitchWidget({ preference }) };
    const state = headState({ threads: [
        thread('th_beat0001', 'beat', 'A secret meeting'), thread('th_hook0001', 'hook', 'A planned hook', { then: 'the trap closes' }),
        raid(), smuggler(), plot(),
    ] });
    const queries = { ...makeQueries(), 'ripples.sway': () => [{ id: 'power', name: 'Power', sway: 52, reasons: [] }] };
    const sent = [];
    const first = draw(DIRECTOR_ID, state, { widgets, queries, command: (type, payload) => sent.push([type, payload]) });
    assert.deepEqual(first.warnings, []);
    const root = first.el;
    const group = root.querySelector('.sd-spoilers');
    const toggle = root.querySelector('button.sd-spoil');
    const note = root.querySelector('.sd-spoiler-note');
    assert.equal(toggle.getAttribute('role'), 'switch');
    assert.equal(toggle.getAttribute('aria-label'), 'Show spoilers');
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
    assert.equal(group.hidden, false);
    assert.equal(note.hidden, true);
    for (const kind of ['arc', 'beat', 'hook', 'clock', 'agenda', 'secret', 'problem', 'ripples']) {
        const card = root.querySelector(`section[data-kind="${kind}"]`);
        assert.ok(card && group.contains(card), `${kind} is in the spoiler group`);
    }
    assert.ok(root.querySelector('section[data-kind="pulse"]'));
    assert.ok(root.querySelector('.sd-quiet'));
    assert.equal(group.contains(root.querySelector('section[data-kind="pulse"]')), false);
    assert.equal(group.contains(root.querySelector('.sd-quiet')), false);
    toggle.focus();
    toggle.click();
    assert.equal(first.doc.activeElement, toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    assert.equal(group.hidden, true);
    assert.equal(note.hidden, false);
    assert.equal(note.textContent, 'Spoilers hidden — tap to show');
    assert.equal(values.get(SPOILER_STORE), 'hidden');
    assert.deepEqual(sent, [], 'a view preference sends no story command');
    first.view.update({ state, q: first.data.q, changes: [], settings: {}, mount: 'screen', screenId: DIRECTOR_ID, api: {} });
    assert.equal(group.hidden, true, 'a screen redraw keeps spoilers hidden');
    root.querySelector('.sd-quiet button').click();
    assert.deepEqual(sent, [['director.pulse.quiet', { on: true }]], 'quiet scene still works');
    const second = draw(DIRECTOR_ID, state, { widgets, queries });
    assert.equal(second.el.querySelector('.sd-spoilers').hidden, true, 'another mounted view shares the choice');
    const reloaded = createSpoilerPreference({ storage });
    assert.equal(reloaded.shown(), false, 'a new page reads the saved device choice');
    note.focus();
    note.click();
    assert.equal(first.doc.activeElement, toggle, 'activating the restore line moves focus to the switch');
    assert.equal(group.hidden, false);
    assert.equal(second.el.querySelector('.sd-spoilers').hidden, false);
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
    assert.equal(values.get(SPOILER_STORE), 'shown');
    toggle.click();
    toggle.click();
    assert.equal(group.hidden, false, 'the switch itself also restores the cards');
    first.view.destroy();
    second.view.destroy();
});

test('director spoiler preference defaults to shown and keeps a page choice when storage is blocked or damaged', () => {
    const denied = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
    const preference = createSpoilerPreference({ storage: denied });
    assert.equal(preference.shown(), true);
    preference.set(false);
    assert.equal(preference.shown(), false);
    preference.set(true);
    assert.equal(preference.shown(), true);
    assert.equal(createSpoilerPreference({ storage: { getItem: () => 'unexpected' } }).shown(), true);
    assert.equal(createSpoilerPreference({ storage: null }).shown(), true);
});

test('director spoiler choice follows another open tab: storage is re-read on each draw and a storage event redraws', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const listeners = [];
    const win = { addEventListener: (type, fn) => { if (type === 'storage') listeners.push(fn); } };
    const tabA = createSpoilerPreference({ storage, win });
    const tabB = createSpoilerPreference({ storage, win });
    let drawsB = 0;
    tabB.subscribe(() => { drawsB += 1; });
    tabA.set(false);
    assert.equal(tabB.shown(), false, 'a new mount in tab B reads the choice made in tab A');
    for (const fn of listeners) fn({ key: SPOILER_STORE });
    assert.ok(drawsB > 0, 'a storage event redraws tab B');
    const before = drawsB;
    for (const fn of listeners) fn({ key: 'other' });
    assert.equal(drawsB, before, 'unrelated keys are ignored');
    tabB.set(true);
    assert.equal(tabA.shown(), true, 'and the other direction');
    values.set(SPOILER_STORE, 'garbage');
    assert.equal(tabA.shown(), true, 'a damaged value keeps the last good choice');
});

// The Ripples card (spoilers): each power's sway bar and top reasons, "+N more"; behind Reveal; nothing without a table.
test('director: the Ripples card shows each power\'s sway bar and its top reasons, +N more; always drawn (no Reveal); none without a table', { skip }, () => {
    const reason = (delta, text) => ({ kind: 'quest', delta, text, when: null });
    const rows = [
        { id: 'wendhild', name: 'Princess Wendhild', sway: 52, reasons: [reason(8, 'finished the grain levy for Sir Lothar'), reason(4, 'finished a b'), reason(-3, 'failed c'), reason(-1, 'gave up on d')] },
        { id: 'corvin', name: 'Prince Corvin', sway: 35, reasons: [] },
    ];
    const queries = { ...makeQueries(), 'ripples.sway': () => rows };
    shown = true;
    const { el } = draw(DIRECTOR_ID, headState(), { queries });
    const card = el.querySelector('section[data-kind="ripples"]');
    assert.ok(card, 'the card is drawn');
    const first = card.querySelector('[data-power="wendhild"]');
    assert.equal(first.querySelector('[role="meter"]').getAttribute('aria-valuenow'), '52');
    assert.equal(first.querySelector('.sd-ripple-fill').style.width, '52%');
    assert.deepEqual(first.querySelectorAll('.sd-reason').map(node => squash(node.textContent)), ['+8 · finished the grain levy for Sir Lothar', '+4 · finished a b', '-3 · failed c']);
    assert.equal(squash(first.querySelector('.sd-more').textContent), '+1 more');
    assert.equal(card.querySelector('[data-power="corvin"]').querySelectorAll('.sd-reason').length, 0);
    shown = false;
    assert.ok(draw(DIRECTOR_ID, headState(), { queries }).el.querySelector('section[data-kind="ripples"]'), 'drawn with Behind hidden, no Reveal needed');
    shown = true;
    assert.equal(draw(DIRECTOR_ID, headState()).el.querySelector('section[data-kind="ripples"]'), null, 'no table: no card');
});

test('director: the World pulse card (die, kind, line, effect pill, table pill) and Recent rows (the earlier rolls, not this roll), newest first; the Quiet scene switch sends the command', { skip }, () => {
    const sent = [];
    const { el, warnings } = draw(DIRECTOR_ID, pulseState(rolls), { command: (type, payload) => sent.push([type, payload]) });
    assert.deepEqual(warnings, []);
    const card = el.querySelector('section[data-kind="pulse"]');
    assert.equal(card.querySelector('.sd-die').textContent, '14');
    assert.match(squash(card.textContent), /World pulse this reply 14 Overheard detail The inspector learns Astra paid in false coin\. rumour recorded standard · \d+ away Swipe for a fresh roll\./);
    const recent = el.querySelector('section[data-kind="pulse-recent"]');
    assert.deepEqual(recent.querySelectorAll('.sd-li').map(row => squash(row.textContent)), [
        '— Skipped fight under way',
        '3 Enter check Joren will reach the Stray Oar soon. arrival set',
    ]);
    assert.match(squash(recent.querySelector('h4').textContent), /Recent last 2/);
    assert.equal(el.querySelector('.sd-quiet small'), null, 'switch off: no "pulse paused"');
    el.querySelector('button.ss-switch').click();
    assert.deepEqual(sent, [['director.pulse.quiet', { on: true }]]);
    const { el: quiet } = draw(DIRECTOR_ID, pulseState(rolls, true), { command: (type, payload) => sent.push([type, payload]) });
    assert.equal(squash(quiet.querySelector('.sd-quiet small').textContent), 'pulse paused');
    assert.equal(quiet.querySelector('button.ss-switch').getAttribute('aria-checked'), 'true');
    quiet.querySelector('button.ss-switch').click();
    assert.deepEqual(sent.at(-1), ['director.pulse.quiet', { on: false }]);
    // No roll yet: the card says so and there are no Recent rows. Mode off, or the feature off: no card and no switch.
    assert.match(squash(draw(DIRECTOR_ID, headState()).el.querySelector('section[data-kind="pulse"]').textContent), /No roll yet/);
    assert.equal(draw(DIRECTOR_ID, headState()).el.querySelector('section[data-kind="pulse-recent"]'), null);
    const off = { ...makeQueries(), 'pulse.view': () => null };
    const gone = draw(DIRECTOR_ID, pulseState(rolls), { queries: off });
    assert.equal(gone.el.querySelector('.sd-quiet, section[data-kind="pulse"], section[data-kind="pulse-recent"]'), null);
    assert.deepEqual([...gone.warnings, ...draw(STATUS_CARD_ID, pulseState(rolls), { index: 8, queries: off }).warnings], [], 'no warning while the feature is off (the query answers null)');
    const offMode = createScreensPart({ settings: { 'pulse.mode': 'off' } }).queries;
    assert.equal(draw(DIRECTOR_ID, pulseState(rolls), { queries: { ...makeQueries(), ...offMode } }).el.querySelector('.sd-quiet, section[data-kind="pulse"]'), null);
});

test('director: with a host that has the header slot the Quiet scene switch is not drawn on the tab (the card stays); without one it is', { skip }, () => {
    const before = globalThis.StoryBlock;
    try {
        globalThis.StoryBlock = { sdk: { modules: () => [{ id: 'story-block', headerControls: [] }] } };
        const hosted = draw(DIRECTOR_ID, pulseState(rolls, true));
        assert.deepEqual(hosted.warnings, []);
        assert.equal(hosted.el.querySelector('.sd-quiet'), null, 'the header has the switch');
        assert.equal(hosted.el.querySelector('button.ss-switch'), null);
        assert.ok(hosted.el.querySelector('section[data-kind="pulse"]'), 'the World pulse card is still drawn');
        globalThis.StoryBlock = { sdk: { modules: () => [{ id: 'story-block' }] } };
        assert.ok(draw(DIRECTOR_ID, pulseState(rolls, true)).el.querySelector('.sd-quiet button.ss-switch'), 'an older host: the tab keeps its switch');
    } finally {
        if (before === undefined) delete globalThis.StoryBlock; else globalThis.StoryBlock = before;
    }
});
