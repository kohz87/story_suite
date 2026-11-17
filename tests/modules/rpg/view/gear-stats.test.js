// What gear adds to a stat on the Party card (Gear in fights): the big number is the stat a roll uses with "+N" under it, in a theme colour; no gear on
// the stat is today's markup; a broken piece, the switch off and a companion's own gear; and the Skills sheet's "Rolls with it" line agrees with the roll.
// The numbers come from planGear + applyGear, the roll's own source. The rendered check (real CSS, sizes, shots) is run outside the suite with Playwright.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { createPartyWidget } from '../../../../modules/rpg/view/party.js';
import { readParty } from '../../../../modules/rpg/view/party-data.js';
import { renderSkills, rollOf } from '../../../../modules/rpg/view/skills.js';
import { applyGear, planGear } from '../../../../modules/rpg/gear.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { createCoreModule } from '../../../../modules/scene/domains/index.js';
import { createHarness } from '../../inventory/helpers/fake-ctx.js';
import { stocked } from '../../inventory/fixtures.js';
import { dump } from '../../../core/helpers/gear-ui-state.js';
import { fakeState } from './helpers.js';

const template = role => structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === role).definition);
const BASE = { str: 5, vit: 10, agi: 10, dex: 5, int: 5, luk: 5, cha: 5, level: 2 };
const roleOf = definition => definition?.role ?? null;
const named = (who, fields) => { const definition = template('character'); definition.slug = who.toLowerCase(); definition.name = who; return { definition, fields: { who, ...BASE, ...fields } }; };
const SKILLS = { who: 'Astra', skill1: 'Short blade', stat1: 'agi', uses1: 'stamina', rank1: 1, skill2: 'Iron Breath', stat2: 'vit', uses2: 'stamina', rank2: 2 };

/** The owner's shape: Astra (the reader's lead, gear filed under `party`) wears Linen Clothes +1 VIT, Traveling Robe +1 VIT, Cane Sword +1 AGI; Ren (a companion) wears what `ren` says. */
function world({ ren = [], cond = {}, extra = {} } = {}) {
    const module = createCoreModule({ hooks: () => [], settings: () => ({}), extras: { gearOn: () => true, persona: () => 'Astra' } });
    const s = stocked(module), inv = s.domains.inventory;
    const piece = (id, name, slot, owner, stats, place, rarity = 'common') => {
        inv.defs[`story/${id}`] = { id: `story/${id}`, name, kind: 'equipment', slot, rarity, value: 1, stack: false, tags: [], note: '', stats };
        inv.stacks[`it_${id}0000`] = { id: `it_${id}0000`, def: `story/${id}`, qty: 1, owner, equipped: place, note: '', from: '', ...(cond[id] === undefined ? {} : { cond: cond[id] }) };
    };
    piece('linen', 'Linen Clothes', 'body', 'party', { VIT: 1 }, 'body');
    piece('robe', 'Traveling Robe', 'cloak', 'party', { VIT: 1 }, 'cloak');
    piece('cane', 'Cane Sword', 'weapon', 'party', { AGI: 1 }, 'weapon');
    ren.forEach(([id, name, slot, stats, rarity]) => piece(id, name, slot, 'ac_ren00001', stats, slot, rarity));
    s.domains.party = { actors: { ac_ren00001: { id: 'ac_ren00001', name: 'Ren' } } };
    Object.assign(s.domains, fakeState([named('Astra', {}), named('Ren', extra), { definition: { ...template('skills'), slug: 'astra-skills' }, fields: SKILLS }]).domains);
    // (the harness works on a copy of the state, so each question is put to a fresh one: a change to `s` shows at once, as a new head would)
    const query = (name, args) => (name === 'party.actors' ? [{ id: 'ac_ren00001', name: 'Ren' }] : createHarness([module], { state: s }).query(name, args));
    return { s, query, plan: () => planGear(readSheet(s), query, 'Astra') };
}

function draw(w, { on = true } = {}) {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const gear = { on: () => on, view: args => w.query('gear.view', args), plan: w.plan };
    const widget = createPartyWidget({ headState: () => w.s, readerName: () => 'Astra', roleOf, gear });
    const handle = widget.render(el, {}, {});
    return { doc, el, widget, handle };
}
const cell = (el, name, stat) => el.querySelector(`.rpg-card[data-character="${name}"] .rpg-stat[data-stat="${stat}"]`);
const cells = (el, name) => el.querySelector(`.rpg-card[data-character="${name}"] .rpg-stats`).querySelectorAll('.rpg-stat').map(node => node.textContent);

test('a companion\'s own gear shows on their card only; the reader\'s party bag is not theirs', () => {
    const { el } = draw(world({ ren: [['cap', 'Iron Cap', 'head', { VIT: 2 }, 'uncommon']] }));
    assert.equal(cell(el, 'Ren', 'vit').textContent, 'VIT12+2');
    assert.equal(cell(el, 'Ren', 'agi').textContent, 'AGI10', 'the cane sword is Astra\'s');
    assert.equal(cell(el, 'Astra', 'vit').textContent, 'VIT12+2');
});

test('the sum is held to 30', () => {
    const { el } = draw(world({ extra: { vit: 20 }, ren: [['plate', 'Plate', 'body', { VIT: 5 }, 'legendary'], ['helm', 'Helm', 'head', { VIT: 5 }, 'legendary'], ['mail', 'Mail', 'feet', { VIT: 5 }, 'legendary']] }));
    assert.equal(cell(el, 'Ren', 'vit').querySelector('b').textContent, '30');
});

test('redraw: equipping, unequipping or breaking a piece changes the cell on the next draw', () => {
    const w = world(), { el, handle } = draw(w);
    const changed = () => handle.update();
    assert.equal(cell(el, 'Astra', 'agi').textContent, 'AGI11+1');
    w.s.domains.inventory.stacks.it_cane0000.equipped = '';
    changed();
    assert.equal(cell(el, 'Astra', 'agi').textContent, 'AGI10');
    w.s.domains.inventory.stacks.it_cane0000.equipped = 'weapon';
    changed();
    assert.equal(cell(el, 'Astra', 'agi').textContent, 'AGI11+1');
    w.s.domains.inventory.stacks.it_linen0000.cond = 0;
    changed();
    assert.equal(cell(el, 'Astra', 'vit').textContent, 'VIT11+1');
});

test('the colours are theme tokens, never literals', () => {
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    for (const name of ['rpg-stat-up', 'rpg-stat-down']) assert.match(new RegExp(`\\.${name} \\{ color: var\\(--ss-[a-z]+\\); \\}`).exec(css)?.[0] ?? '', /var\(--ss-/);
    assert.doesNotMatch(/\.rpg-stat-(up|down|add)[^}]*\}/.exec(css)[0], /#[0-9a-f]{3,6}|rgb/i);
});
