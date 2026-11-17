// "Add to party" on the live mount (the new view on the old host, the real RPG module, RPG on, nobody in the party but You): the person page shows the button,
// the join card opens, and its own Add to party makes them a companion (dm.join, cause ui); a person page left open does not cover the suite opened again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage, settle } from './helpers/live-page.js';

// The party's Character blocks by who they are (a companion is made as the reader's own Add would: a Character block and its Skills).
const party = host => Object.values(host.head().domains.dataModules?.instances ?? {}).map(item => item?.chat?.fields?.who).filter(Boolean).sort();

async function withPeople(t) {
  const got = await livePage(t, { seed: 4601 });
  const { host } = got;
  const s = host.store.sourceAt(host.store.headIndex());
  const npcs = { npc_mara: { id: 'npc_mara', name: 'Mara', present: true, location: 'the gate' }, npc_roel: { id: 'npc_roel', name: 'Roel', lastSeenTurn: 1 } };
  const view = { v: 1, order: ['npc_mara', 'npc_roel'], npcs, candidates: [], dismissed: [], userDismissedGroups: [], turn: 2, socialGraph: { edges: [] }, portraitAssets: {} };
  assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: s.sid, swipeKey: s.swipeKey }, view })).ok, true);
  host.events.emit('head', { index: host.store.headIndex(), reason: 'people' });
  await settle();
  return got;
}

const open = async (doc, name) => {
  doc.querySelector('#story-suite-ui-menu')?.click();
  await settle();
  doc.querySelector('.su-strip .su-tab[data-tab="people"]').click();
  await settle();
  const card = doc.querySelectorAll('.su-panel .pc').find(el => el.textContent.includes(name));
  assert.ok(card, `${name}'s card`);
  card.click();
  await settle();
  return doc.querySelector('.dossier');
};

test('a person page on the live host has Add to party; the join card\'s Add to party puts them in the party', async t => {
  const { doc, host } = await withPeople(t);
  assert.deepEqual(party(host), ['Astra', 'Astra'], 'only You (a Character and its Skills)');
  const page = await open(doc, 'Mara');
  const button = page.querySelector('[data-act="party-add"]');
  assert.ok(button, 'the button shows (the RPG is on, room in the party, Mara not in it)');
  button.click();
  await settle();
  const acts = doc.querySelectorAll('.pa-acts button').map(b => b.dataset.act);
  assert.deepEqual(acts, ['add', 'edit', 'no'], 'the join card: Add to party, Edit first, Not now');
  assert.deepEqual(party(host), ['Astra', 'Astra'], 'the hero button only opens the card');
  doc.querySelector('.pa-acts button[data-act="add"]').click();
  for (let n = 0; n < 5; n += 1) await settle();
  assert.deepEqual(party(host), ['Astra', 'Astra', 'Mara', 'Mara'], 'the card\'s own button adds her (her Character and Skills)');
  assert.equal(host.sdk.query('rpg.partyAdd', { name: 'Mara' }), null, 'the engine offers her no more');
  assert.equal(doc.querySelector('.dossier [data-act="party-add"]'), null, 'and the page no longer offers it');
});

test('a person page left open is closed when the suite is opened again on a tab, so the card\'s Settings is the one that takes the click', async t => {
  const { doc } = await withPeople(t);
  await open(doc, 'Roel');
  doc.querySelector('.su-dim').click();
  assert.equal(doc.querySelector('.su-layer').getAttribute('data-state'), 'closed', 'the suite closed (a tap outside) with the page still open');
  assert.ok(doc.querySelector('.dossier'));
  doc.querySelector('#story-suite-ui-menu').click();
  await settle();
  assert.equal(doc.querySelector('.dossier'), null, 'the page went');
  assert.equal(doc.querySelector('.su-panel').getAttribute('data-tab'), 'now');
  assert.ok(doc.querySelector('.su-card-slot button[aria-label="Settings"]'), 'the new view\'s Settings on its card');
});
