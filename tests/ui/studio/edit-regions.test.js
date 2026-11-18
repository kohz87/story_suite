// The regions and realms editor (ST-REGIONS): both lists, a region's record page (climate, other names, its realm, its places), a realm's
// record page (its regions through the region picker), id renames through the reference index, adding the first realm, and the read-only fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/regions.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { CLIMATES } from '../../../packs/limits.js';

const BASE = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const section = (pack, key) => ({ key, where: 'content', value: pack.content[key], count: pack.content[key].length });

// The mini world with a second region and one realm, unless `bare` (the fixture as it is: one region, no realms).
function setup(opts = {}) {
    installFakeDom();
    const pack = structuredClone(BASE);
    if (!opts.bare) {
        pack.content.regions.push({ id: 'high-moor', name: 'High Moor', climate: 'highland', aliases: ['the moor'] });
        pack.content.realms = [{ id: 'lampwardens', name: 'The Lampwardens', regions: ['the-fen'] }];
    }
    const calls = { commit: [], go: [] };
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; },
        go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const draw = (key = 'regions') => editSection(section(pack, key), ctx)[0];
    return { pack, calls, ctx, draw };
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const sheetRows = () => globalThis.document.querySelectorAll('.slist button');

test('the region list shows climate, realm and place count; a row opens the record with Go to', () => {
    const { calls, draw } = setup();
    const page = draw();
    const rows = page.querySelectorAll('.st-prow');
    assert.deepEqual(rows.map(r => r.dataset.rec), ['regions.0', 'regions.1']);
    assert.match(rows[0].textContent, /The Fen/);
    assert.match(rows[0].textContent, /in The Lampwardens · 2 places/);
    assert.match(rows[1].textContent, /highland · 0 places/);
    rows[1].click();
    assert.deepEqual(calls.go, [['map', 'regions.1']]);
    const realms = draw('realms');
    assert.match(realms.querySelector('.st-prow').textContent, /The Lampwardens.*1 region/);
});

test('Add a region inserts a record with an id free across places, regions and realms, and opens it', () => {
    const { calls, draw, pack } = setup();
    pack.content.places.push({ id: 'new-region', name: 'Odd', x: 0, y: 0 });
    draw().querySelector('.st-add').click();
    assert.deepEqual(calls.commit[0], [{ op: 'insert', path: ['content', 'regions', 2], value: { id: 'new-region-2', name: 'New region' } }]);
    assert.deepEqual(calls.go[0], ['map', 'regions.2']);
});

test('a pack with no realms gets "Add a realm" under its regions, which makes the realms list', () => {
    const { calls, draw } = setup({ bare: true });
    const add = draw().querySelector('.st-add-other');
    assert.match(add.textContent, /Add a realm/);
    add.click();
    assert.deepEqual(calls.commit[0], [{ op: 'set', path: ['content', 'realms'], value: [{ id: 'new-realm', name: 'New realm', regions: [] }] }]);
    assert.deepEqual(calls.go[0], ['map', 'realms.0']);
    assert.equal(setup().draw().querySelector('.st-add-other'), null);
});

test('a region page edits fields as patches; the climate list is the checker\'s and the default removes it', () => {
    const { calls, draw } = setup({ focus: { rec: 'regions.1', path: null } });
    const page = draw();
    assert.equal(page.querySelector('.st-rec').dataset.rec, 'regions.1');
    assert.match(page.textContent, /Region 2 of 2/);
    const name = field(page, 'name').querySelector('input');
    name.value = 'Upper Moor'; name.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'regions', 1, 'name'], value: 'Upper Moor' }]);
    const select = field(page, 'climate').querySelector('select');
    assert.deepEqual(select.querySelectorAll('option').slice(1).map(o => o.textContent), [...CLIMATES]);
    select.value = 'cold'; select.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'regions', 1, 'climate'], value: 'cold' }]);
    select.value = select.querySelectorAll('option')[0].textContent; select.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'regions', 1, 'climate'] }]);
    field(page, 'aliases').querySelector('button').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'regions', 1, 'aliases'] }]);
});

