// The conditions form (ST-COND): fields, rename through the reference index, effects, "used by", add, move, remove.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/conditions.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { apply } from '../../../studio/model/edits.js';
import { openDoc } from '../../../studio/model/doc.js';

const WORLD = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil-world/pack.json', import.meta.url), 'utf8'));

function setup(pack = WORLD, extra = {}) {
    installFakeDom();
    const commits = [];
    const went = [];
    const kept = {};
    const ctx = { doc: pack, kind: 'world', legacy: false, refs: buildRefs(pack), problems: [], focus: null, commit: patches => { commits.push(patches); return { ok: true }; },
        keep: id => (kept[id] ??= {}), go: (...args) => went.push(args), ...extra };
    const section = { key: 'conditions', where: 'content', value: pack.content.conditions, count: pack.content.conditions.length };
    const nodes = editSection(section, ctx);
    return { nodes, root: nodes[0], commits, went, ctx };
}
const rec = (root, i) => root.querySelector(`[data-rec="conditions.${i}"]`);
const field = (root, i, key) => rec(root, i).querySelector(`[data-key="${key}"]`);

test('one card per condition, with its fields and the count', () => {
    const { root } = setup();
    assert.equal(root.querySelector('.secl2').textContent, `Conditions · ${WORLD.content.conditions.length}`);
    assert.equal(root.querySelectorAll('section.st-rec').length, WORLD.content.conditions.length);
    assert.equal(field(root, 1, 'name').querySelector('input').value, 'grain-dear');
    assert.equal(field(root, 1, 'scope').querySelectorAll('option').find(o => o.getAttribute('selected') !== null && o.selected !== false)?.textContent, 'region');
});

test('editing a field commits one set patch; clearing Lasts removes it; the switches write true or remove', () => {
    const { root, commits } = setup();
    const means = field(root, 0, 'means').querySelector('textarea');
    means.value = 'Dry fields.'; means.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'conditions', 0, 'means'], value: 'Dry fields.' }]);
    const fades = field(root, 0, 'fades').querySelector('input');
    fades.value = ''; fades.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'remove', path: ['content', 'conditions', 0, 'fades'] }]);
    const scope = field(root, 0, 'scope').querySelector('select');
    scope.value = 'realm'; scope.dispatch('change');
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'conditions', 0, 'scope'], value: 'realm' }]);
});

test('a rename goes through the reference index: the patches change every use, and a bad id shows a problem', () => {
    const used = WORLD.content.conditions.map(c => c.name).find(name => buildRefs(WORLD).uses.some(u => u.kind === 'condition' && u.id === name && u.role !== 'id'));
    const at = WORLD.content.conditions.findIndex(c => c.name === used);
    const { root, commits } = setup();
    const input = field(root, at, 'name').querySelector('input');
    input.value = 'Bad Name'; input.dispatch('change');
    assert.equal(commits.length, 0);
    assert.ok(field(root, at, 'name').querySelector('.st-problem'));
    input.value = 'renamed-thing'; input.dispatch('change');
    assert.equal(commits.length, 1);
    const done = apply(openDoc({ doc: WORLD }), commits[0]);
    assert.equal(done.ok, true);
    assert.ok(done.doc.doc.content.conditions[at].name === 'renamed-thing');
    const after = buildRefs(done.doc.doc);
    assert.equal(after.uses.filter(u => u.kind === 'condition' && u.id === used).length, 0);
    assert.ok(after.uses.filter(u => u.kind === 'condition' && u.id === 'renamed-thing' && u.role !== 'id').length > 0);
    assert.equal(after.uses.some(u => u.dangling), false);
});

