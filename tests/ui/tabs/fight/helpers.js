import { createPrefs } from '../../../../ui/runtime/prefs.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';
import { fightFixture } from '../../../../ui/fixtures/fight.js';

/** Builds a ctx with real prefs, a fake port that records commands, and a recorded go(). */
export function makeCtx() {
  const went = [];
  const port = createFakePort();
  return { port, went, prefs: createPrefs({ chatId: 't' }), go: tab => went.push(tab) };
}

export { fightFixture };
