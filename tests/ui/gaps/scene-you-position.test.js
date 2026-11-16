// G4 contract: a real Story Block host answers scene.you.position; the port + Now selector hand it to the Now tab; the feature off hides the card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { YOU_FEATURE } from '../../../modules/scene/index.js';
import { checkPort } from '../../../ui/port/contract.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { createFakePort } from '../../../ui/port/fake-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { NOW_SHAPE } from '../../../ui/contract/now.js';

const block = (story, lines) => `${story}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;

async function hostWith(t, lines) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost();
  t.after(() => host.close());
  await host.send('Hello.', block('The road to the harbour.', ['~ place Vell Harbour | kind: settlement', ...lines]));
  return host;
}
const portOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk) });

test('a position the story wrote reaches the Now You card through the real port, in the NOW_SHAPE', async t => {
  const host = await hostWith(t, ['~ you wearing: oilskin coat | condition: tired | position: kneeling by the fire']);
  const port = portOf(host);
  assert.equal(checkPort(port).ok, true);
  assert.equal(host.sdk.query('scene.you').position, 'kneeling by the fire');
  const now = port.view('now');
  assert.deepEqual(checkShape(now, NOW_SHAPE), []);
  assert.deepEqual(now.you, { look: 'oilskin coat', position: 'kneeling by the fire', condition: 'tired' });
  // The fake port serves the same shape, so both ports agree.
  const fake = createFakePort({ views: { now } });
  assert.equal(checkPort(fake).ok, true);
  assert.deepEqual(checkShape(fake.view('now'), NOW_SHAPE), []);
});

test('no position written: the answer is null and the You card shows no position', async t => {
  const host = await hostWith(t, ['~ you wearing: oilskin coat | condition: tired']);
  assert.equal('position' in host.sdk.query('scene.you'), false);
  const now = portOf(host).view('now');
  assert.deepEqual(checkShape(now, NOW_SHAPE), []);
  assert.equal(now.you.position, null);
});

test('a reader command sets and clears the position', async t => {
  const host = await hostWith(t, ['~ you wearing: a coat']);
  assert.equal((await host.sdk.command('scene.you', { position: 'riding' })).ok, true);
  assert.equal(host.sdk.query('scene.you').position, 'riding');
  assert.equal((await host.sdk.command('scene.you', { position: '' })).ok, true);
  assert.equal('position' in host.sdk.query('scene.you'), false);
});

test('feature off: scene.you answers null and the You card hides', async t => {
  const host = await hostWith(t, ['~ you position: in bed']);
  host.features.set(YOU_FEATURE, false);
  assert.equal(host.sdk.query('scene.you'), null);
  const now = portOf(host).view('now');
  assert.deepEqual(checkShape(now, NOW_SHAPE), []);
  assert.deepEqual(now.you, { look: null, position: null, condition: null });
});