test('price effects: chips become the prices object, a bad chip is refused with a problem, routes are text', () => {
    const { root, commits } = setup();
    const row = field(root, 1, 'effects.prices');
    assert.deepEqual(row.querySelectorAll('.kc').map(c => c.textContent), ['food ×2×', 'fodder ×2×']);
    const box = row.querySelector('input.kadd');
    box.value = 'salt ×0'; box.dispatch('keydown', { key: 'Enter' });
    assert.equal(commits.length, 0);
    assert.ok(row.querySelector('.st-problem'));
    row.querySelector('button[aria-label="Remove salt ×0"]').click();
    assert.equal(row.querySelector('.st-problem'), null);
    assert.equal(commits.length, 1, 'taking the bad chip out commits the list as it was');
    row.querySelector('button[aria-label="Remove fodder ×2"]').click();
    assert.deepEqual(commits.at(-1), [{ op: 'set', path: ['content', 'conditions', 1, 'effects'], value: { prices: { food: '×2' } } }]);
    const routes = field(root, 1, 'effects.routes').querySelector('input');
    routes.value = 'blocked'; routes.dispatch('change');
    assert.deepEqual(commits.at(-1)[0].value, { prices: { food: '×2', fodder: '×2' }, routes: 'blocked' });
});

test('"used by" lists the events and templates that set, clear or test the condition, and Go to opens the record', () => {
    const refs = buildRefs(WORLD);
    const name = WORLD.content.conditions.map(c => c.name).find(n => refs.uses.some(u => u.kind === 'condition' && u.id === n && u.role === 'set' && u.owner.part === 'worldEvents'));
    const at = WORLD.content.conditions.findIndex(c => c.name === name);
    const { root, went } = setup();
    const buttons = field(root, at, 'used-by').querySelectorAll('.st-used');
    assert.ok(buttons.length > 0);
    assert.ok(field(root, at, 'used-by').textContent.includes('Sets it'));
    const first = buttons.find(b => b.dataset.rec.startsWith('worldEvents.'));
    first.click();
    assert.deepEqual(went.at(-1), ['events', first.dataset.rec]);
    const lonely = setup({ ...WORLD, content: { ...WORLD.content, conditions: [{ name: 'alone', scope: 'place', means: 'x' }], worldEvents: [], templates: [], start: undefined } });
    assert.equal(lonely.root.querySelector('.st-usedby .none').textContent, 'Nothing uses this condition yet.');
});

test('add inserts a new condition at the end; move and remove commit; a used condition cannot be removed', () => {
    const { root, commits } = setup();
    root.querySelector('.st-add').click();
    const made = commits.at(-1)[0];
    assert.equal(made.op, 'insert');
    assert.equal(made.path.at(-1), WORLD.content.conditions.length);
    assert.equal(made.value.name, 'new-condition');
    assert.equal(rec(root, 0).querySelector('.st-up').hasAttribute('disabled'), true);
    rec(root, 0).querySelector('.st-down').click();
    assert.deepEqual(commits.at(-1), [{ op: 'move', path: ['content', 'conditions', 0], to: 1 }]);
    const alone = setup({ ...WORLD, content: { ...WORLD.content, conditions: [{ name: 'alone', scope: 'place', means: 'x' }], worldEvents: [], templates: [], start: undefined } });
    alone.root.querySelector('.st-remove').click();
    assert.deepEqual(alone.commits.at(-1), [{ op: 'remove', path: ['content', 'conditions', 0] }]);
    const refs = buildRefs(WORLD);
    const usedAt = WORLD.content.conditions.findIndex(c => refs.uses.some(u => u.kind === 'condition' && u.id === c.name && u.role !== 'id'));
    const before = commits.length;
    rec(root, usedAt).querySelector('.st-remove').click();
    assert.equal(commits.length, before);
    assert.ok(rec(root, usedAt).querySelector('.subrow .st-problem'));
});

test('a pack that cannot be edited, or a non-list, falls back to the read-only cards', () => {
    const { nodes } = setup(WORLD, { legacy: true });
    assert.equal(nodes[0].querySelector('.st-jsonshow'), null);
    assert.ok(nodes[0].querySelector('.secl2'));
});

test('a focus on a field marks its control, and a checker problem shows under it', () => {
    const { root } = setup(WORLD, { focus: { rec: 'conditions.0', path: ['means'] }, problems: [{ path: 'content.conditions[0].means', message: 'means must be one plain sentence.', level: 'error' }] });
    assert.ok(field(root, 0, 'means').querySelector('textarea').classList.contains('st-at'));
    assert.equal(field(root, 0, 'means').querySelector('.st-problem').textContent, 'means must be one plain sentence.');
});
