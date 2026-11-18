// The powers and scores editor (ST-POW): the two lists, a record page for each, edits as patches, the held-places picker, an id rename through the
// reference index, "used by" with Go to, delete refused while used, the drift preview curve, and the read-only fallback for a format 3 pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/powers.js';
import { buildRefs } from '../../../studio/model/refs.js';

const BASE = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));

function packWith({ scores = true } = {}) {
    const pack = structuredClone(BASE);
    if (scores) pack.content.scores = [{ id: 'fen-water', name: 'Fen Water', range: [-50, 50], start: 10, means: 'How high the fen stands.' }, { id: 'lamp-trust', name: 'Lamp Trust', start: 0, drift: false }];
    pack.content.worldEvents = [{ id: 'lamp-strike', requires: ['power:lamp-guild >= 10'], effects: { powers: { 'lamp-guild': -5 } } }];
    return pack;
}

function setup(opts = {}) {
    installFakeDom();
    const pack = opts.pack ?? packWith(opts);
    const calls = { commit: [], go: [] };
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; },
        go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const draw = key => editSection({ key, where: 'content', value: pack.content[key], count: pack.content[key].length }, ctx);
    return { pack, calls, ctx, draw, keeps };
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const one = nodes => { assert.equal(nodes.filter(Boolean).length, 1); return nodes.filter(Boolean)[0]; };

test('each list shows its records with a short line, opens one with Go to, and adds one with a free id', () => {
    const { calls, draw, pack } = setup();
    const powers = one(draw('powers'));
    const rows = powers.querySelectorAll('.st-prow');
    assert.deepEqual(rows.map(r => r.dataset.rec), ['powers.0']);
    assert.match(rows[0].textContent, /The Lamp Guild/);
    assert.match(rows[0].textContent, /starts at 20 · holds 1 place/);
    const scores = one(draw('scores'));
    assert.match(scores.textContent, /Scores · 2/);
    assert.match(scores.querySelectorAll('.st-prow')[0].textContent, /starts at 10 · −50 to 50 · drifts/);
    assert.match(scores.querySelectorAll('.st-prow')[1].textContent, /no drift/);
    rows[0].click();
    assert.deepEqual(calls.go.at(-1), ['powers', 'powers.0']);
    scores.querySelector('.st-add').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'insert', path: ['content', 'scores', 2], value: { id: 'new-score', name: 'New score', start: 0 } }]);
    assert.deepEqual(calls.go.at(-1), ['powers', 'scores.2']);
    assert.equal(pack.content.scores.length, 2);
});

test('a pack with powers and no scores offers the first score from the powers section, as one set of the new list', () => {
    const { calls, draw } = setup({ scores: false });
    const nodes = draw('powers').filter(Boolean);
    assert.equal(nodes.length, 2);
    assert.match(nodes[1].textContent, /Scores · 0/);
    nodes[1].querySelector('.st-add').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'scores'], value: [{ id: 'new-score', name: 'New score', start: 0 }] }]);
    assert.deepEqual(calls.go.at(-1), ['powers', 'scores.0']);
});

test('an open power draws its page and the scores section only its list; fields edit as one patch at their path', () => {
    const { calls, draw } = setup({ focus: { rec: 'powers.0', path: null } });
    assert.equal(one(draw('scores')).querySelector('.st-pane-rec').childNodes.length, 0);
    const page = one(draw('powers'));
    assert.equal(page.querySelector('.st-rec').dataset.rec, 'powers.0');
    assert.match(page.textContent, /Power 1 of 1/);
    const start = field(page, 'start').querySelector('input');
    start.value = '-15'; start.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'powers', 0, 'start'], value: -15 }]);
    const add = field(page, 'factions').querySelector('input.kadd');
    add.value = 'Lamplighters'; add.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'powers', 0, 'factions'], value: ['Lamplighters'] }]);
    const name = field(page, 'name').querySelector('input');
    name.value = '  '; name.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'powers', 0, 'name'] }]);
});

test('the held places are chips by name; the picker lists the pack\'s places with the held one marked, and × removes one', () => {
    const { calls, draw } = setup({ focus: { rec: 'powers.0', path: null } });
    const page = one(draw('powers'));
    const holds = field(page, 'holds');
    assert.match(holds.textContent, /Fenhold/);
    holds.querySelector('.st-pickbtn').click();
    const items = globalThis.document.querySelectorAll('.slist button');
    assert.deepEqual(items.map(b => b.dataset.id), ['fenhold', 'reedmoor']);
    assert.equal(items[0].getAttribute('aria-disabled'), 'true');
    items[1].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'powers', 0, 'holds'], value: ['fenhold', 'reedmoor'] }]);
    holds.querySelector('.kc button').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'powers', 0, 'holds'] }]);
});

test('used by lists the event that tests and changes the power, with Go to; Delete is refused while it is used', () => {
    const { calls, draw } = setup({ focus: { rec: 'powers.0', path: null } });
    const page = one(draw('powers'));
    const used = page.querySelectorAll('.st-used');
    assert.equal(used.length, 2);
    assert.match(used.map(u => u.textContent).join(' '), /tests it/);
    assert.match(used.map(u => u.textContent).join(' '), /changes it/);
    used[0].querySelector('button').click();
    assert.deepEqual(calls.go.at(-1), ['events', 'worldEvents.0']);
    page.querySelector('.st-del').click();
    assert.equal(calls.commit.length, 0);
    assert.match(page.querySelector('p.st-problem').textContent, /Used in 2 places/);
    assert.equal(page.querySelector('.st-delcard'), null, 'a power places use gets no card');
});

