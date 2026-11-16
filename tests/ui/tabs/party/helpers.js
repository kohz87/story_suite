import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { partyFixture } from '../../../../ui/fixtures/party.js';
import { BAG } from '../../../../ui/fixtures/bag.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';
import { createBackStack } from '../../../../ui/runtime/back-stack.js';

/** Installs a fresh fake DOM and returns a ctx with a fake port serving party and bag, a back-stack and a recorded go(). */
export function makeCtx({ members = 4 } = {}) {
  installFakeDom();
  const party = partyFixture({ members });
  const port = createFakePort({ views: { party, bag: structuredClone(BAG) } });
  const went = [];
  return { party, port, backStack: createBackStack(), went, go: tab => went.push(tab) };
}

export const flush = () => new Promise(resolve => setImmediate(resolve));
export const commands = port => port.recorded.filter(r => r.kind === 'command').map(r => [r.type, r.payload]);
export const sheetEl = () => globalThis.document.body.querySelector('.pty-ov');
