// The People dossier's notes and Recent changes (PEOPLE-PLAN P5): a locked note shows only its rule (never a title or event wording), an opened one its title,
// and a bonds entry with a last event shows a change row; all of it follows a swipe and a swipe back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, record, idOf } from './helpers/people-rig.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';

const portOf = rig => createSbPort({ sdk: rig.host.sdk, selectors: buildSelectors(() => null, rig.host.sdk) });
const miraPage = rig => portOf(rig).view('dossier')[idOf('mira')];
const secrets = [{ id: 'a', title: 'The Second Ledger', meter: 'trust', at: 60, text: 'She hid it', when: 'she finds the ledger' }, { id: 'b', title: 'The Old Debt', meter: 'trust', at: 5, text: 'He owes a lot' }];

test('the dossier\'s Recent changes come from the bonds\' last event, and its notes from the store: a locked note shows no title or wording', async t => {
  const rig = await peopleRig(t);
  await rig.reply('One.', state => { state.npcs.find(item => item.id === idOf('mira')).secrets = secrets; });
  await rig.host.send('Two.', 'Mira smiles.\n\n<Changes>\n~ npc MIRA | trust: +9 | impact: major\n</Changes>');
  await rig.publish(() => {});
  const page = miraPage(rig);
  assert.equal(page.changes.length > 0, true, 'a bonds entry with a last event shows a change row');
  assert.equal(page.changes[0].meter, 'trust');
  const text = JSON.stringify(page);
  assert.equal(text.includes('The Second Ledger'), false, 'a locked note\'s title is not in the page');
  assert.equal(text.includes('she finds the ledger'), false, 'nor its event wording');
  assert.equal(text.includes('She hid it'), false, 'nor its text');
  assert.equal(page.secrets.items.every(item => item.title === null || item.open), true, 'only opened notes carry a title');
  assert.equal(page.secrets.total, 2, 'both notes still show, as rules');
  const queried = rig.host.sdk.query('people.dossier', { id: idOf('mira') });
  assert.equal('secrets' in queried, false);
  assert.equal(JSON.stringify(queried).includes('The Second Ledger'), false);
  assert.equal(rig.host.sdk.query('people.secretOwners', {})['the second ledger'], undefined);
});

test('the notes and the changes follow a swipe and a swipe back', async t => {
  const rig = await peopleRig(t);
  await rig.reply('One.', state => { state.npcs.find(item => item.id === idOf('mira')).secrets = secrets; });
  await rig.host.send('Two.', 'Mira smiles.\n\n<Changes>\n~ npc MIRA | trust: +9 | impact: major\n</Changes>');
  await rig.publish(() => {});
  const before = miraPage(rig);
  await rig.host.swipe('Another two.');
  assert.deepEqual(miraPage(rig).changes, [], 'the new swipe has no change yet');
  await rig.host.st.swipeTo(rig.host.store.headIndex(), 0);
  assert.deepEqual(miraPage(rig), before, 'swipe back brings the page back as it was');
});
