// ST-LINK: the Packs page carries an "Open Studio" link that opens the Studio page (studio/index.html in the extension folder) in a new tab, on the format 3 page and on the format 4 page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './sections/mount.js';
import { store, world, packsView } from './packs-v4-helpers.js';

const studio = new URL('../../../studio/index.html', import.meta.url).href;
const links = el => el.querySelectorAll('a').filter(a => a.textContent === 'Open Studio');

test('the format 3 page has one Open Studio link to studio/index.html, in a new tab', () => {
  const { page } = mountSettings({}, { onView: name => (name === 'settings' ? { packs: { packs: [], modules: [], trackers: { cap: 28, items: [] } } } : null) });
  const found = links(page('packs'));
  assert.equal(found.length, 1);
  assert.equal(found[0].getAttribute('href'), studio);
  assert.equal(found[0].getAttribute('target'), '_blank');
  assert.match(found[0].getAttribute('rel'), /noopener/);
});

test('the format 4 page has the same link', async () => {
  const view = packsView(await store(world()));
  const { page } = mountSettings({}, { onView: name => (name === 'settings' ? { packs: view } : null) });
  const found = links(page('packs'));
  assert.equal(found.length, 1);
  assert.equal(found[0].getAttribute('href'), studio);
});
