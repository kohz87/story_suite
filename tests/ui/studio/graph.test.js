// The event graph page (ST-GRAPH): the graph read from the reference index, the part around a centre one or two steps out, and the page:
// the start card, the toolbar (centre picker, steps, back, line types), boxes and lines, folding, opening a record, the narrow lists and empty states.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { LINES, around, graphOf, renderPage } from '../../../studio/views/graph.js';
import { buildRefs } from '../../../studio/model/refs.js';

const ALL = new Set(LINES.map(([type]) => type));
const PACK = () => ({ id: 'g', name: 'G', content: {
    regions: [{ id: 'north', name: 'North' }],
    conditions: [{ name: 'war', scope: 'region' }, { name: 'peace', scope: 'region' }],
    worldEvents: [
        { id: 'race', kind: 'one-off' },
        { id: 'forgery', kind: 'chain-stage', outcomes: [{ name: 'a' }, { name: 'b' }], requires: ['fired:race'], window: { after: 'fired:race + 540 days' }, effects: { set: ['war@north'], clear: ['peace@north'] } },
        { id: 'war-ends', kind: 'one-off', requires: ['war@north'], pre_empted_by: ['fired:forgery'], likelier_if: { 'set:peace@north': '×2' } },
        { id: 'later', kind: 'recurring', requires: ['fired:war-ends'] },
        { id: 'typo', kind: 'one-off', requires: ['fired:forgery-fail'] },
    ] } });

function setup(opts = {}) {
    installFakeDom();
    const pack = PACK();
    opts.edit?.(pack);
    const calls = { go: [] };
    const keeps = {};
    const ctx = { doc: pack, kind: opts.kind ?? 'world', legacy: opts.legacy ?? false, refs: buildRefs(pack), problems: [], focus: opts.focus ?? null,
        go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}) };
    const draw = () => renderPage(ctx)[0];
    return { pack, ctx, calls, keeps, draw };
}
const boxes = root => root.querySelectorAll('.st-gwide .st-gnode').map(node => node.dataset.node);
const lines = root => root.querySelectorAll('.st-gwide path.st-gl').map(path => `${path.dataset.from}>${path.dataset.to} ${path.dataset.type}`);

test('the graph has every event and condition, a box for an id the pack does not define, and one line per kind of link in story order', () => {
    const pack = PACK();
    const graph = graphOf(buildRefs(pack), pack);
    assert.deepEqual([...graph.nodes.keys()], ['event:race', 'event:forgery', 'event:war-ends', 'event:later', 'event:typo', 'condition:war', 'condition:peace', 'event:forgery-fail']);
    assert.equal(graph.nodes.get('event:forgery').sub, 'chain stage · 2 outcomes');
    assert.equal(graph.nodes.get('condition:war').sub, 'condition · region');
    assert.deepEqual([graph.nodes.get('event:forgery-fail').missing, graph.nodes.get('event:forgery-fail').sub], [true, 'not in this pack']);
    const got = graph.edges.map(edge => `${edge.from}>${edge.to} ${edge.type}`).sort();
    assert.deepEqual(got, ['condition:peace>event:war-ends likelier', 'condition:war>event:war-ends requires', 'event:forgery-fail>event:typo requires', 'event:forgery>condition:peace clears',
        'event:forgery>condition:war sets', 'event:forgery>event:war-ends after', 'event:race>event:forgery before', 'event:race>event:forgery requires', 'event:war-ends>event:later requires']);
    assert.equal(graph.edges.find(edge => edge.type === 'before').words, 'forgery · not before: fired:race + 540 days');
    assert.equal(graph.degree.get('event:forgery'), 5);
});

test('around a centre: what comes before is left, what follows right, and a box after a shown box moves one column further out', () => {
    const pack = PACK();
    const graph = graphOf(buildRefs(pack), pack);
    const one = around(graph, 'event:forgery', 1, ALL);
    assert.deepEqual(Object.fromEntries(one.cols), { 'event:forgery': 0, 'event:race': -1, 'condition:war': 1, 'condition:peace': 1, 'event:war-ends': 2 });
    const two = around(graph, 'event:forgery', 2, ALL);
    assert.equal(two.cols.get('event:later'), 3);
    const noAfter = around(graph, 'event:forgery', 1, new Set([...ALL].filter(type => type !== 'after')));
    assert.equal(noAfter.cols.has('event:war-ends'), false);
});

test('with no centre the page offers Pick… and the most linked; a most-linked button centres the graph', () => {
    const { draw, keeps } = setup();
    const page = draw();
    assert.ok(page.querySelector('.st-gstart .st-gpick'));
    const top = page.querySelectorAll('.st-gtopbtn');
    assert.equal(top[0].dataset.node, 'event:forgery');
    assert.match(top[0].textContent, /forgery 5/);
    top[0].click();
    assert.equal(keeps.graph.centre, 'event:forgery');
    assert.deepEqual(boxes(page), ['event:race', 'event:forgery', 'condition:war', 'condition:peace', 'event:war-ends']);
});

test('an event opened elsewhere centres the graph once; the toolbar counts each kind of line and the lines carry their words', () => {
    const { draw } = setup({ focus: { rec: 'worldEvents.1', path: null } });
    const page = draw();
    assert.match(page.querySelector('.st-gbar .st-gpick').textContent, /✦ forgery ▾/);
    assert.deepEqual(page.querySelectorAll('.st-gtype').map(chip => chip.textContent), ['Sets · 1', 'Clears · 1', 'Requires · 2', 'Not before · 1', 'Not after · 1', 'Likelier if · 1']);
    assert.ok(page.querySelector('.st-gnode[data-node="event:forgery"]').classList.contains('st-gcur'));
    assert.deepEqual(lines(page).sort(), ['condition:peace>event:war-ends likelier', 'condition:war>event:war-ends requires', 'event:forgery>condition:peace clears', 'event:forgery>condition:war sets',
        'event:forgery>event:war-ends after', 'event:race>event:forgery before', 'event:race>event:forgery requires']);
    assert.equal(page.querySelector('path[data-type="before"] title').textContent, 'forgery · not before: fired:race + 540 days');
    assert.equal(page.querySelector('path[data-type="sets"]').getAttribute('marker-end'), 'url(#st-gm-sets)');
});

