// The world start editor (ST-START): the start date with the month named from the paired calendar, the start place picker, the world at
// the start (conditions and facts), keys a format 4 world does not take, the checker's problems under their fields, and the fallbacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/start.js';
import { buildRefs } from '../../../studio/model/refs.js';

const read = name => JSON.parse(readFileSync(new URL(`../../packs/studio/fixtures/${name}`, import.meta.url), 'utf8'));
const WORLD = read('world4-mini.json');
const GAME = read('game4-mini.json');

function setup(start = WORLD.content.start, opts = {}) {
    installFakeDom();
    const pack = structuredClone(WORLD);
    pack.content.start = structuredClone(start);
    const calls = { commit: [], go: [] };
    const ctx = { doc: pack, kind: 'world', legacy: false, other: opts.other ?? null, refs: buildRefs(pack), problems: opts.problems ?? [], focus: null,
        commit: patches => { calls.commit.push(patches); return opts.refuse ? { ok: false, refusal: 'Not now.' } : { ok: true }; },
        go: (...args) => calls.go.push(args), keep: () => ({}), ...opts.ctx };
    const nodes = editSection({ key: 'start', where: 'content', value: pack.content.start, count: 1 }, ctx);
    const root = document.createElement('div');
    root.append(...nodes);
    document.body.replaceChildren(root);
    return { root, calls, nodes };
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const edit = (root, key, value) => { const input = field(root, key).querySelector('input'); input.value = value; input.dispatch('change'); };
const dated = (date = { era: 'CY', year: 611, month: 10, day: 1, hour: 7 }) => ({ ...WORLD.content.start, date });

test('with no date: the story starts on day 1, and Add a start date sets year 1, month 1, day 1', () => {
    const { root, calls } = setup();
    assert.match(field(root, 'date').textContent, /No start date/);
    root.querySelector('.st-adddate').click();
    assert.deepEqual(calls.commit, [[{ op: 'set', path: ['content', 'start', 'date'], value: { year: 1, month: 1, day: 1 } }]]);
    assert.ok(root.querySelector('.st-jsonrow'), 'the start has its JSON row');
});

test('the date fields: each edit is one patch, the era is trimmed, a blank optional field is removed, a blank required one is refused', () => {
    const { root, calls } = setup(dated());
    assert.deepEqual(['era', 'year', 'month', 'day', 'hour', 'minute'].map(key => field(root, `date.${key}`).querySelector('input').value), ['CY', '611', '10', '1', '7', '']);
    edit(root, 'date.year', '612');
    edit(root, 'date.era', '  AR ');
    edit(root, 'date.hour', '');
    edit(root, 'date.minute', '');
    assert.deepEqual(calls.commit, [
        [{ op: 'set', path: ['content', 'start', 'date', 'year'], value: 612 }],
        [{ op: 'set', path: ['content', 'start', 'date', 'era'], value: 'AR' }],
        [{ op: 'remove', path: ['content', 'start', 'date', 'hour'] }],
    ]);
    edit(root, 'date.day', '');
    assert.equal(calls.commit.length, 3);
    assert.match(field(root, 'date.day').querySelector('.st-problem').textContent, /Day is needed/);
    root.querySelector('.st-dropdate').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'start', 'date'] }]);
});

test('the month is named from the open game pack\'s calendar, or the built-in one; a month the calendar lacks points at Pairing', () => {
    const hint = (date, other) => field(setup(dated(date), { other }).root, 'date.month').querySelector('small').textContent;
    assert.equal(hint({ year: 1, month: 10, day: 1 }, null), 'October in the built-in calendar');
    assert.equal(hint({ year: 1, month: 2, day: 1 }, GAME), 'Bloom in Studio game 4 (test)');
    assert.equal(hint({ year: 1, month: 10, day: 1 }, GAME), 'Studio game 4 (test) has 4 months, so this month never comes: see Pairing');
});

