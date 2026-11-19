// The new view's Create sends what the earlier wizard's Create sent: the same commands, payloads and order, all with `{ cause: 'ui' }`. Each case runs the
// new sheet (ui/wizard) on a fresh chat and compares what reached the engine and which blocks the story holds after with values captured from the earlier window.
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { page, begin, settle } from '../../modules/rpg/view/page.js';
import { SKILL_SETS } from '../../../modules/rpg/templates.js';
import { CHAR_FILE, parseCharacterFile } from '../../../modules/rpg/charfile.js';
import { withImport, withSet } from '../../../modules/rpg/view/wizard-data.js';
import { createWizardWorld } from '../../../ui/wizard/world.js';
import { createNewWizard } from '../../../ui/wizard/wizard.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const CREATE_TYPES = ['dm.define', 'dm.remove', 'inventory.add', 'inventory.carry', 'wallet.set'];
const long = async () => { for (let n = 0; n < 6; n += 1) await settle(); };
const SAVED = JSON.stringify({ [CHAR_FILE]: 1, soul: 2, points: 3, stats: { str: 14, vit: 12, agi: 11, dex: 10, int: 8, wis: 9, cha: 10 },
  skills: [{ name: 'Iron Breath', about: 'Steadies the lungs in a long fight.', stat: 'vit', uses: 'stamina', rank: 2 }],
  items: [{ name: 'Oilskin Coat', qty: 1, note: 'waxed', kind: 'equipment', rarity: 'uncommon' }, { name: 'Torch', qty: 2 }], money: 50 });

const fighter = run => { const draft = run.draft; run.draft = { ...withSet(draft, SKILL_SETS[0]), stats: { ...draft.stats, str: draft.stats.str + 3, vit: draft.stats.vit + 2 } }; };
const imported = run => { const file = parseCharacterFile(SAVED).file; const made = withImport(run.draft, file); run.draft = { ...made.draft, name: 'Wessel' }; run.imported = { file, fileName: 'wessel.json', before: made.before }; };
const refuseSkills = (type, payload) => (type === 'dm.define' && payload?.after ? { ok: false, code: 'REFUSED', message: 'No room for it.' } : null);

// One chat with its first reply; `refuse(type, payload)` answers a create command itself. `wrap` records what reaches the engine while `start()` is on.
async function chat(t, refuse) {
  const sent = [];
  let on = false;
  const wrap = (type, payload, options, real) => {
    if (on && CREATE_TYPES.includes(type)) sent.push({ type, payload: structuredClone(payload), options });
    return (on ? refuse?.(type, payload) : null) ?? real(type, payload, options);
  };
  const got = await page(t, { formula: 'standard', persona: 'Wessel', wrap });
  await begin(got.host);
  await settle();
  return { ...got, sent, wrap, start: () => { on = true; }, active: () => Object.keys(got.host.head().domains.dataModules?.active ?? {}).sort() };
}

async function newCreate(t, { prefill = null, edit = null, refuse = null } = {}) {
  const c = await chat(t, refuse);
  const real = (type, payload, options) => c.host.sdk.command(type, payload, options);
  const sdk = { ...c.host.sdk, command: (type, payload, options) => c.wrap(type, payload, options, real) };
  const world = createWizardWorld({ sdk, ctx: () => c.host.ctx });
  const wizard = createNewWizard({ world, command: (type, payload) => sdk.command(type, payload, { cause: 'ui' }), sheetCtx: () => ({ doc: c.doc, sheetHost: c.doc.body }) });
  assert.equal(wizard.open(prefill), true);
  edit?.(wizard.session());
  const sheet = c.doc.querySelector('.sh-ov[data-sheet="new-character"]');
  sheet.querySelector('.wz-steps button[data-value="review"]').click();
  c.start();
  sheet.querySelector('[data-wiz="create"]').click();
  await long();
  return { ...c, message: sheet.querySelector('.wz-status')?.textContent ?? '', wizard, sheet };
}

