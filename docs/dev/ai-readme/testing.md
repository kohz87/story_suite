## Testing a module

The testkit (`testkit/index.js`) is a fake SillyTavern and a whole host on it, wired the way `core/boot` wires the real one
(registry, settings, store, command bus, SDK, turn). Import it by relative path from a test; never copy it. Its entries:
`createHost` (`testkit/host.js`), `createFakeModel` (script the model), `createFakeContext`, `aiMessage`, `userMessage`.

`const host = await createHost({ modules: [def] })` gives `host.send(text, reply)` (the reader's message and the reply the
model writes), `host.swipe(reply)`, `host.regenerate`, `host.turn.reread(index)`, `host.st.deleteMessage(index)`,
`host.st.swipeTo(index, n)`, `host.store.rebuild()`, `host.sdk` (`command`, `query`), `host.head()` and `host.close()`.
Passing `st: { chat, extensionSettings }` from another host builds a reload.

A reply is its story, then the block: `` `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` ``.

**Replay == live, as a test.** Every module that writes state pins the same five events: after each, the state equals what
live play gave, and a rebuild from the receipts equals it too.

1. send two replies, note the state;
2. `host.store.rebuild()` and compare (replay);
3. build a second host from a copy of the chat (reload) and compare;
4. `host.swipe(...)` the head, check the state, then `host.st.swipeTo(...)` back and check it returns;
5. `host.st.deleteMessage(middle)` and `host.turn.reread(head)` (an edited Re-read), then compare with a rebuild.

`tests/modules/inventory/bag-slot.test.js` is a real one. The block below does it for the lantern, with oil amounts chosen so no command can refuse; it is run as a test:

```js test-example
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';   // the path depends on where the test sits: tests/modules/<name>/ needs ../../../
import { lantern } from './lantern.js';

const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;

test('lantern: replay equals live', async t => {
  const host = await createHost({ modules: [lantern] });
  t.after(() => host.close());
  const oil = () => host.sdk.query('lantern.oil');
  await host.send('Go on.', reply('Dark.', ['! lantern burn | amount: 1']));
  const middle = host.ctx.chat.length - 1;
  await host.send('Further.', reply('Darker.', ['! lantern burn | amount: 1']));
  assert.equal(oil(), 1);
  // replay: a rebuild from the receipts equals live
  host.store.rebuild();
  assert.equal(oil(), 1, 'a rebuild equals live');
  // reload: a second host on a copy of the chat
  const loaded = await createHost({ modules: [lantern], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
  t.after(() => loaded.close());
  assert.equal(loaded.sdk.query('lantern.oil'), 1, 'a reload equals live');
  // swipe, and back to the first try
  await host.swipe(reply('Darkest.', ['! lantern burn | amount: 2']));
  assert.equal(oil(), 0, 'the swipe replaced the first try');
  await host.st.swipeTo(host.ctx.chat.length - 1, 0);
  assert.equal(oil(), 1, 'back on the first swipe');
  // an edited Re-read of the head reply
  const head = host.ctx.chat.length - 1;
  host.ctx.chat[head].mes = reply('Darker, told again.', ['! lantern burn | amount: 2']);
  assert.equal((await host.turn.reread(head)).ok, true);
  assert.equal(oil(), 0);
  // a middle delete: the first reply's burn goes, the rest stays, and a rebuild agrees
  await host.st.deleteMessage(middle);
  assert.equal(oil(), 1);
  host.store.rebuild();
  assert.equal(oil(), 1, 'a rebuild equals live after the delete');
});
```

More helpers: `testkit/matrix/` (the combination matrix: every module with every other), `ui/port/fake-port.js` (a fake UI
port for view tests), `tests/ui/` and `tests/modules/*/helpers/`. Tests that touch a phone layout run in a real browser at
phone and desktop width; `docs/dev/release-walkthrough.md` is the hand walk before a release.

Where tests live: `tests/core`, `tests/ui`, `tests/modules/<module>`, `tests/people`, `tests/director`, `tests/suite`
(the whole-suite and prompt tests), `tests/scripts` (checks, code map, this file's generator). A test file is held to the same
rules as code (450 lines, one job).