test('the place picker lists the pack\'s places; a pick sets the id, No start place removes it, and Open goes to the place', () => {
    const { root, calls } = setup({ ...WORLD.content.start, place: 'reedmoor' });
    const button = field(root, 'place').querySelector('.st-pickbtn');
    assert.equal(button.textContent, 'Reedmoor');
    button.click();
    const items = document.querySelectorAll('.slist button');
    assert.deepEqual(items.map(item => item.dataset.id), ['', 'fenhold', 'reedmoor']);
    items[1].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'start', 'place'], value: 'fenhold' }]);
    button.click();
    document.querySelectorAll('.slist button')[0].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'start', 'place'] }]);
    field(root, 'place').querySelector('.st-open-place').click();
    assert.deepEqual(calls.go, [['map', 'places.1']]);
    assert.equal(setup().root.querySelector('[data-key="place"] .st-pickbtn').textContent, 'None');
});

test('the world at the start: conditions and facts as chips; adding keeps the other list, emptying both takes world out', () => {
    const { root, calls } = setup({ world: { set: ['lamps-out@the-fen: 10 days'], facts: ['old-lamps'] } });
    const set = field(root, 'world.set');
    assert.deepEqual(set.querySelectorAll('.kc').map(chip => chip.childNodes[0].textContent), ['lamps-out@the-fen: 10 days']);
    assert.match(set.querySelector('small').textContent, /This pack's conditions: lamps-out\./);
    const add = set.querySelector('input.kadd');
    add.value = 'lamps-out@reedmoor: 2 days'; add.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'start', 'world'], value: { set: ['lamps-out@the-fen: 10 days', 'lamps-out@reedmoor: 2 days'], facts: ['old-lamps'] } }]);
    field(root, 'world.facts').querySelector('.kc button').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'start', 'world'], value: { set: ['lamps-out@the-fen: 10 days'] } }]);
    const alone = setup({ world: { set: ['lamps-out@the-fen: 10 days'] } });
    field(alone.root, 'world.set').querySelector('.kc button').click();
    assert.deepEqual(alone.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'start', 'world'] }]);
});

test('a key a format 4 world start does not take is shown with the checker\'s pointer and Remove', () => {
    const { root, calls } = setup({ ...WORLD.content.start, scene: { place: { name: 'Fenhold' } }, odd: 1 });
    const stray = root.querySelector('.st-stray');
    assert.match(stray.querySelector('.gt').textContent, /Not world start fields · 2/);
    assert.match(field(stray, 'scene').textContent, /use start\.place \(a place id\) instead/);
    assert.match(field(stray, 'odd').textContent, /does not take this field/);
    field(stray, 'scene').querySelector('.st-dropkey').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'start', 'scene'] }]);
    assert.equal(setup().root.querySelector('.st-stray'), null);
});

test('the checker\'s problems show under their fields, and a refused change is said', () => {
    const problems = [
        { path: 'content.start.date.month', message: 'The start: month must be a whole number from 1 to 99.', level: 'error' },
        { path: 'content.start.place', message: 'The start: start.place names "nowhere", which is not the id of a place in this pack.', level: 'error' },
        { path: 'content.start.world.set[0]', message: 'The start: "x" is not a condition.', level: 'error' },
    ];
    const { root } = setup({ ...dated({ year: 1, month: 0, day: 1 }), place: 'nowhere', world: { set: ['x'] } }, { problems });
    assert.match(field(root, 'date.month').querySelector('.st-problem').textContent, /month must be a whole number/);
    assert.match(field(root, 'place').querySelector('.st-problem').textContent, /not the id of a place/);
    assert.equal(field(root, 'place').querySelector('.st-pickbtn').textContent, 'nowhere');
    assert.match(field(root, 'world.set').querySelector('.st-problem').textContent, /is not a condition/);
    assert.equal(field(root, 'date.year').querySelector('.st-problem'), null);
    const refused = setup(dated(), { refuse: true });
    edit(refused.root, 'date.year', '2');
    const said = refused.root.querySelector('.st-start > .st-problem');
    assert.equal(said.textContent, 'Not now.');
    assert.equal(said.hidden, false);
});

test('a format 3 pack, a start that is not an object, or no commit falls back to the read-only cards', () => {
    assert.equal(setup(WORLD.content.start, { ctx: { legacy: true } }).root.querySelector('.st-start'), null);
    assert.equal(setup(['not', 'a', 'start']).root.querySelector('.st-start'), null);
    assert.equal(setup(WORLD.content.start, { ctx: { commit: undefined } }).root.querySelector('.st-start'), null);
    assert.ok(setup().root.querySelector('.st-start'));
});
