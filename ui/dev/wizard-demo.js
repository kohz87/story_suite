// Dev harness only: `?wizard=who|stats|skills|review|hold|party` draws the New character sheet on that step (a You named Astra, the Fighter set
// for the later steps), the first-send hold, or the Party tab with nobody yet and its "Create your character", on the fake port (no engine).

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
  if (STEPS.includes(value)) {
    wizard.open();
    const run = wizard.session();
    run.draft = value === 'who' ? run.draft : { ...withSet({ ...newDraft({ persona: 'Astra' }) }, SKILL_SETS[0]), stats: { str: 9, vit: 8, agi: 6, dex: 6, int: 5, wis: 5, cha: 5 } };
    suite.root.querySelector(`.wz-steps button[data-value="${value}"]`)?.click();
  } else if (value === 'hold') {
    createSendHold({ doc, world: fakeWorld(), wizard, suite, sheetCtx }).show(MESSAGE);
  } else if (value === 'party') {
    const view = port.view.bind(port);
    port.view = (tab, args) => (tab === 'party' ? { pcId: null, max: 4, canInvite: false, members: [], characters: 0, newCharacter: true } : view(tab, args));
    suite.open('party');
  }
}
