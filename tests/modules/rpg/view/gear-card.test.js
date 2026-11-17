// The Party card's Inventory button and the slot card it opens (Gear in fights): four buttons in one row, eight equal tiles with a thin condition line,
// no carry on the card; off, the card is as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { createPartyWidget } from '../../../../modules/rpg/view/party.js';
import { SLOT_ORDER } from '../../../../modules/rpg/view/gear-card.js';
import { createCoreModule } from '../../../../modules/scene/domains/index.js';
import { createHarness } from '../../inventory/helpers/fake-ctx.js';
import { stocked } from '../../inventory/fixtures.js';
import { characterDefinition, fakeState, roleOf, skillsDefinition } from './helpers.js';

const wessel = { definition: characterDefinition('wessel', 'Wessel'), fields: { health: 3, mana: 4, stamina: 1, str: 14, soul: 2, xp: 40 } };
const ren = { definition: characterDefinition('ren', 'Ren'), fields: { health: 5, mana: 2, stamina: 3, str: 7, soul: 1, xp: 85 } };
const skills = { definition: skillsDefinition('wessel-skills', 'Wessel', { tab: true, card: false, tabName: 'Skills', icon: 'ph-star' }), fields: { skill1: 'Iron Breath', rank1: 2 } };
const state = () => fakeState([ren, wessel, skills]);

// What is worn: Wessel (the party's bag) a rare sword, a worn jerkin and a broken buckler; Ren an uncommon cap.
function worn(tweak = () => {}) {
    const module = createCoreModule({ hooks: () => [], settings: () => ({}), extras: { gearOn: () => true, persona: () => 'Wessel' } });
    const s = stocked(module);
    const inv = s.domains.inventory;
    s.domains.party = { actors: { ac_ren00001: { id: 'ac_ren00001', name: 'Ren' } } };
    const piece = (id, name, slot, rarity, owner, place, cond) => {
        inv.defs[`story/${id}`] = { id: `story/${id}`, name, kind: 'equipment', slot, rarity, value: 10, stack: false, tags: [], note: '', stats: {}, effect: {} };
        inv.stacks[`it_${(id + '00000000').slice(0, 8)}`] = { id: `it_${(id + '00000000').slice(0, 8)}`, def: `story/${id}`, qty: 1, owner, equipped: place, note: '', from: '', ...(cond === undefined ? {} : { cond }) };
    };
    piece('sword', 'Cane Sword', 'weapon', 'rare', 'party', 'weapon');
    piece('jerkin', 'Boiled Leather Jerkin', 'body', 'common', 'party', 'body', 50);
    piece('buckler', 'Oak Buckler', 'off-hand', 'uncommon', 'party', 'off-hand', 0);
    piece('cap', 'Iron Cap', 'head', 'uncommon', 'ac_ren00001', 'head');
    tweak(inv);
    return createHarness([module], { state: s, extra: { feature: id => id === 'story-block.gear' || id === 'story-block.rpg' } });
}

function draw({ gear = null } = {}) {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const widget = createPartyWidget({ headState: () => state(), readerName: () => 'Wessel', roleOf, gear, exportCharacter: () => {} });
    widget.render(el, {}, {});
    return { doc, el };
}
const names = root => root.querySelectorAll('.rpg-card-actions button').map(node => node.textContent);
const card = (el, name) => el.querySelector(`.rpg-card[data-character="${name}"]`);
const on = h => ({ on: () => true, view: args => h.query('gear.view', args) });

// USER-approved Fix A (4 Nov, Party Export overflow): the quarters rule (`flex: 1 1 0; min-width: 0`) cut "Export" off at 1440; the buttons now grow from their own text and wrap.
test('the card buttons keep the width of their text and wrap to a second row instead of overflowing', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    const rule = /\.rpg-card-actions-gear \.ss-button \{([^}]*)\}/.exec(css)?.[1] ?? '';
    assert.match(rule, /flex: 1 1 auto;/);
    assert.match(rule, /min-width: fit-content;/);
    assert.match(rule, /justify-content: center;/);
    assert.match(rule, /padding-inline: 6px;/);
    assert.match(rule, /white-space: nowrap;/);
    assert.match(css, /\.rpg-card-actions-gear \{[^}]*flex-wrap: wrap;/);
    assert.doesNotMatch(rule, /flex: 0/);
});

// The tiles' buttons: Unequip on a worn tile (back to the bag), "Equip from bag" on an empty one (the bag pieces that fit it), the lock for a signature piece.
function withApi(h) {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const calls = [];
    const api = { command: async (type, payload) => { calls.push([type, payload]); const r = h.run(type, payload, { cause: 'ui', extra: { feature: id => id === 'story-block.gear' || id === 'story-block.rpg' } }); return r; } };
    createPartyWidget({ headState: () => state(), readerName: () => 'Wessel', roleOf, gear: on(h), exportCharacter: () => {} }).render(el, {}, api);
    card(el, 'Wessel').querySelector('.rpg-gear-open').click();
    return { el, calls };
}
const tile = (el, place) => el.querySelector(`.rpg-slot[data-slot="${place}"]`);
const later = () => new Promise(resolve => setImmediate(resolve));