test('a region page lists its places, which open with Go to, and the realm picker moves it between realms', () => {
    const { calls, draw, pack } = setup({ focus: { rec: 'regions.0', path: null } });
    pack.content.realms.push({ id: 'moorfolk', name: 'Moorfolk', regions: ['High Moor'] });
    const page = draw();
    const places = field(page, 'places').querySelectorAll('.st-goplace');
    assert.deepEqual(places.map(b => b.textContent), ['Fenhold', 'Reedmoor']);
    places[1].click();
    assert.deepEqual(calls.go.at(-1), ['map', 'places.1']);
    assert.match(field(page, 'realm').textContent, /The Lampwardens/);
    field(page, 'realm').querySelector('button').click();
    assert.deepEqual(sheetRows().map(b => b.dataset.id), ['', 'lampwardens', 'moorfolk']);
    sheetRows()[2].click();
    assert.deepEqual(calls.commit.at(-1), [
        { op: 'set', path: ['content', 'realms', 0, 'regions'], value: [] },
        { op: 'set', path: ['content', 'realms', 1, 'regions'], value: ['High Moor', 'the-fen'] }]);
    field(page, 'realm').querySelector('button').click();
    sheetRows()[0].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'realms', 0, 'regions'], value: [] }]);
});

test('a realm page lists its regions; the region picker marks those already held, by id or by name', () => {
    const { calls, draw, pack } = setup({ focus: { rec: 'realms.1', path: null } });
    pack.content.realms.push({ id: 'moorfolk', name: 'Moorfolk', regions: ['the moor', 'nowhere'] });
    const page = draw('realms').querySelector('.st-pane-rec'); // the record pane (the realms list is beside it)
    assert.match(page.textContent, /Realm 2 of 2/);
    const rows = page.querySelectorAll('.subrow');
    assert.match(rows[0].textContent, /High Moor.*high-moor/);
    assert.match(rows[1].textContent, /nowhere.*not a region in this pack/);
    page.querySelector('.addrow button').click();
    const items = sheetRows();
    assert.deepEqual(items.map(b => [b.dataset.id, b.getAttribute('aria-disabled')]), [['the-fen', 'true'], ['high-moor', 'true']]);
    assert.match(items[0].textContent, /in The Lampwardens/);
    assert.match(items[1].textContent, /in this realm/);
    rows[1].querySelector('button[aria-label="Move nowhere up"]').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'realms', 1, 'regions'], value: ['nowhere', 'the moor'] }]);
    rows[1].querySelector('button[aria-label="Remove nowhere"]').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'realms', 1, 'regions'], value: ['the moor'] }]);
});

test('the region picker adds a free region to the realm by id', () => {
    const { calls, draw } = setup({ focus: { rec: 'realms.0', path: null } });
    draw('realms').querySelector('.st-pane-rec .addrow button').click();
    const items = sheetRows();
    assert.equal(items[1].getAttribute('aria-disabled'), null);
    items[1].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'realms', 0, 'regions'], value: ['the-fen', 'high-moor'] }]);
});

test('renaming a region goes through the reference index: places and realms follow; a taken id is refused in words', () => {
    const { calls, draw } = setup({ focus: { rec: 'regions.0', path: null } });
    const page = draw();
    const id = field(page, 'id').querySelector('input');
    id.value = 'fenhold'; id.dispatch('change');
    assert.equal(calls.commit.length, 0);
    assert.match(page.querySelector('p.st-problem').textContent, /already the id of a place/);
    id.value = 'low-fen'; id.dispatch('change');
    const paths = calls.commit[0].map(p => p.path.join('.'));
    for (const path of ['content.regions.0.id', 'content.places.0.region', 'content.places.1.region', 'content.realms.0.regions.0']) assert.ok(paths.includes(path), path);
    assert.ok(calls.commit[0].some(p => p.path.join('.') === 'content.start.world.set.0' && p.value === 'lamps-out@low-fen: 10 days'));
    assert.ok(calls.commit[0].every(p => p.op === 'set' && String(p.value).includes('low-fen')));
});

