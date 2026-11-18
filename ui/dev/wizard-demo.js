// Dev harness only: `?wizard=who|stats|skills|review|problems|done|hold|party` draws the New character sheet on that step (a You named Astra, the
// Fighter set for the later steps; `problems`: Review with no name; `done`: the "made, but not …" end), the first-send hold, or the Party tab with
// nobody yet and its "Create your character", on the fake port (no engine).

import { SKILL_SETS } from '../../modules/rpg/templates.js';
import { newDraft, withSet } from '../../modules/rpg/view/wizard-data.js';
import { createNewWizard } from '../wizard/wizard.js';
import { createSendHold } from '../wizard/hold.js';

const STEPS = ['who', 'stats', 'skills', 'review'];
const MESSAGE = 'I step off the barge and look for the harbour master.';

// What the wizard reads, made up: an empty story with room, Astra as the persona, the stock numbers.
const fakeWorld = () => ({
  headState: () => ({}), readerName: () => 'Astra', rules: () => null, packNote: () => '', levels: () => ({ ranks: [] }), levelCap: () => 99, chatId: () => 'demo',
  rpgOn: () => true, hasYou: () => false, query: () => null,
  world: () => ({ persona: 'Astra', names: [], hasYou: false, full: false, room: true, free: 32, extras: { add: ['rules', 'foes'], skipped: [] }, used: [] }),
});

/** Draws what `value` names over the mounted `suite` (mountSuite's handle) with `port` (the fake one). Unknown values draw nothing. */
export function wizardDemo(value, { doc, suite, port }) {
  if (!value) return;
  const sheetCtx = () => ({ doc, backStack: suite.backStack, sheetHost: suite.root });
  const wizard = createNewWizard({ world: fakeWorld(), command: async () => ({ ok: true }), sheetCtx });
  if (STEPS.includes(value) || value === 'problems' || value === 'done') {
    wizard.open();
    const run = wizard.session();
    run.draft = value === 'who' ? run.draft : { ...withSet({ ...newDraft({ persona: 'Astra' }) }, SKILL_SETS[0]), stats: { str: 9, vit: 8, agi: 6, dex: 6, int: 5, wis: 5, cha: 5 } };
    if (value === 'problems') run.draft = { ...run.draft, name: '' };
    if (value === 'done') run.finished = 'Astra is in the party. Not added: Foes. This reply has no block actions left for it. Settings → Blocks adds it later, and Settings → RPG adds the Combat rules block.';
    suite.root.querySelector(`.wz-steps button[data-value="${STEPS.includes(value) ? value : 'review'}"]`)?.click();
  } else if (value === 'hold') {
    createSendHold({ doc, world: fakeWorld(), wizard, suite, sheetCtx }).show(MESSAGE);
  } else if (value === 'party') {
    const view = port.view.bind(port);
    port.view = (tab, args) => (tab === 'party' ? { pcId: null, max: 4, canInvite: false, members: [], characters: 0, newCharacter: true } : view(tab, args));
    suite.open('party');
  }
}
