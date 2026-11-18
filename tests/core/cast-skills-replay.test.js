import test from 'node:test';
import assert from 'node:assert/strict';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../modules/rpg/templates.js';
import { joinCard, joinDraft, joinOffers } from '../../modules/rpg/join.js';
import { buildDefinitions, readDraft } from '../../modules/rpg/view/wizard-data.js';
import { skip, reply, receipts } from './cast-skills.helpers.js';
import { pullWorld } from './skills-pull.helpers.js';

const template = role => structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === role).definition);

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
