// The places editor (ST-PLACES): the list and its find box, one place's record page, edits as patches, an id rename through the reference index,
// pickers, the climate list, and the read-only fallback for a format 3 pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/places.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { CLIMATES } from '../../../packs/limits.js';

const PACK = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const section = pack => ({ key: 'places', where: 'content', value: pack.content.places, count: pack.content.places.length });

function setup(opts = {}) {
    installFakeDom();
    const pack = structuredClone(PACK);
    const calls = { commit: [], go: [] };
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; },
        go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const draw = () => editSection(section(pack), ctx)[0];
    return { pack, calls, ctx, draw };
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);

test('the list shows each place with its kind and region, filters by what is typed, and opens a record with Go to', () => {
    const { calls, draw } = setup();
    const page = draw();
    const rows = page.querySelectorAll('.st-prow');
    assert.equal(rows.length, PACK.content.places.length);
    assert.match(rows[0].textContent, /Fenhold/);
    assert.match(rows[0].textContent, /lock town · the-fen/);
    const find = page.querySelector('input.psrch');
    find.value = 'reed'; find.dispatch('input');
    assert.deepEqual(page.querySelectorAll('.st-prow').map(r => r.dataset.rec), ['places.1']);
    page.querySelector('.st-prow').click();
    assert.deepEqual(calls.go, [['map', 'places.1']]);
});

test('Add a place inserts a record with a free id and opens it', () => {
    const { calls, draw, pack } = setup();
    draw().querySelector('.st-add').click();
    assert.equal(calls.commit[0][0].op, 'insert');
    assert.deepEqual(calls.commit[0][0].path, ['content', 'places', pack.content.places.length]);
    assert.equal(calls.commit[0][0].value.id, 'new-place');
    assert.deepEqual(calls.go[0], ['map', `places.${pack.content.places.length}`]);
});

test('a focused place draws its record page, and a text edit is one set patch at its path', () => {
    const { calls, draw } = setup({ focus: { rec: 'places.1', path: null } });
    const page = draw();
    assert.equal(page.querySelector('.st-rec').dataset.rec, 'places.1');
    assert.match(page.textContent, /Place 2 of/);
    const name = field(page, 'name').querySelector('input');
    name.value = 'Reedmoor Marsh'; name.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'places', 1, 'name'], value: 'Reedmoor Marsh' }]);
    const x = field(page, 'x').querySelector('input');
    x.value = '7'; x.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'places', 1, 'x'], value: 7 }]);
});

test('clearing an optional field removes its key, and a field that is not there makes no edit', () => {
    const { calls, draw, pack } = setup({ focus: { rec: 'places.1', path: null } });
    pack.content.places[1].layer = 'under';
    const page = draw();
    const layer = field(page, 'layer').querySelector('input');
    layer.value = ''; layer.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'places', 1, 'layer'] }]);
    const before = calls.commit.length;
    const note = field(page, 'note').querySelector('textarea');
    note.value = ''; note.dispatch('change');
    assert.equal(calls.commit.length, before);
});

test('the climate list is the checker\'s, and the blank choice removes the climate', () => {
    const { calls, draw } = setup({ focus: { rec: 'places.0', path: null } });
    const select = field(draw(), 'climate').querySelector('select');
    assert.deepEqual(select.querySelectorAll('option').slice(1).map(o => o.textContent), [...CLIMATES]);
    select.value = 'arid'; select.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'places', 0, 'climate'], value: 'arid' }]);
});

test('the kind picker lists the pack\'s place kinds with their classes; the region picker lists its regions', () => {
    const { calls, draw } = setup({ focus: { rec: 'places.0', path: null } });
    const page = draw();
    field(page, 'kind').querySelector('button').click();
    const items = globalThis.document.querySelectorAll('.slist button');
    assert.deepEqual(items.map(b => b.dataset.id), ['', 'lock town', 'marsh']);
    assert.match(items[1].textContent, /town/);
    items[2].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'places', 0, 'kind'], value: 'marsh' }]);
    field(page, 'region').querySelector('button').click();
    const regions = globalThis.document.querySelectorAll('.slist button');
    assert.deepEqual(regions.map(b => b.dataset.id), ['', 'the-fen']);
    regions[0].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'places', 0, 'region'] }]);
});

test('renaming the id goes through the reference index; a taken id is refused in words and nothing is committed', () => {
    const { calls, draw } = setup({ focus: { rec: 'places.0', path: null } });
    const page = draw();
    const id = field(page, 'id').querySelector('input');
    id.value = 'reedmoor'; id.dispatch('change');
    assert.equal(calls.commit.length, 0);
    assert.match(page.querySelector('.st-problem').textContent, /already the id/);
    id.value = 'fenhold-keep'; id.dispatch('change');
    assert.ok(calls.commit.length === 1 && calls.commit[0].some(p => p.op === 'set' && p.path.join('.') === 'content.places.0.id' && p.value === 'fenhold-keep'));
});

test('a refused change says why, and Duplicate and Delete are one patch each', () => {
    const { calls, draw } = setup({ focus: { rec: 'places.1', path: null }, refuse: true });
    const page = draw();
    const name = field(page, 'name').querySelector('input');
    name.value = 'X'; name.dispatch('change');
    assert.equal(page.querySelector('p.st-problem').textContent, 'No.');
    page.querySelector('.st-dup').click();
    assert.deepEqual([calls.commit.at(-1)[0].op, calls.commit.at(-1)[0].path], ['insert', ['content', 'places', 2]]);
    page.querySelector('.st-del').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'places', 1] }]);
    page.querySelector('.st-back').click();
    assert.deepEqual(calls.go.at(-1), ['map']);
});

test('a checker problem on a field shows under it, and a format 3 pack gets the read-only cards', () => {
    const problem = { path: 'content.places[0].x', message: 'x must be a number (map units).' };
    const { draw } = setup({ focus: { rec: 'places.0', path: null }, ctx: { problems: [problem] } });
    assert.match(field(draw(), 'x').querySelector('.st-problem').textContent, /must be a number/);
    const old = setup({ ctx: { legacy: true } });
    const page = old.draw();
    assert.equal(page.querySelector('.st-prow'), null);
    assert.ok(page.querySelector('.st-rec'));
});
