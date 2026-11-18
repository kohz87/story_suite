// The Overview editor (ST-OVER): the pack's own fields as rows, edits as one patch each, cleared optional fields taken out, the needs and the
// recommended game, problems on their rows from every field's call, and the read-only fallback for a format 3 pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/overview.js';
import { PACK_FIELDS_V4 } from '../../../packs/limits.js';

const read = name => JSON.parse(readFileSync(new URL(`../../packs/studio/fixtures/${name}`, import.meta.url), 'utf8'));
const WORLD = read('world4-mini.json');
const GAME = read('game4-mini.json');
const TOP = PACK_FIELDS_V4.filter(key => key !== 'content');

function setup(base = WORLD, opts = {}) {
    installFakeDom();
    const pack = structuredClone(opts.edit ? opts.edit(structuredClone(base)) : base);
    const calls = [];
    const keeps = {};
    const ctx = { doc: pack, kind: pack.kind === 'game' ? 'game' : 'world', legacy: opts.legacy ?? false, other: opts.other ?? null, problems: [], focus: null,
        commit: patches => { calls.push(patches); return opts.refuse ? { ok: false, refusal: 'No.' } : { ok: true }; }, keep: id => (keeps[id] ??= {}) };
    // As the Studio draws Overview: one call per top-level field the pack holds, in the checker's order, each with its own problems.
    const draw = (problems = []) => TOP.filter(key => pack[key] !== undefined).flatMap(key => editSection({ key, where: 'top', value: pack[key], count: 1 },
        { ...ctx, problems: problems.filter(problem => problem.path === key || problem.path.startsWith(`${key}.`)) }));
    return { pack, calls, draw, keeps };
}
const page = nodes => { const root = document.createElement('div'); root.append(...nodes); return root; };
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const type = (root, key, value) => { const input = field(root, key).querySelector('input,textarea'); input.value = value; input.dispatch('change'); };

test('the first field draws the whole form in the mock\'s order and the later fields draw nothing', () => {
    const { draw } = setup();
    const nodes = draw();
    const root = page(nodes);
    const keys = root.querySelectorAll('.srow').map(row => row.dataset.key);
    assert.deepEqual(keys.slice(0, 5), ['name', 'id', 'version', 'author', 'description']);
    assert.ok(keys.includes('requires.suite') && keys.includes('requires.capabilities') && keys.includes('recommends.game.id'));
    assert.equal(field(root, 'name').querySelector('input').value, WORLD.name);
    assert.equal(field(root, 'recommends.game.version').querySelector('input').value, '^0.1');
    assert.match(field(root, 'kind').textContent, /World pack · format 4/);
    assert.equal(editSection({ key: 'version', where: 'top', value: WORLD.version, count: 1 }, { doc: WORLD, kind: 'world', commit: () => ({ ok: true }), problems: [] }).length > 0, true,
        'a field called with no earlier draw of its document still draws the form');
});

test('a text edit is one set patch; a cleared optional field is removed, and a blank id or version is refused', () => {
    const { calls, draw, keeps } = setup();
    const root = page(draw());
    type(root, 'name', '  The Fen  ');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['name'], value: 'The Fen' }]);
    type(root, 'version', '0.2.0');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['version'], value: '0.2.0' }]);
    type(root, 'author', '');
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: ['author'] }]);
    type(root, 'description', '');
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: ['description'] }]);
    const before = calls.length;
    type(root, 'id', '');
    assert.equal(calls.length, before);
    assert.match(root.querySelector('p.st-problem').textContent, /needs an id/);
    assert.match(keeps.overview.note, /needs an id/, 'the note outlives the redraw');
    type(root, 'name', WORLD.name);
    assert.equal(calls.length, before, 'an unchanged value makes no edit');
});

test('a field the pack lacks can be filled in, and an empty one makes no edit', () => {
    const { calls, draw } = setup(WORLD, { edit: pack => { delete pack.author; delete pack.description; return pack; } });
    const root = page(draw());
    type(root, 'description', '');
    assert.equal(calls.length, 0);
    type(root, 'author', 'Me');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['author'], value: 'Me' }]);
});

