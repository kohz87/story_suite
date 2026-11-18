// The routes editor (ST-ROUTES): the list and its find box, Add, one route's record page, edits as patches, the from and to pickers,
// the kind picker (the pack's route kinds and the engine classes), a route name rename through the reference index, and the read-only fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/routes.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { ROUTE_CLASSES } from '../../../packs/limits.js';

const PACK = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));
const section = pack => ({ key: 'routes', where: 'content', value: pack.content.routes, count: pack.content.routes.length });

function setup(opts = {}) {
    installFakeDom();
    const pack = structuredClone(PACK);
    pack.content.routeKinds = { ferry: 'sea', causeway: 'road' };
    pack.content.places.push({ id: 'saltmouth', name: 'Saltmouth', x: 9, y: 2 });
    pack.content.routes.push({ name: 'Grey Ferry', from: 'reedmoor', to: 'saltmouth', kind: 'ferry', hours: 5 });
    opts.edit?.(pack);
    const calls = { commit: [], go: [] };
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: [], focus: opts.focus ?? null,
        commit: patches => { calls.commit.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; },
        go: (...args) => calls.go.push(args), keep: id => (keeps[id] ??= {}), ...opts.ctx };
    const draw = () => editSection(section(pack), ctx)[0];
    return { pack, calls, ctx, draw };
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const sheetItems = () => globalThis.document.querySelectorAll('.slist button');

test('the list shows each route by name or by its two places, with kind and km, filters by what is typed, and opens a record', () => {
    const { calls, draw } = setup();
    const page = draw();
    const rows = page.querySelectorAll('.st-prow');
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent, /Fenhold → Reedmoor/);
    assert.match(rows[0].textContent, /road · 12 km/);
    assert.match(rows[1].textContent, /Grey Ferry/);
    assert.match(rows[1].textContent, /Reedmoor → Saltmouth · ferry/);
    const find = page.querySelector('input.psrch');
    find.value = 'salt'; find.dispatch('input');
    assert.deepEqual(page.querySelectorAll('.st-prow').map(r => r.dataset.rec), ['routes.1']);
    page.querySelector('.st-prow').click();
    assert.deepEqual(calls.go, [['map', 'routes.1']]);
});

test('Add a route joins the first two places no route joins yet; when all are joined the new one carries a name', () => {
    const { calls, draw } = setup();
    draw().querySelector('.st-add').click();
    assert.deepEqual(calls.commit[0], [{ op: 'insert', path: ['content', 'routes', 2], value: { from: 'fenhold', to: 'saltmouth', kind: 'road' } }]);
    assert.deepEqual(calls.go[0], ['map', 'routes.2']);
    const full = setup({ edit: pack => pack.content.routes.push({ from: 'fenhold', to: 'saltmouth', kind: 'road' }) });
    full.draw().querySelector('.st-add').click();
    assert.deepEqual(full.calls.commit[0][0].value, { name: 'New route', from: 'fenhold', to: 'reedmoor', kind: 'road' });
});

test('with fewer than two places Add is off and says why', () => {
    const { draw } = setup({ edit: pack => { pack.content.places = pack.content.places.slice(0, 1); pack.content.routes = []; } });
    const page = draw();
    assert.equal(page.querySelector('.st-add').getAttribute('disabled'), '');
    assert.match(page.textContent, /add two places first/);
});

test('a focused route draws its record page, and a number edit is one set patch; a blank number removes the key', () => {
    const { calls, draw } = setup({ focus: { rec: 'routes.0', path: null } });
    const page = draw();
    assert.equal(page.querySelector('.st-rec').dataset.rec, 'routes.0');
    assert.match(page.textContent, /Route 1 of 2/);
    const km = field(page, 'km').querySelector('input');
    km.value = '14'; km.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'routes', 0, 'km'], value: 14 }]);
    km.value = ''; km.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'routes', 0, 'km'] }]);
    const corridor = field(page, 'corridor').querySelector('input');
    corridor.value = 'Sable'; corridor.dispatch('change');
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'routes', 0, 'corridor'], value: 'Sable' }]);
    const before = calls.commit.length;
    const note = field(page, 'note').querySelector('textarea');
    note.value = ''; note.dispatch('change');
    assert.equal(calls.commit.length, before);
});

test('the from and to pickers list the places by name, with the other end marked and not pickable', () => {
    const { calls, draw } = setup({ focus: { rec: 'routes.0', path: null } });
    const page = draw();
    assert.equal(field(page, 'from').querySelector('button').textContent, 'Fenhold');
    field(page, 'to').querySelector('button').click();
    const items = sheetItems();
    assert.deepEqual(items.map(b => b.dataset.id), ['fenhold', 'reedmoor', 'saltmouth']);
    assert.equal(items[0].getAttribute('aria-disabled'), 'true');
    assert.match(items[0].textContent, /other end/);
    items[0].click();
    assert.equal(calls.commit.length, 0);
    items[2].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'routes', 0, 'to'], value: 'saltmouth' }]);
});

