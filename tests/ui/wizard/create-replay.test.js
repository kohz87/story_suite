// Replay == live for a character made with the new view's sheet: the blocks Create makes are changes of the head reply, so a rebuild and a reload
// give the live story after each of: a swipe and the swipe back, an edited Re-read (grown, then shrunk), a middle delete, a rewind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { page, begin, settle } from '../../modules/rpg/view/page.js';
import { SKILL_SETS } from '../../../modules/rpg/templates.js';
import { withSet } from '../../../modules/rpg/view/wizard-data.js';
import { createWizardWorld } from '../../../ui/wizard/world.js';
import { createNewWizard } from '../../../ui/wizard/wizard.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const long = async () => { for (let n = 0; n < 6; n += 1) await settle(); };
const blocks = host => Object.keys(host.head()?.domains.dataModules?.active ?? {}).sort();

async function rebuilt(host, label) {
  const live = JSON.stringify(host.head());
  host.store.rebuild();
  assert.equal(JSON.stringify(host.head()), live, `${label}: a rebuild gives the live story`);
  await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
  assert.equal(JSON.stringify(host.head()), live, `${label}: a reload gives the live story`);
  assert.deepEqual(host.store.problems(), [], `${label}: nothing left inactive`);
}

// Wessel made with the sheet on the chat's head reply. → { host, at (the reply's index), first (the first define's receipt) }.
async function made(t) {
  const got = await page(t, { formula: 'standard', persona: 'Wessel' });
  const { host, doc } = got;
  await begin(host);
  await settle();
  const answers = [];
  const command = async (type, payload) => { const answer = await host.sdk.command(type, payload, { cause: 'ui' }); answers.push({ type, answer }); return answer; };
  const wizard = createNewWizard({ world: createWizardWorld({ sdk: host.sdk, ctx: () => host.ctx }), command, sheetCtx: () => ({ doc, sheetHost: doc.body }) });
  wizard.open();
  const run = wizard.session();
  run.draft = withSet(run.draft, SKILL_SETS[0]);
  doc.querySelector('.wz-steps button[data-value="review"]').click();
  doc.querySelector('[data-wiz="create"]').click();
  await long();
  assert.equal(wizard.isOpen(), false, 'made');
  assert.deepEqual(blocks(host), ['pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/wessel', 'pack.chat/wessel-skills']);
  return { ...got, at: host.store.headIndex(), first: answers[0].answer };
}

test('swipe and swipe back: the swipe takes everything Create made back, the swipe back brings the same story', { skip }, async t => {
  const { host, at } = await made(t);
  const live = JSON.stringify(host.head());
  await rebuilt(host, 'after Create');
  await host.swipe('A different opening.');
  await long();
  assert.deepEqual(blocks(host), [], 'one swipe takes it all back');
  await rebuilt(host, 'on the other swipe');
  await host.st.swipeTo(at, 0);
  await long();
  assert.equal(JSON.stringify(host.head()), live, 'the swipe back gives the same story');
  await rebuilt(host, 'after the swipe back');
});

test('an edited Re-read, grown then shrunk, keeps the reader\'s own blocks', { skip }, async t => {
  const { host, at } = await made(t);
  await host.st.editMessage(at, 'Opening. The barge creaks against the pier, and the river smells of tar and rain.');
  assert.equal((await host.turn.reread(at)).ok, true);
  assert.ok(blocks(host).includes('pack.chat/wessel'));
  await rebuilt(host, 'after a grown Re-read');
  await host.st.editMessage(at, 'Op.');
  assert.equal((await host.turn.reread(at)).ok, true);
  assert.ok(blocks(host).includes('pack.chat/wessel-skills'));
  await rebuilt(host, 'after a shrunk Re-read');
});

test('a middle delete after more replies, and a rewind to before Create', { skip }, async t => {
  const { host, at, first } = await made(t);
  await host.send('I walk the deck.', 'The deck is wet.');
  await host.send('I look at the river.', 'The river is high.');
  await rebuilt(host, 'after two more replies');
  await host.st.deleteMessage(at + 2);
  await long();
  assert.ok(blocks(host).includes('pack.chat/wessel'), 'a later reply deleted: the character stays');
  await rebuilt(host, 'after a middle delete');
  const back = await host.sdk.rewind({ index: at, beforeRev: first.receipt.rev });
  assert.equal(back.ok, true, back.message);
  await long();
  assert.equal(blocks(host).includes('pack.chat/wessel'), false, 'rewound to before Create');
  await rebuilt(host, 'after the rewind');
});