test('2 steps reaches further; ◎ centres on a box and Back returns', () => {
    const { draw, keeps } = setup({ focus: { rec: 'worldEvents.1', path: null } });
    const page = draw();
    page.querySelector('[data-steps="2"]').click();
    assert.ok(boxes(page).includes('event:later'));
    assert.equal(page.querySelector('.st-gback').hasAttribute('disabled'), true);
    page.querySelector('.st-gwide .st-gnode[data-node="condition:war"] .st-gcentre').click();
    assert.equal(keeps.graph.centre, 'condition:war');
    assert.match(page.querySelector('.st-gbar .st-gpick').textContent, /◐ war/);
    page.querySelector('.st-gback').click();
    assert.equal(keeps.graph.centre, 'event:forgery');
});

test('a line type turned off hides its lines, keeps its count, says so, and Show every line brings them back', () => {
    const { draw } = setup({ focus: { rec: 'worldEvents.1', path: null } });
    const page = draw();
    page.querySelector('.st-gtype[data-type="after"]').click();
    assert.equal(page.querySelector('.st-gtype[data-type="after"]').getAttribute('aria-pressed'), 'false');
    assert.match(page.querySelector('.st-gtype[data-type="after"]').textContent, /Not after · 1/);
    assert.equal(lines(page).some(line => line.endsWith(' after')), false);
    assert.match(page.querySelector('.st-goff').textContent, /Not after is off: 3 lines are hidden/);
    page.querySelector('.st-gall').click();
    assert.equal(page.querySelector('.st-goff'), null);
    assert.ok(lines(page).some(line => line.endsWith(' after')));
});

test('tapping a box opens its record; a box for an id the pack does not define cannot be opened', () => {
    const { draw, calls } = setup({ focus: { rec: 'worldEvents.4', path: null } });
    const page = draw();
    page.querySelector('.st-gwide .st-gnode[data-node="event:typo"] .st-gopen').click();
    assert.deepEqual(calls.go.at(-1), ['events', 'worldEvents.4']);
    const missing = page.querySelector('.st-gwide .st-gnode[data-node="event:forgery-fail"]');
    assert.ok(missing.classList.contains('st-gmiss'));
    assert.match(missing.textContent, /not in this pack/);
    assert.equal(missing.querySelector('.st-gopen').hasAttribute('disabled'), true);
    const cond = setup({ focus: { rec: 'conditions.0', path: null } });
    cond.draw().querySelector('.st-gwide .st-gnode[data-node="condition:war"] .st-gopen').click();
    assert.deepEqual(cond.calls.go.at(-1), ['conditions', 'conditions.0']);
});

test('the centre picker lists events and conditions with their lines and centres on the pick', () => {
    const { draw, keeps } = setup({ focus: { rec: 'worldEvents.0', path: null } });
    draw().querySelector('.st-gbar .st-gpick').click();
    const items = globalThis.document.querySelectorAll('.slist button');
    assert.deepEqual(items.map(item => item.dataset.id), ['event:race', 'event:forgery', 'event:war-ends', 'event:later', 'event:typo', 'condition:war', 'condition:peace']);
    assert.match(items[5].textContent, /war.*condition.*2 lines/);
    items[2].click();
    assert.equal(keeps.graph.centre, 'event:war-ends');
});

test('a column shows 7 boxes and folds the rest into "+ n more" until it is opened', () => {
    const many = Array.from({ length: 9 }, (_, n) => ({ id: `after-${n}`, kind: 'one-off', requires: ['war@north'] }));
    const { draw } = setup({ focus: { rec: 'conditions.0', path: null }, edit: pack => pack.content.worldEvents.push(...many) });
    const page = draw();
    const right = boxes(page).filter(key => key.startsWith('event:after-'));
    assert.equal(right.length, 5);
    const more = page.querySelector('.st-gmore');
    assert.match(more.textContent, /\+ 4 more.*that follow it/);
    more.click();
    assert.equal(boxes(page).filter(key => key.startsWith('event:after-')).length, 9);
});

test('the narrow lists: before it, the centre, after it, each with the lines to the centre', () => {
    const { draw } = setup({ focus: { rec: 'worldEvents.1', path: null } });
    const list = draw().querySelector('.st-glist');
    const groups = list.querySelectorAll('.st-gside');
    assert.match(groups[0].textContent, /Before it · 1/);
    assert.match(groups[0].querySelector('[data-node="event:race"]').textContent, /Requires.*Not before \+540 days/);
    assert.match(list.querySelector('.st-gcentrecard').textContent, /chain stage · 2 outcomes · 5 lines in all/);
    assert.match(groups[1].textContent, /After it · 3/);
    assert.match(groups[1].querySelector('[data-node="condition:peace"]').textContent, /Clears/);
    assert.match(list.textContent, /2 more lines join these to each other/);
});

test('a pack with no events says so; a game pack or a format 3 pack draws no graph', () => {
    const empty = setup({ edit: pack => { pack.content.worldEvents = []; } });
    assert.match(empty.draw().querySelector('.st-gempty').textContent, /No events yet/);
    assert.deepEqual(renderPage({ ...setup().ctx, kind: 'game' }), []);
    assert.deepEqual(renderPage({ ...setup().ctx, legacy: true }), []);
});