// What the earlier window sent for each case (captured from it; the hashes taken again when the bars moved to stat pairs, the only change in the payloads being the
// Character's HP and SP size rules and SP defaults): the command types, a hash of every payload and option in order, the blocks, the message.
const WANT = {
  fighter: { types: ['dm.define', 'dm.define', 'dm.define', 'dm.define'], hash: '9034fd37a77ca02a98e37ced83213b8d0f334e1c1eeb4a63156ad46ce474616f', active: ['pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/wessel', 'pack.chat/wessel-skills'], message: '' },
  mara: { types: ['dm.define', 'dm.define', 'dm.define', 'dm.define'], hash: '3583c059c5cd7d2af6812ff94360dc1e2148acb97f134954caf3ceb837081a95', active: ['pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/mara', 'pack.chat/mara-skills'], message: '' },
  imported: { types: ['dm.define', 'dm.define', 'dm.define', 'dm.define', 'inventory.add', 'inventory.add', 'wallet.set'], hash: 'dd6e8ffa4aec8b653374f772015d46f163fc59bddafa63e3d6cf4c3b7e5b753c', active: ['pack.chat/combat-rules', 'pack.chat/foes', 'pack.chat/wessel', 'pack.chat/wessel-skills'], message: '' },
  refused: { types: ['dm.define', 'dm.define', 'dm.remove'], hash: 'e9f166435a734074526b4a6fc61863d71c5fcb2b3a8decaba847bec7ede0830f', active: [], message: 'Could not make the skills: No room for it. Nothing was created.' },
};

async function same(t, options, want) {
  const after = await newCreate(t, options);
  assert.ok(after.sent.length >= 2, `the sheet sent its commands (${after.sent.length})`);
  assert.deepEqual(after.sent.map(entry => entry.type), want.types, 'the same commands in the same order');
  assert.equal(createHash('sha256').update(JSON.stringify(after.sent)).digest('hex'), want.hash, 'the same payloads and options');
  assert.ok(after.sent.every(entry => entry.options?.cause === 'ui'), 'sent as the reader\'s own');
  assert.deepEqual(after.active(), want.active, 'the same blocks');
  assert.equal(after.message, want.message, 'the same message');
  return { after };
}

test('a You from a starting set and spent points: Character, Skills, then the Combat rules and Foes blocks', { skip }, async t => {
  const { after } = await same(t, { edit: fighter }, WANT.fighter);
  assert.deepEqual(after.sent.map(entry => entry.type), ['dm.define', 'dm.define', 'dm.define', 'dm.define']);
  assert.equal(after.sent[1].payload.after, `pack.chat/${after.sent[0].payload.definition.slug}`);
  assert.equal(after.wizard.isOpen(), false, 'a clean Create closes the sheet');
});

test('Edit first: a joining companion, prefilled from the join card', { skip }, async t => {
  const { after } = await same(t, { prefill: { name: 'Mara', soul: 3, best: 'int' }, edit: run => { run.draft = withSet(run.draft, SKILL_SETS[1]); } }, WANT.mara);
  assert.equal(after.sent[0].payload.definition.name, 'Mara');
});

test('an imported file: the blocks, then each thing and the purse as more changes of the same reply', { skip }, async t => {
  const { after } = await same(t, { edit: imported }, WANT.imported);
  const types = after.sent.map(entry => entry.type);
  assert.deepEqual(types.filter(type => type !== 'dm.define'), ['inventory.add', 'inventory.add', 'wallet.set']);
});

test('the Skills define refused: the Character is taken back and the window says so', { skip }, async t => {
  const { after } = await same(t, { edit: fighter, refuse: refuseSkills }, WANT.refused);
  assert.deepEqual(after.sent.map(entry => entry.type), ['dm.define', 'dm.define', 'dm.remove']);
  assert.match(after.message, /Nothing was created/);
  assert.equal(after.wizard.isOpen(), true, 'the sheet stays open with the reason');
});
