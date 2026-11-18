// Small editor fixes from the Studio review (REVSTUDIO2 C20): a record with no id is not given a blank one (places, regions, scores), a
// blank range end clears a score's range as its hint says, an unnamed condition can be named (and not blanked), a list record that is not an
// object gets a card with its JSON row (conditions, markets), and a gate's text mode belongs to one record, not every lore entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { buildRefs } from '../../../studio/model/refs.js';
import { editSection as places } from '../../../studio/edit/places.js';
import { editSection as regions } from '../../../studio/edit/regions.js';
import { editSection as powers } from '../../../studio/edit/powers.js';
import { editSection as conditions } from '../../../studio/edit/conditions.js';
import { editSection as kinds } from '../../../studio/edit/kinds.js';
import { gateField } from '../../../studio/form/gate.js';

const BASE = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/world4-mini.json', import.meta.url), 'utf8'));

function setup(edit, key, change, focus) {
    installFakeDom();
    const pack = structuredClone(BASE);
    change(pack.content);
    const calls = [];
    const keeps = {};
    const ctx = { doc: { doc: pack }, kind: 'world', legacy: false, refs: buildRefs(pack), problems: [], focus,
        commit: patches => { calls.push(patches); return { ok: true }; }, go: () => {}, keep: id => (keeps[id] ??= {}) };
    const nodes = edit({ key, where: 'content', value: pack.content[key], count: pack.content[key].length }, ctx).flat().filter(Boolean);
    return { calls, nodes, root: nodes[0] };
}
const input = (root, key) => root.querySelector(`[data-key="${key}"] input`);
const type = (box, value) => { box.value = value; box.dispatch('change'); };

test('a place, a region and a score with no id are not given a blank one; the page says it needs one', () => {
    const cases = [
        [places, 'places', content => { delete content.places[1].id; }, 'places.1', /A place needs an id/],
        [regions, 'regions', content => { delete content.regions[0].id; }, 'regions.0', /needs an id/],
        [powers, 'scores', content => { content.scores = [{ name: 'Fen Water', start: 0 }]; }, 'scores.0', /A score needs an id/],
    ];
    for (const [edit, key, change, rec, said] of cases) {
        const { calls, root } = setup(edit, key, change, { rec, path: null });
        type(input(root, 'id'), '  ');
        assert.deepEqual(calls, [], key);
        assert.match(root.textContent, said, key);
        type(input(root, 'id'), 'named');
        assert.deepEqual(calls.at(-1).at(-1).value, 'named', `${key}: a real id still goes in`);
    }
});

test('a blank range end clears the score\'s range (the default), as the hint says', () => {
    const { calls, root } = setup(powers, 'scores', content => { content.scores = [{ id: 'fen-water', name: 'Fen Water', range: [-50, 50], start: 10 }]; }, { rec: 'scores.0', path: null });
    type(input(root, 'range.low'), '');
    assert.deepEqual(calls.at(-1), [{ op: 'remove', path: ['content', 'scores', 0, 'range'] }]);
});

test('an unnamed condition is named with a plain set, and a blank name is refused', () => {
    const { calls, root } = setup(conditions, 'conditions', content => { delete content.conditions[0].name; }, null);
    const name = input(root, 'name');
    type(name, ' ');
    assert.deepEqual(calls, []);
    assert.match(root.textContent, /A condition needs a name/);
    type(name, 'lamps-out');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['content', 'conditions', 0, 'name'], value: 'lamps-out' }]);
});

test('a condition or a market that is not an object gets a card with its JSON row instead of vanishing', () => {
    const cond = setup(conditions, 'conditions', content => { content.conditions.push(7); }, null);
    const card = cond.root.querySelector('[data-rec="conditions.1"]');
    assert.ok(card, 'the odd condition has a card');
    assert.match(card.textContent, /#2 · not a condition/);
    assert.ok(card.querySelector('.st-jsonrow'));
    const market = setup(kinds, 'markets', content => { content.markets = [{ type: 'town' }, 'oops']; }, null);
    const odd = market.root.querySelector('[data-rec="markets.1"]');
    assert.ok(odd, 'the odd market has a card');
    assert.match(odd.textContent, /This record is string/);
});

test('a gate\'s text mode is kept per record: switching one lore entry to text leaves the next in the builder', () => {
    installFakeDom();
    const content = structuredClone(BASE.content);
    const make = rec => gateField({ key: 'gate', label: 'Gate', value: 'place:fenhold', content, ownerId: null, rec }, () => {});
    make('first').querySelector('.st-totext').click();
    const again = make('first'), other = make('second');
    assert.equal(again.querySelector('textarea').hidden, false, 'the entry switched to text stays text over a redraw');
    assert.equal(other.querySelector('textarea').hidden, true, 'another entry keeps the builder');
});