test('the needs: the suite range and the module chips edit requires, and requires is written whole when missing', () => {
    const { calls, draw } = setup();
    const root = page(draw());
    type(root, 'requires.suite', '^0.2');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['requires', 'suite'], value: '^0.2' }]);
    const add = field(root, 'requires.capabilities').querySelector('input');
    add.value = 'inventory'; add.dispatch('change');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['requires', 'capabilities'], value: ['inventory'] }]);

    const bare = setup(WORLD, { edit: pack => { delete pack.requires; return pack; } });
    type(page(bare.draw()), 'requires.suite', '^0.1');
    assert.deepEqual(bare.calls.at(-1), [{ op: 'set', path: ['requires'], value: { suite: '^0.1' } }]);
});

test('the older storyBlock range shows only when present, and clearing it takes it out', () => {
    assert.equal(field(page(setup().draw()), 'requires.storyBlock'), null);
    const { calls, draw } = setup(WORLD, { edit: pack => { pack.requires.storyBlock = '^1'; return pack; } });
    type(page(draw()), 'requires.storyBlock', '');
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: ['requires', 'storyBlock'] }]);
});

test('the recommended game: edits write recommends whole, both blank takes it out, and the open game can be used', () => {
    const { calls, draw } = setup();
    const root = page(draw());
    type(root, 'recommends.game.version', '^1');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['recommends'], value: { game: { id: 'studio-game4-mini', version: '^1' } } }]);

    const one = setup(WORLD, { edit: pack => { pack.recommends = { game: { id: 'x' } }; return pack; } });
    type(page(one.draw()), 'recommends.game.id', '');
    assert.deepEqual(one.calls.at(-1), [{ op: 'remove', path: ['recommends'] }]);

    const none = setup(WORLD, { edit: pack => { delete pack.recommends; return pack; }, other: { ...GAME, version: '2.3.0' } });
    const open = page(none.draw());
    assert.match(open.querySelector('.st-use-open').textContent, /studio-game4-mini \^2/);
    open.querySelector('.st-use-game').click();
    assert.deepEqual(none.calls.at(-1), [{ op: 'set', path: ['recommends'], value: { game: { id: 'studio-game4-mini', version: '^2' } } }]);
    assert.equal(page(setup(WORLD, { other: GAME }).draw()).querySelector('.st-use-open'), null, 'no offer when it already names the open game');
});

test('a game pack has no recommends rows, and renaming it says when the open world names it', () => {
    const { calls, draw } = setup(GAME, { other: WORLD });
    const root = page(draw());
    assert.equal(field(root, 'recommends.game.id'), null);
    assert.match(field(root, 'kind').textContent, /Game pack/);
    type(root, 'id', 'new-game');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['id'], value: 'new-game' }]);
    assert.match(root.querySelector('p.st-problem').textContent, /open world recommends this game as studio-game4-mini/);
});

test('each field\'s problems land on its row, a parent path on its first row, and a refusal is said', () => {
    const { draw } = setup(WORLD, { refuse: true });
    const root = page(draw([
        { code: 'BAD_VERSION', path: 'version', message: 'version must look like 1.0.0.' },
        { code: 'BAD_REQUIRES', path: 'requires', message: 'requires must say which suite version it needs.' },
        { code: 'BAD_FIELD', path: 'recommends.game.version', message: 'must be a range.' },
    ]));
    assert.match(field(root, 'version').querySelector('.st-problem').textContent, /1\.0\.0/);
    assert.equal(field(root, 'version').querySelector('input').getAttribute('aria-invalid'), 'true');
    assert.match(field(root, 'requires.suite').querySelector('.st-problem').textContent, /suite version/);
    assert.match(field(root, 'recommends.game.version').querySelector('.st-problem').textContent, /range/);
    assert.equal(field(root, 'name').querySelector('.st-problem'), null);
    type(root, 'name', 'Other');
    assert.equal(root.querySelector('p.st-problem').textContent, 'No.');
});

test('a format 3 pack, or a context with no commit, draws each field read-only', () => {
    const legacy = setup(WORLD, { legacy: true });
    const nodes = legacy.draw();
    assert.equal(nodes.length, TOP.filter(key => WORLD[key] !== undefined).length);
    assert.equal(page(nodes).querySelectorAll('input').length, 0);
    const plain = editSection({ key: 'id', where: 'top', value: 'x', count: 1 }, { doc: WORLD, kind: 'world', problems: [] });
    assert.match(plain[0].textContent, /id/);
});
