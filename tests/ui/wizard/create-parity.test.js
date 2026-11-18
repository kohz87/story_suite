// The new view's Create sends what the old wizard's Create sends: the same commands, payloads and order, both with `{ cause: 'ui' }`. Each case runs the old
// window (the old host's dialog, still on the page until B4-4) and the new sheet (ui/wizard) on two fresh chats with the same draft, and compares
// what reached the engine and which blocks the story holds after.
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

async function oldCreate(t, { prefill = null, edit = null, refuse = null } = {}) {
  const c = await chat(t, refuse);
  c.rpg().wizard.open(prefill);
  await settle();
  const dialog = c.ui.mounts.dialog.current();
  edit?.(c.rpg().wizard.session());
  dialog.goTo(3);
  await settle();
  c.start();
  dialog.root.querySelector('.rpg-wiz-create').click();
  await long();
  return { ...c, message: dialog.root.querySelector('.rpg-wiz-status')?.textContent ?? '' };
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

async function same(t, options) {
  const before = await oldCreate(t, options);
  const after = await newCreate(t, options);
  assert.ok(before.sent.length >= 2, `the old window sent its commands (${before.sent.length})`);
  assert.deepEqual(after.sent, before.sent, 'the same commands, payloads and order');
  assert.ok(after.sent.every(entry => entry.options?.cause === 'ui'), 'sent as the reader\'s own, as the old window');
  assert.deepEqual(after.active(), before.active(), 'the same blocks');
  return { before, after };
}

test('a You from a starting set and spent points: Character, Skills, then the Combat rules and Foes blocks', { skip }, async t => {
  const { after } = await same(t, { edit: fighter });
  assert.deepEqual(after.sent.map(entry => entry.type), ['dm.define', 'dm.define', 'dm.define', 'dm.define']);
  assert.equal(after.sent[1].payload.after, `pack.chat/${after.sent[0].payload.definition.slug}`);
  assert.equal(after.wizard.isOpen(), false, 'a clean Create closes the sheet');
});

test('Edit first: a joining companion, prefilled from the join card', { skip }, async t => {
  const { after } = await same(t, { prefill: { name: 'Mara', soul: 3, best: 'int' }, edit: run => { run.draft = withSet(run.draft, SKILL_SETS[1]); } });
  assert.equal(after.sent[0].payload.definition.name, 'Mara');
});

test('an imported file: the blocks, then each thing and the purse as more changes of the same reply', { skip }, async t => {
  const { after } = await same(t, { edit: imported });
  const types = after.sent.map(entry => entry.type);
  assert.deepEqual(types.filter(type => type !== 'dm.define'), ['inventory.add', 'inventory.add', 'wallet.set']);
});

test('the Skills define refused: the Character is taken back and the window says so', { skip }, async t => {
  const { before, after } = await same(t, { edit: fighter, refuse: refuseSkills });
  assert.deepEqual(after.sent.map(entry => entry.type), ['dm.define', 'dm.define', 'dm.remove']);
  assert.equal(after.message, before.message);
  assert.match(after.message, /Nothing was created/);
  assert.equal(after.wizard.isOpen(), true, 'the sheet stays open with the reason');
});
