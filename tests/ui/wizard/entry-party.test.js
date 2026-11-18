// Entries 2 and 3 on the live mount: the Party tab's "Create your character" / "+ New character" (shown while the story has no You) and
// People › Add to party › Edit first (port.open('story-block/new-character', payload)) open the new view's wizard, never the old dialog.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostAvailable } from '../../../testkit/index.js';
import { GEAR_FEATURE } from '../../../core/features.js';
import { wizardPage, settleLong, click, party } from './page.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const tabs = doc => doc.querySelectorAll('.su-strip .su-tab').map(b => b.dataset.tab);

async function partyTab(p) {
  p.doc.querySelector('#story-suite-ui-menu').click();
  await settleLong();
  p.doc.querySelector('.su-strip .su-tab[data-tab="party"]').click();
  await settleLong();
  return p.doc.querySelector('.su-panel .party-tab');
}

async function createFromSheet(p) {
  const sheet = p.sheet();
  click(sheet, '.wz-steps button[data-value="review"]');
  click(sheet, '[data-wiz="create"]');
  await settleLong();
}

test('the Party tab shows with the RPG on and nobody yet; "Create your character" opens the new wizard, and once You exist the button goes', { skip }, async t => {
  const p = await wizardPage(t);
  p.host.features.set(GEAR_FEATURE, true);
  const tab = await partyTab(p);
  assert.ok(tabs(p.doc).includes('party'), 'the tab shows for a story with no character (owner 17 Nov 10:30)');
  assert.equal(tab.querySelector('.mem-empty').textContent, 'No characters yet.');
  const button = tab.querySelector('[data-act="new-character"]');
  assert.equal(button.textContent, 'Create your character');
  button.click();
  await settleLong();
  assert.ok(p.sheet(), 'the new wizard');
  await createFromSheet(p);
  assert.deepEqual(party(p.host), ['Wessel', 'Wessel']);
  const after = p.doc.querySelector('.su-panel .party-tab');
  assert.equal(after.querySelector('[data-act="new-character"]'), null, 'the story has You: no New character');
  assert.ok(after.querySelector('.mb[data-member]'), 'Wessel in the portrait row');
});

test('with Gear in fights off the roster lists nobody: once You exist the tab goes, as on main; before, it is there for the button', { skip }, async t => {
  const p = await wizardPage(t);
  await partyTab(p);
  assert.ok(tabs(p.doc).includes('party'));
  p.doc.querySelector('.su-panel [data-act="new-character"]').click();
  await settleLong();
  await createFromSheet(p);
  assert.deepEqual(party(p.host), ['Wessel', 'Wessel']);
  assert.equal(tabs(p.doc).includes('party'), false, 'no Party tab showing "not built yet"');
});

test('with the RPG off there is no Party tab and no button', { skip }, async t => {
  const p = await wizardPage(t, { feature: false });
  p.doc.querySelector('#story-suite-ui-menu').click();
  await settleLong();
  assert.equal(tabs(p.doc).includes('party'), false);
});

test('a second open while one is up opens nothing more, and never the old dialog', { skip }, async t => {
  const p = await wizardPage(t);
  const tab = await partyTab(p);
  tab.querySelector('[data-act="new-character"]').click();
  await settleLong();
  tab.querySelector('[data-act="new-character"]').click();
  await settleLong();
  assert.equal(p.doc.querySelectorAll('.sh-ov[data-sheet="new-character"]').length, 1);
});

// People › a person › Add to party › Edit first, on a story that has You (made with the new wizard) and two people.
async function withPeople(t) {
  const p = await wizardPage(t);
  await partyTab(p);
  p.doc.querySelector('.su-panel [data-act="new-character"]').click();
  await settleLong();
  await createFromSheet(p);
  const { host } = p;
  const s = host.store.sourceAt(host.store.headIndex());
  const npcs = { npc_mara: { id: 'npc_mara', name: 'Mara', present: true, location: 'the gate' } };
  const view = { v: 1, order: ['npc_mara'], npcs, candidates: [], dismissed: [], userDismissedGroups: [], turn: 2, socialGraph: { edges: [] }, portraitAssets: {} };
  assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: s.sid, swipeKey: s.swipeKey }, view })).ok, true);
  host.events.emit('head', { index: host.store.headIndex(), reason: 'people' });
  await settleLong();
  p.doc.querySelector('.su-strip .su-tab[data-tab="people"]').click();
  await settleLong();
  p.doc.querySelectorAll('.su-panel .pc').find(el => el.textContent.includes('Mara')).click();
  await settleLong();
  p.doc.querySelector('.dossier [data-act="party-add"]').click();
  await settleLong();
  return p;
}

test('Edit first opens the new wizard filled in for that person (a companion), never the old dialog; Create makes her and closes the card', { skip }, async t => {
  const p = await withPeople(t);
  click(p.doc, '.pa-acts button[data-act="edit"]');
  await settleLong();
  const sheet = p.sheet();
  assert.ok(sheet, 'the new wizard');
  assert.equal(sheet.querySelector('[data-wiz="name"]').value, 'Mara', 'prefilled from the join payload');
  assert.match(sheet.querySelector('.wz-sum').textContent, /Companion/);
  assert.equal(p.doc.querySelector('.pa-acts'), null, 'the join card closed when the window opened');
  await createFromSheet(p);
  assert.equal(p.sheet(), null);
  assert.deepEqual(party(p.host), ['Mara', 'Mara', 'Wessel', 'Wessel']);
});

test('a window this view does not draw still goes to the page event (the old host answers it until B4-4)', { skip }, async t => {
  const p = await wizardPage(t);
  const heard = [];
  p.doc.addEventListener('story-suite:open', event => { heard.push(event.type); });
  const { createSbPort } = await import('../../../ui/port/sb-port.js');
  const port = createSbPort({ sdk: p.host.sdk, screens: { open: () => false } });
  assert.equal((await port.open('story-block/other', null)).ok, false, 'nobody drew it');
  assert.deepEqual(heard, ['story-suite:open']);
});