test('renaming a realm goes through the reference index too', () => {
    const { calls, draw } = setup({ focus: { rec: 'realms.0', path: null } });
    const id = field(draw('realms'), 'id').querySelector('input');
    id.value = 'lamp-guilds'; id.dispatch('change');
    assert.deepEqual(calls.commit[0], [{ op: 'set', path: ['content', 'realms', 0, 'id'], value: 'lamp-guilds' }]);
});

test('a refused change says why; Duplicate (a realm copy holds no regions) and Delete are one patch each; Back returns to the part', () => {
    const { calls, draw } = setup({ focus: { rec: 'realms.0', path: null }, refuse: true });
    const page = draw('realms');
    const name = field(page, 'name').querySelector('input');
    name.value = 'X'; name.dispatch('change');
    assert.equal(page.querySelector('p.st-problem').textContent, 'No.');
    page.querySelector('.st-dup').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'insert', path: ['content', 'realms', 1], value: { id: 'lampwardens-copy', name: 'The Lampwardens copy', regions: [] } }]);
    page.querySelector('.st-del').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'realms', 0] }]);
    page.querySelector('.st-back').click();
    assert.deepEqual(calls.go.at(-1), ['map']);
});

test('while another record of the part is open the section draws only its list; problems show under their field', () => {
    const open = setup({ focus: { rec: 'places.0', path: null } });
    for (const key of ['regions', 'realms']) {
        const [node] = editSection(section(open.pack, key), open.ctx);
        assert.ok(node.querySelector('.st-pane-list .addrow'), `${key}: its list stays`);
        assert.equal(node.querySelector('.st-pane-rec').childNodes.length, 0, `${key}: no record of its own`);
    }
    const problems = [{ path: 'content.regions[1].climate', message: 'climate must be one of the ten.' }, { path: 'content.realms[0].regions', message: 'the region is already in realm "x".' }];
    const one = setup({ focus: { rec: 'regions.1', path: null }, ctx: { problems } });
    assert.match(field(one.draw(), 'climate').querySelector('.st-problem').textContent, /must be one of/);
    const two = setup({ focus: { rec: 'realms.0', path: null }, ctx: { problems } });
    assert.match(field(two.draw('realms'), 'regions').querySelector('.st-problem').textContent, /already in realm/);
});

test('a format 3 pack, or a list that is not all records, gets the read-only cards', () => {
    const old = setup({ ctx: { legacy: true } });
    const page = old.draw();
    assert.equal(page.querySelector('.st-prow'), null);
    assert.ok(page.querySelector('.st-rec'));
    const odd = setup();
    odd.pack.content.realms.push('loose');
    assert.equal(odd.draw('realms').querySelector('.st-prow'), null);
});

test('Go to a region\'s field marks the field, not the JSON row; a rename the other open pack also names says so through ctx.say', () => {
    const marked = setup({ focus: { rec: 'regions.1', path: ['climate'] } });
    const page = marked.draw();
    assert.equal(page.querySelectorAll('.st-at').length, 1);
    assert.equal(page.querySelector('.st-at').closest('[data-key]').dataset.key, 'climate');
    const game = { format: 4, kind: 'game', id: 'g', content: { names: { fen: { regions: ['the-fen'], given: ['Ada'], family: ['Reed'] } } } };
    const said = [];
    const named = setup({ focus: { rec: 'regions.0', path: null } });
    named.ctx.refs = buildRefs(named.pack, game);
    named.ctx.say = text => said.push(text);
    const id = field(named.draw(), 'id').querySelector('input');
    id.value = 'the-fens'; id.dispatch('change');
    assert.equal(named.calls.commit.length, 1);
    assert.deepEqual(said, ['The other open pack names this region 1 time; change those by hand.']);
});
