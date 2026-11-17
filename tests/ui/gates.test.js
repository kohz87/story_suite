// A control whose command the live port cannot answer is not drawn (`port.can` says no); with `can` yes, or the fake port, it is drawn as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/ui-fake-dom.js';
import { createFakePort } from '../../ui/port/fake-port.js';
import { createBackStack } from '../../ui/runtime/back-stack.js';
import { createPrefs } from '../../ui/runtime/prefs.js';
import { dossierFor } from '../../ui/fixtures/dossier.js';
import { PEOPLE } from '../../ui/fixtures/people.js';
import { partyFixture } from '../../ui/fixtures/party.js';
import { bagFixture } from '../../ui/fixtures/bag.js';
import { buildJournal } from '../../ui/fixtures/journal.js';
import { buildStory } from '../../ui/fixtures/story.js';
import { MOMENT } from '../../ui/fixtures/moment.js';
import { fixture } from '../../ui/fixtures/index.js';
import { dossierPage } from '../../ui/tabs/people/dossier/dossier.js';
import { pastPage } from '../../ui/tabs/people/dossier/past-secrets.js';
import { deathPage } from '../../ui/tabs/people/dossier/death.js';
import { peopleTab } from '../../ui/tabs/people/people.js';
import { partyTab } from '../../ui/tabs/party/party.js';
import { memberSheet } from '../../ui/tabs/party/sheet.js';
import { skillsCard } from '../../ui/tabs/party/skills.js';
import { itemSheet } from '../../ui/tabs/bag/item-sheet.js';
import { questsCard } from '../../ui/tabs/journal/quests.js';
import { openQuestEditor } from '../../ui/tabs/journal/quest-editor.js';
import { directorCards } from '../../ui/tabs/story/director.js';
import { openSceneSheet } from '../../ui/sheets/scene-sheet.js';
import { characterCard } from '../../ui/card/character-card.js';
import { mountSuite } from '../../ui/mount.js';

// `answers`: the names `can` says yes to (none by default); the fake port itself says yes to everything.
function portOf(views, answers = []) {
  const port = createFakePort(views ? { views } : {});
  port.can = type => answers.includes(type);
  return port;
}
const ctxOf = (extra = {}, answers = []) => ({ port: portOf(extra.views, answers), prefs: createPrefs({ chatId: 'gates' }), backStack: createBackStack(), go() {}, ...extra });
const has = (el, selector) => el.querySelector(selector) !== null;

test('the dossier draws Edit and ⋯ only for commands that can be answered, and the menu lists only those', () => {
  installFakeDom();
  const none = dossierPage(dossierFor('temiwa'), ctxOf());
  assert.equal(has(none, '[data-act="edit"]'), false);
  assert.equal(has(none, '[data-act="menu"]'), false);
  const some = dossierPage(dossierFor('temiwa'), ctxOf({}, ['npc.refresh']));
  assert.equal(has(some, '[data-act="edit"]'), false);
  some.querySelector('[data-act="menu"]').click();
  assert.deepEqual(some.querySelectorAll('[role="menuitem"]').map(item => item.dataset.act), ['refresh']);
  const all = dossierPage(dossierFor('temiwa'), { ...ctxOf(), port: createFakePort() });
  assert.equal(has(all, '[data-act="edit"]'), true);
  all.querySelector('[data-act="menu"]').click();
  assert.equal(all.querySelectorAll('[role="menuitem"]').length, 5);
});

test('+ Add a memory, Mark alive and People + Add are left out without their commands', () => {
  installFakeDom();
  const d = dossierFor('temiwa');
  assert.equal(pastPage(d, ctxOf()).some(node => node?.textContent === '+ Add a memory'), false);
  assert.equal(pastPage(d, ctxOf({}, ['npc.memory.add'])).some(node => node?.textContent === '+ Add a memory'), true);
  assert.equal(deathPage(dossierFor('marro'), ctxOf()).some(node => node?.querySelector?.('[data-act="mark-alive"]')), false);
  assert.equal(deathPage(dossierFor('marro'), ctxOf({}, ['npc.markAlive'])).some(node => node?.querySelector?.('[data-act="mark-alive"]')), true);
  const people = fixture('default').people;
  assert.equal(peopleTab(people, ctxOf()).textContent.includes('+ Add'), false);
  assert.equal(peopleTab(people, ctxOf({}, ['npc.add'])).textContent.includes('+ Add'), true);
  assert.equal(peopleTab(people, { ...ctxOf(), port: createFakePort() }).textContent.includes('+ Add'), true);
});