test('renaming a power rewrites its uses in one commit; a bad id is refused in words', () => {
    const { calls, draw } = setup({ focus: { rec: 'powers.0', path: null } });
    const page = one(draw('powers'));
    const id = field(page, 'id').querySelector('input');
    id.value = 'Lamp Guild'; id.dispatch('change');
    assert.equal(calls.commit.length, 0);
    assert.match(page.querySelector('p.st-problem').textContent, /not an id/);
    id.value = 'lamp-house'; id.dispatch('change');
    assert.equal(calls.commit.length, 1);
    const values = calls.commit[0].map(p => JSON.stringify(p.value));
    assert.ok(calls.commit[0].some(p => p.path.join('.') === 'content.powers.0.id' && p.value === 'lamp-house'));
    assert.ok(values.some(v => v.includes('power:lamp-house >= 10')));
    assert.ok(values.some(v => v.includes('"lamp-house":-5')));
});

test('a score\'s range, start and drift edit as patches; drift on takes the key out, off writes false', () => {
    const { calls, draw } = setup({ focus: { rec: 'scores.0', path: null } });
    assert.equal(one(draw('powers')).querySelector('.st-pane-rec').childNodes.length, 0);
    const page = one(draw('scores'));
    assert.match(page.textContent, /Score 1 of 2/);
    const high = field(page, 'range.high').querySelector('input');
    high.value = '80'; high.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'scores', 0, 'range'], value: [-50, 80] }]);
    const before = calls.commit.length;
    const low = field(page, 'range.low').querySelector('input');
    low.value = '-50'; low.dispatch('change');
    assert.equal(calls.commit.length, before);
    field(page, 'drift').querySelector('.sw').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'scores', 0, 'drift'], value: false }]);
    const off = setup({ focus: { rec: 'scores.1', path: null } });
    const page2 = one(off.draw('scores'));
    assert.equal(field(page2, 'range.low').querySelector('input').value, '-100');
    field(page2, 'drift').querySelector('.sw').click();
    assert.deepEqual(off.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'scores', 1, 'drift'] }]);
});

test('the drift curve runs from the push back to the start, says how many days, and stays flat with drift off', () => {
    const { draw, keeps } = setup({ focus: { rec: 'scores.0', path: null } });
    const page = one(draw('scores'));
    const curve = page.querySelector('svg.st-drift');
    assert.ok(curve);
    assert.match(field(page, 'drift-preview').textContent, /Pushed to −50, it is back at its start \(10\) after 60 days/);
    const points = curve.querySelector('.st-drift-line').getAttribute('points').split(' ');
    assert.equal(points.length, 91);
    assert.equal(points[60].split(',')[1], points[90].split(',')[1]);
    assert.notEqual(points[0].split(',')[1], points[60].split(',')[1]);
    const push = field(page, 'pushed').querySelector('input');
    push.value = '30'; push.dispatch('change');
    assert.equal(keeps['powers:drift:scores.0'].pushed, 30);
    assert.match(field(page, 'drift-preview').textContent, /Pushed to 30, it is back at its start \(10\) after 20 days/);
    const flat = one(setup({ focus: { rec: 'scores.1', path: null } }).draw('scores'));
    assert.match(field(flat, 'drift-preview').textContent, /stays there until an event or effect moves it/);
    const line = flat.querySelector('.st-drift-line').getAttribute('points').split(' ').map(p => p.split(',')[1]);
    assert.equal(new Set(line).size, 1);
});

test('a checker problem shows under its field; a focus with a path marks the control; a format 3 pack gets the read-only cards', () => {
    const problems = [{ path: 'content.scores[0].range', message: 'range must be [low, high].' }];
    const { draw } = setup({ focus: { rec: 'scores.0', path: ['range', 1] }, ctx: { problems } });
    const page = one(draw('scores'));
    assert.match(field(page, 'range.low').querySelector('.st-problem').textContent, /range must be/);
    assert.ok(field(page, 'range.low').querySelector('input').classList.contains('st-at'));
    const old = setup({ ctx: { legacy: true } });
    const cards = one(old.draw('powers'));
    assert.equal(cards.querySelector('.st-prow'), null);
    assert.ok(cards.querySelector('.st-rec'));
});

test('a refused change says why; Duplicate inserts a copy with a free id after it and opens it; back goes to the lists', () => {
    const { calls, draw } = setup({ focus: { rec: 'scores.1', path: null }, refuse: true });
    const page = one(draw('scores'));
    const means = field(page, 'means').querySelector('textarea');
    means.value = 'Whether the town trusts the lamps.'; means.dispatch('change');
    assert.equal(page.querySelector('p.st-problem').textContent, 'No.');
    const ok = setup({ focus: { rec: 'scores.1', path: null } });
    const page2 = one(ok.draw('scores'));
    page2.querySelector('.st-dup').click();
    assert.deepEqual(ok.calls.commit.at(-1), [{ op: 'insert', path: ['content', 'scores', 2], value: { id: 'lamp-trust-copy', name: 'Lamp Trust copy', start: 0, drift: false } }]);
    assert.deepEqual(ok.calls.go.at(-1), ['powers', 'scores.2']);
    page2.querySelector('.st-del').click();
    assert.ok(page2.querySelector('.st-delcard'), 'Delete asks first');
    page2.querySelector('.st-sure').click();
    assert.deepEqual(ok.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'scores', 1] }]);
    page2.querySelector('.st-back').click();
    assert.deepEqual(ok.calls.go.at(-1), ['powers']);
    assert.equal(calls.go.length, 0);
});
