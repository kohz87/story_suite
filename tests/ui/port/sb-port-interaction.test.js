// The Scene tab's own step, sent through the Story Block port to the real interaction sdk with the probe kind, then read back as a scene.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteractionApi } from '../../../core/sdk/interaction.js';
import { PROBE_ID, probeRegistry } from '../../core/interaction/helpers/probe-kind.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SCENE_SHAPE } from '../../../ui/contract/interaction.js';
import { installFakeDom } from '../helpers/dom.js';
import { sceneTab } from '../../../ui/tabs/scene/host.js';

function wired() {
  const meta = {};
  const interaction = createInteractionApi({
    registry: probeRegistry(), meta: () => meta, chat: () => [], state: () => ({ room: 1 }), head: () => ({ sid: 'reply-1' }), persona: 'Astra',
  });
  const sdk = { interaction, query: name => (name === 'interaction.view' ? interaction.current() : null) };
  const port = createSbPort({ sdk, selectors: buildSelectors(() => null, sdk) });
  return { port, interaction };
}

test('the generic renderer\'s step is accepted by the real engine, and the scene reads it back', async () => {
  installFakeDom();
  const { port } = wired();
  assert.equal(port.view('scene'), null);
  assert.equal((await port.command('interaction.open', { kindId: PROBE_ID })).ok, true);
  const first = port.view('scene');
  assert.deepEqual(checkShape(first, SCENE_SHAPE), []);
  assert.equal(first.state, 'open');
  const tab = sceneTab(first, { port });
  tab.querySelector('.scene-choice-list button').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  const after = port.view('scene');
  assert.deepEqual(checkShape(after, SCENE_SHAPE), []);
  assert.equal(after.steps, 1);
  assert.equal(after.state, 'staged');
  assert.equal(tab.querySelector('.scene-note').hidden, true);
  assert.equal((await port.command('interaction.discard', { id: after.id })).ok, true);
  assert.equal(port.view('scene'), null);
});