test('the kind picker lists the pack\'s route kinds with their classes, then the engine classes; the hint names the class', () => {
    const { calls, draw } = setup({ focus: { rec: 'routes.1', path: null } });
    const page = draw();
    assert.match(field(page, 'kind').textContent, /Counts as: sea/);
    assert.match(field(page, 'hours').textContent, /sets the days/);
    field(page, 'kind').querySelector('button').click();
    const items = sheetItems();
    assert.deepEqual(items.map(b => b.dataset.id), ['ferry', 'causeway', ...ROUTE_CLASSES]);
    assert.match(items[0].textContent, /sea/);
    assert.match(items[2].textContent, /engine class/);
    items[3].click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'set', path: ['content', 'routes', 1, 'kind'], value: ROUTE_CLASSES[1] }]);
});

test('renaming a named route goes through the reference index; naming an unnamed one used elsewhere warns', () => {
    const named = setup({ focus: { rec: 'routes.1', path: null }, edit: pack => { pack.content.start = { world: { set: ['storm@Grey Ferry'] } }; } });
    const page = named.draw();
    const name = field(page, 'name').querySelector('input');
    name.value = 'Salt Ferry'; name.dispatch('change');
    assert.ok(named.calls.commit[0].some(p => p.op === 'set' && p.path.join('.') === 'content.routes.1.name' && p.value === 'Salt Ferry'));
    assert.ok(named.calls.commit[0].some(p => p.op === 'set' && p.path.join('.') === 'content.start.world.set.0' && p.value === 'storm@Salt Ferry'));
    const plain = setup({ focus: { rec: 'routes.0', path: null }, edit: pack => { pack.content.start = { world: { set: ['flood@fenhold–reedmoor'] } }; } });
    const page2 = plain.draw();
    const name2 = field(page2, 'name').querySelector('input');
    name2.value = 'Fen Road'; name2.dispatch('change');
    assert.deepEqual(plain.calls.commit.at(-1), [{ op: 'set', path: ['content', 'routes', 0, 'name'], value: 'Fen Road' }]);
    assert.match(page2.querySelector('p.st-problem').textContent, /named this route "fenhold–reedmoor"; change those by hand/);
    assert.match(page2.querySelector('.st-usedby').textContent, /1 record in the pack names it, such as content\.start\.world\.set\.0/);
    // In the Studio the commit has drawn the page again, so the warning goes to ctx.say (the note line a draw keeps).
    const said = [];
    const studio = setup({ focus: { rec: 'routes.0', path: null }, edit: pack => { pack.content.start = { world: { set: ['flood@fenhold–reedmoor'] } }; }, ctx: { say: text => said.push(text) } });
    const name3 = field(studio.draw(), 'name').querySelector('input');
    name3.value = 'Fen Road'; name3.dispatch('change');
    assert.deepEqual(said.length, 1);
    assert.match(said[0], /named this route "fenhold–reedmoor"; change those by hand/);
});

test('a refused change says why; Duplicate inserts a named copy, Delete removes the route, Back goes to the list', () => {
    const { calls, draw } = setup({ focus: { rec: 'routes.0', path: null }, refuse: true });
    const page = draw();
    const corridor = field(page, 'corridor').querySelector('input');
    corridor.value = 'X'; corridor.dispatch('change');
    assert.equal(page.querySelector('p.st-problem').textContent, 'No.');
    page.querySelector('.st-dup').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'insert', path: ['content', 'routes', 1], value: { from: 'fenhold', to: 'reedmoor', kind: 'road', km: 12, name: 'fenhold–reedmoor copy' } }]);
    page.querySelector('.st-del').click();
    assert.deepEqual(calls.commit.at(-1), [{ op: 'remove', path: ['content', 'routes', 0] }]);
    page.querySelector('.st-back').click();
    assert.deepEqual(calls.go.at(-1), ['map']);
});

test('a checker problem on a field shows under it, and a format 3 pack gets the read-only cards', () => {
    const problem = { path: 'content.routes[0].kind', message: 'the kind "lane" is not in routeKinds.' };
    const { draw } = setup({ focus: { rec: 'routes.0', path: null }, ctx: { problems: [problem] } });
    assert.match(field(draw(), 'kind').querySelector('.st-problem').textContent, /not in routeKinds/);
    const old = setup({ ctx: { legacy: true } });
    const page = old.draw();
    assert.equal(page.querySelector('.st-prow'), null);
    assert.ok(page.querySelector('.st-rec'));
});

test('Go to a route\'s field marks the field, not the JSON row; a path with no field opens the JSON row', () => {
    const page = setup({ focus: { rec: 'routes.1', path: ['hours'] } }).draw();
    assert.equal(page.querySelector('.st-at').closest('[data-key]').dataset.key, 'hours');
    const other = setup({ focus: { rec: 'routes.1', path: ['extra'] } }).draw();
    assert.equal(other.querySelector('.st-edit .st-at'), null, 'no form field is marked');
    assert.ok(other.querySelector('.st-at'), 'the JSON row takes the focus instead');
});
