// The game Names editor (ST-GNAMES): the cultures table (order is priority; a move writes the object in its new key order), the banned list,
// one culture's page (id rename, regions picked from the open world or typed, given and family names with their limits), and the fallbacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/game-names.js';
import { validatePack } from '../../../packs/validate.js';
import { apply } from '../../../studio/model/edits.js';

const GAME = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/game4-mini.json', import.meta.url), 'utf8'));
const WORLD = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const NAMES = { banned: ['Elara', 'Lyra'],
    river: { regions: ['the-fen'], given: ['Ansel', 'Brin', 'Cora'], family: ['Reedman', 'Lockley'] },
    hill: { regions: ['the-fen'], given: ['Dorn', 'Esk'] } };

function setup(opts = {}) {
    installFakeDom();
    const pack = structuredClone(GAME);
    pack.content.names = structuredClone(opts.names ?? NAMES);
    const calls = { commit: [], go: [] };
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'game', legacy: false, other: opts.world === false ? null : { doc: structuredClone(WORLD) }, problems: opts.problems ?? [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return { ok: true }; }, go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const draw = () => editSection({ key: 'names', where: 'content', value: pack.content.names, count: 3 }, ctx)[0];
    return { pack, calls, ctx, draw };
}
const culture = (id, opts = {}) => setup({ ...opts, focus: { rec: `names.${id}`, path: opts.path ?? null } });
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const add = (row, text) => { const box = row.querySelector('input.kadd'); box.value = text; box.dispatch('change'); };
const sheet = () => globalThis.document.querySelectorAll('.slist button');

test('the fixture names pass the pack check', () => {
    const pack = structuredClone(GAME);
    pack.content.names = structuredClone(NAMES);
    assert.equal(validatePack(JSON.stringify(pack)).ok, true);
});

test('the cultures table lists each culture in order with its regions by name and its counts, and opens one', () => {
    const { calls, draw } = setup();
    const page = draw();
    const rows = page.querySelectorAll('.st-table .st-trow');
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent, /river.*The Fen/);
    assert.match(rows[0].textContent, /3 given · 2 family/);
    assert.match(rows[1].textContent, /2 given · 0 family/);
    assert.match(page.textContent, /Cultures · 2/);
    assert.match(page.textContent, /2 of 20 cultures/);
    assert.match(page.textContent, /the higher one in this list wins/);
    rows[1].querySelector('.st-open').click();
    assert.deepEqual(calls.go, [['names', 'names.hill']]);
});

test('moving a culture writes the names object in its new key order, with banned kept where it was', () => {
    const { calls, draw } = setup();
    const page = draw();
    assert.equal(page.querySelector('[aria-label="Move river up"]').hasAttribute('disabled'), true);
    page.querySelector('[aria-label="Move hill up"]').click();
    const [patch] = calls.commit.at(-1);
    assert.deepEqual(patch.path, ['content', 'names']);
    assert.deepEqual(Object.keys(patch.value), ['banned', 'hill', 'river']);
    assert.deepEqual(patch.value.hill, NAMES.hill);
});

test('Add a culture sets a new key with a region of the open world and opens it', () => {
    const { calls, draw } = setup();
    draw().querySelector('.st-tadd').click();
    assert.deepEqual(calls.commit[0], [{ op: 'set', path: ['content', 'names', 'new-culture'], value: { regions: ['the-fen'], given: ['Name'] } }]);
    assert.deepEqual(calls.go[0], ['names', 'names.new-culture']);
});

test('the banned list adds and removes names; a repeat (any case) or an over-long name is refused in words', () => {
    const { calls, draw } = setup();
    const row = field(draw(), 'banned');
    add(row, 'Kael');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'names', 'banned'], value: ['Elara', 'Lyra', 'Kael'] }]);
    add(row, 'lyra');
    assert.match(row.querySelector('.st-problem').textContent, /already in the list/);
    add(row, 'x'.repeat(81));
    assert.match(row.querySelector('.st-problem').textContent, /longer than 80/);
    assert.equal(calls.commit.length, 1);
    const one = setup({ names: { banned: ['Elara'], river: NAMES.river } });
    field(one.draw(), 'banned').querySelector('[aria-label="Remove Elara"]').click();
    assert.deepEqual(one.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'names', 'banned'] }]);
});

test('a long list shows its first 18 names and "Show all N"', () => {
    const banned = Array.from({ length: 30 }, (_, n) => `Name${n}`);
    const { draw } = setup({ names: { banned } });
    const row = field(draw(), 'banned');
    assert.equal(row.querySelectorAll('.kc').length, 19);
    row.querySelector('.st-all').click();
    assert.equal(row.querySelectorAll('.kc').length, 30);
});

