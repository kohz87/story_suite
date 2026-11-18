import test from 'node:test';
import assert from 'node:assert/strict';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../modules/rpg/templates.js';
import { readParty } from '../../modules/rpg/view/party-data.js';
import { setupDom } from '../ui/view/mounts/helpers.js';
import { fakeState } from '../modules/rpg/view/helpers.js';
import { renderSkills } from '../../modules/rpg/view/skills.js';
import { joinCard, joinDraft, joinOffers } from '../../modules/rpg/join.js';
import { buildDefinitions, readDraft } from '../../modules/rpg/view/wizard-data.js';
import { skip, reply, receipts } from './cast-skills.helpers.js';
import { pullWorld } from './skills-pull.helpers.js';

// ---- the Skills view --------------------------------------------------------------------------------------------------------------------

const template = role => structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === role).definition);
function drawSkills(level, fields) {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const character = { definition: template('character'), fields: { who: 'Harrak', str: 14, vit: 12, agi: 11, dex: 10, int: 8, luk: 9, cha: 10, level } };
    const person = readParty(fakeState([character, { definition: template('skills'), fields: { who: 'Harrak', ...fields } }]), { own: 'Harrak' })[0];
    renderSkills(el, { character: person, api: {}, onBack: () => {} });
    return { el, person };
}
const SIG = { skill1: 'Beacon Call', about1: 'The horn.', stat1: 'cha', uses1: 'stamina', rank1: 1, skill2: 'Own Trick', about2: 'Mine.', stat2: 'dex', uses2: 'stamina', rank2: 0, sig: 1 };

test('the Skills view marks a signature skill with a lock after the rank pill, a legend entry and a foot-note sentence; only that skill', () => {
    const { el } = drawSkills(56, SIG);
    const cards = el.querySelectorAll('.rpg-skill');
    assert.equal(cards[0].querySelectorAll('.rpg-skill-lock').length, 1);
    assert.equal(cards[0].querySelector('.rpg-skill-lock').getAttribute('title'), 'Signature skill, from the pack');
    const top = [...cards[0].querySelector('.rpg-skill-top').children].map(node => node.className);
    assert.ok(top.findIndex(name => name.includes('rpg-rank')) + 1 === top.findIndex(name => name.includes('rpg-skill-lock')), 'right after the rank pill');
    assert.equal(cards[1].querySelectorAll('.rpg-skill-lock').length, 0, 'her own skill has none');
    assert.match(el.querySelector('.rpg-skill-legend').textContent, /Signature: from the pack, kept as written/);
    assert.match(el.querySelector('.rpg-skill-note').textContent, /signature skill came with the person from the pack/);
    const plain = drawSkills(56, { ...SIG, sig: 0 }).el;
    assert.equal(plain.querySelectorAll('.rpg-skill-lock').length, 0);
    assert.doesNotMatch(plain.querySelector('.rpg-skill-legend').textContent, /Signature/);
    assert.doesNotMatch(plain.querySelector('.rpg-skill-note').textContent, /signature/);
});

// ---- Edit first --------------------------------------------------------------------------------------------------------------------------

test('Edit first carries the signature skills (the abilities of their NPC State record): the offer records them, the card\'s payload has them and the wizard draft marks them', { skip }, async t => {
    const host = await pullWorld(t, { join: 'ask' });
    await host.send('Mara waits.', reply('+ party Mara | about: a ferrywoman'));
    const offer = receipts(host).find(entry => entry.data?.join?.op === 'offer').data.join;
    assert.deepEqual(offer.skills.map(skill => skill.name), ['Mend', 'Lantern Ward', 'Ferry Lore']);
    const entries = [{ index: host.ctx.chat.length - 1, receipt: { data: { join: offer } } }];
    const card = joinCard(joinOffers(entries, host.ctx.chat.length - 1, []));
    const edit = card.actions.find(action => action.id === 'edit');
    assert.deepEqual(edit.payload.skills.map(skill => skill.rank), [1, 1, 1]);
    const draft = joinDraft(edit.payload);
    assert.deepEqual(draft.skills.map(skill => [skill.name, skill.rank, skill.sig]), [['Mend', 1, true], ['Lantern Ward', 1, true], ['Ferry Lore', 1, true]]);
    const made = buildDefinitions(draft, {});
    assert.equal(made.skills.state.sig.default, 7);
    assert.deepEqual([made.skills.state.rank1.default, made.skills.state.rank3.default, made.skills.state.skill2.default], [1, 1, 'Lantern Ward']);
    assert.deepEqual(readDraft(draft), draft, 'a draft read again is the same');
    // an offer with no skills has a payload as before
    assert.equal('skills' in joinCard(joinOffers([{ index: 1, receipt: { data: { join: { op: 'offer', name: 'Pip', about: '', soul: 1, best: '' } } } }], 1, [])).actions[1].payload, false);
});