test('Party: + Invite, skill Edit and the ⋯ menu need party.invite, rpg.skill.edit and party.bench / export / leave', () => {
  installFakeDom();
  const party = partyFixture({ members: 2 });
  const [first] = party.members;
  assert.equal(has(partyTab(party, ctxOf()), '.inv'), false);
  assert.equal(has(partyTab(party, ctxOf({}, ['party.invite'])), '.inv'), true);
  assert.equal(has(skillsCard(first, ctxOf()), '.edit'), false);
  assert.equal(has(skillsCard(first, ctxOf({}, ['rpg.skill.edit'])), '.edit'), true);
  assert.equal(has(memberSheet(first, ctxOf()), '.ibtn[data-more]'), false);
  assert.equal(has(memberSheet(first, ctxOf({}, ['party.leave'])), '.ibtn[data-more]'), true);
  assert.equal(has(memberSheet(first, ctxOf({}, ['rpg.stats.spend'])), '.ibtn[data-more]'), false);
});

test('Bag: Use on… needs item.use', () => {
  installFakeDom();
  const item = bagFixture({ rpg: true }).items.find(entry => entry.kind === 'use');
  const labels = el => el.querySelectorAll('button').map(button => button.textContent);
  assert.equal(labels(itemSheet(item, ctxOf({ rpg: true }))).includes('Use on…'), false);
  assert.equal(labels(itemSheet(item, ctxOf({ rpg: true }, ['item.use']))).includes('Use on…'), true);
});

test('Journal: the quest star, Edit and the editor\'s Save and ⋯ follow quest.focus, quest.edit, quest.giveup and quest.delete', () => {
  installFakeDom();
  const journal = buildJournal();
  const card = ctx => questsCard(journal, { ...ctx, command() {}, editQuest() {} });
  assert.equal(has(card(ctxOf()), '.fstar'), false);
  assert.equal(has(card(ctxOf()), '.qedit'), false);
  assert.equal(has(card(ctxOf({}, ['quest.focus'])), '.fstar'), true);
  assert.equal(has(card(ctxOf({}, ['quest.delete'])), '.qedit'), true);
  const sheetOf = answers => { installFakeDom(); openQuestEditor(ctxOf({}, answers), journal.quests[0]); return globalThis.document.body; };
  assert.equal(has(sheetOf([]), '.qsheet .save'), false);
  assert.equal(has(sheetOf([]), '.qsheet .qmore-btn'), false);
  assert.equal(has(sheetOf(['quest.edit']), '.qsheet .save'), true);
  assert.equal(has(sheetOf(['quest.giveup']), '.qsheet .giveup'), true);
  assert.equal(has(sheetOf(['quest.giveup']), '.qsheet .delete'), false);
});

test('Story: Plan the next arc needs arc.plan; Quiet scene and End this arc stay', () => {
  installFakeDom();
  const arc = ctx => directorCards(buildStory({ planShown: true }), ctx).find(card => card.dataset.card === 'arc');
  assert.equal(has(arc(ctxOf({ command() {} })), '[data-act="arc-plan"]'), false);
  assert.equal(has(arc(ctxOf({ command() {} }, ['arc.plan'])), '[data-act="arc-plan"]'), true);
  assert.equal(has(arc(ctxOf({ command() {} })), '[data-act="arc-end"]'), true);
});

test('the Scene sheet draws Save only with scene.correct', () => {
  installFakeDom();
  const save = answers => { installFakeDom(); openSceneSheet(ctxOf({}, answers), MOMENT.scene, []); return globalThis.document.body; };
  assert.equal(has(save([]), '.scsheet .save'), false);
  assert.equal(has(save(['scene.correct']), '.scsheet .save'), true);
});

test('the card\'s ‹ Chat calls the same close the mini bar uses, and sends no command', () => {
  installFakeDom();
  const closed = [];
  const el = characterCard(fixture('default').card, { onBack: () => closed.push('chat') });
  el.querySelector('.bk').click();
  assert.deepEqual(closed, ['chat']);
});

test('on the mounted suite, the card\'s ‹ Chat closes the suite like the mini bar, with no command sent', () => {
  const doc = installFakeDom();
  const port = createFakePort();
  const suite = mountSuite({ port, doc });
  const layer = doc.body.querySelector('.su-layer');
  suite.open();
  assert.equal(layer.getAttribute('data-state'), 'open');
  doc.body.querySelector('[data-card="character"] .bk').click();
  assert.equal(layer.getAttribute('data-state'), 'closed');
  assert.equal(port.recorded.some(entry => entry.type === 'suite.close'), false);
  suite.destroy();
});