test('a culture\'s page: given names add with their limit, and the last family name takes the family key out', () => {
    const { calls, draw } = culture('river');
    const page = draw();
    assert.match(page.textContent, /Culture 1 of 2 · first in the list/);
    assert.match(page.textContent, /Given names · 3 of 60/);
    add(field(page, 'given'), 'Dara');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'names', 'river', 'given'], value: ['Ansel', 'Brin', 'Cora', 'Dara'] }]);
    const full = culture('river', { names: { river: { regions: ['the-fen'], given: Array.from({ length: 60 }, (_, n) => `G${n}`) } } });
    const given = field(full.draw(), 'given');
    add(given, 'One more');
    assert.match(given.querySelector('.st-problem').textContent, /at most 60/);
    const lone = culture('river', { names: { river: { regions: ['the-fen'], given: ['A'], family: ['B'] } } });
    field(lone.draw(), 'family').querySelector('[aria-label="Remove B"]').click();
    assert.deepEqual(lone.calls.commit.at(-1), [{ op: 'remove', path: ['content', 'names', 'river', 'family'] }]);
});

test('with a world open, regions are picked from its regions and shown by name; an id it lacks gets a warning', () => {
    const { calls, draw } = culture('hill', { names: { hill: { regions: ['the-fen', 'old-marsh'], given: ['Dorn'] } } });
    const row = field(draw(), 'regions');
    assert.match(row.textContent, /The Fen/);
    assert.match(row.textContent, /Pick from Studio world 4 \(test\)'s 1/);
    assert.match(row.textContent, /"old-marsh" is not a region of Studio world 4/);
    row.querySelector('.st-pickbtn').click();
    const items = sheet();
    assert.deepEqual(items.map(b => b.dataset.id), ['the-fen']);
    assert.equal(items[0].getAttribute('aria-disabled'), 'true');
    row.querySelector('[aria-label="Remove The Fen"]').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'names', 'hill', 'regions'], value: ['old-marsh'] }]);
});

test('with no world open, region ids are typed', () => {
    const { calls, draw } = culture('hill', { world: false });
    const row = field(draw(), 'regions');
    assert.match(row.textContent, /No world is open, so region ids are typed/);
    add(row, 'high-moor');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'names', 'hill', 'regions'], value: ['the-fen', 'high-moor'] }]);
});

test('renaming a culture keeps its place in the order; a reserved or taken id is refused', () => {
    const { calls, draw } = culture('river', { path: ['id'] });
    const page = draw();
    const id = field(page, 'id').querySelector('input');
    assert.ok(id.classList.contains('st-at'));
    id.value = 'banned'; id.dispatch('change');
    assert.match(page.querySelector('p.st-problem').textContent, /kept for the pack's own use/);
    id.value = 'hill'; id.dispatch('change');
    assert.match(page.querySelector('p.st-problem').textContent, /already "hill"/);
    assert.equal(calls.commit.length, 0);
    id.value = 'riverfolk'; id.dispatch('change');
    assert.deepEqual(Object.keys(calls.commit[0][0].value), ['banned', 'riverfolk', 'hill']);
    assert.deepEqual(calls.go.at(-1), ['names', 'names.riverfolk']);
});

test('Duplicate puts the copy right after it; Delete asks once, then removes the key', () => {
    const { calls, draw } = culture('river');
    draw().querySelector('.st-dup').click();
    assert.deepEqual(Object.keys(calls.commit[0][0].value), ['banned', 'river', 'river-copy', 'hill']);
    const page = draw();
    page.querySelector('.st-del').click();
    assert.equal(calls.commit.length, 1);
    page.querySelector('.st-sure').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'names', 'river'] }]);
    assert.deepEqual(calls.go.at(-1), ['names']);
});

test('a culture\'s problem shows on its row and under its field; the edits apply and keep the pack valid', () => {
    const problems = [{ path: 'content.names.hill.given', message: 'content.names.hill.given must be a list of 1 to 60 given names.' }];
    const { draw } = setup({ problems });
    assert.match(draw().querySelectorAll('.st-table .st-trow')[1].textContent, /must be a list/);
    const open = culture('hill', { problems });
    assert.match(field(open.draw(), 'given').querySelector('.st-problem').textContent, /must be a list/);
    const { calls, draw: drawRiver, pack, ctx } = culture('river');
    // each commit is applied and the page drawn again from the new document, as the Studio does
    const step = doc => { const done = apply(doc, calls.commit.at(-1)); assert.equal(done.ok, true, done.refusal); pack.content.names = structuredClone(done.doc.doc.content.names); return done.doc; };
    add(field(drawRiver(), 'family'), 'Marsh');
    let after = step({ doc: structuredClone(pack), portraits: [] });
    ctx.focus = null;
    drawRiver().querySelector('[aria-label="Move river down"]').click();
    assert.equal(calls.commit.length, 2);
    after = step(after);
    assert.deepEqual(after.doc.content.names.river.family, ['Reedman', 'Lockley', 'Marsh']);
    assert.deepEqual(Object.keys(after.doc.content.names), ['banned', 'hill', 'river']);
    assert.equal(validatePack(JSON.stringify(after.doc)).ok, true);
});

test('a format 3 pack, or names that are not an object, are drawn read-only', () => {
    assert.equal(setup({ ctx: { legacy: true } }).draw().querySelector('.st-table'), null);
    installFakeDom();
    const odd = editSection({ key: 'names', where: 'content', value: ['not', 'an object'], count: 2 }, { legacy: false, commit: () => ({ ok: true }), keep: () => ({}), problems: [] })[0];
    assert.equal(odd.querySelector('.st-table'), null);
});
