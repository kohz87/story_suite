// "Add to party" on a person's page: the button only when the view-model carries a join card; the card's Add sends dm.join with cause 'ui', Edit first opens the window, Not now sends nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { dossierPage } from '../../../../../ui/tabs/people/dossier/dossier.js';
import { partyAddButton, openJoinCard } from '../../../../../ui/tabs/people/dossier/party-add.js';
import { dossier, makeCtx } from './helpers.js';

const sheetOf = () => globalThis.document.querySelector('[data-sheet="party-add"]');
const act = (root, name) => root.querySelector(`[data-act="${name}"]`);

test('the button shows on the page of someone who may join, and not for a member or the dead', () => {
  installFakeDom();
  assert.ok(act(dossierPage(dossier('temiwa'), makeCtx()), 'party-add'), 'temiwa: not in the party');
  assert.equal(act(dossierPage(dossier('torka'), makeCtx()), 'party-add'), null, 'torka: in the party');
  assert.equal(act(dossierPage(dossier('marro'), makeCtx()), 'party-add'), null, 'marro: dead');
  assert.equal(partyAddButton({ partyAdd: null }, makeCtx()), null);
});

test('Add to party opens the join card; its Add sends dm.join with the card payload as the reader (cause ui) and closes', async () => {
  installFakeDom();
  const ctx = makeCtx(), d = dossier('temiwa');
  partyAddButton(d, ctx).click();
  const sheet = sheetOf();
  assert.ok(sheet);
  assert.equal(sheet.querySelector('h3').textContent, `${d.name} joins the party`);
  assert.deepEqual(sheet.querySelectorAll('button').map(n => n.textContent.trim()).filter(t => t && t !== '×'), ['Add to party', 'Edit first', 'Not now']);
  act(sheet, 'add').click();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(ctx.port.recorded.map(e => [e.type, e.payload, e.options]), [['dm.join', { name: d.name, soul: 1, best: '' }, { cause: 'ui' }]]);
  assert.equal(sheetOf(), null, 'closed after the add');
});

test('Edit first asks the port to open the New character window with the payload; Not now sends nothing and answers no offer', async () => {
  installFakeDom();
  const ctx = makeCtx(), d = dossier('temiwa');
  openJoinCard(d.partyAdd, ctx);
  act(sheetOf(), 'edit').click();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(ctx.port.recorded.map(e => [e.kind, e.id, e.payload]), [['open', 'story-block/new-character', { name: d.name, soul: 1, best: '' }]]);
  assert.equal(sheetOf(), null);
  ctx.port.clearRecorded();
  openJoinCard(d.partyAdd, ctx);
  act(sheetOf(), 'no').click();
  assert.deepEqual(ctx.port.recorded, [], 'no rpg.joinNo: it would decline a real story offer on the reply');
  assert.equal(sheetOf(), null);
});

test('a refused add keeps the card open and says why', async () => {
  installFakeDom();
  const ctx = makeCtx({ port: { command: async () => ({ ok: false, message: 'the party is full' }) } });
  openJoinCard(dossier('temiwa').partyAdd, ctx);
  act(sheetOf(), 'add').click();
  await new Promise(r => setTimeout(r, 0));
  assert.ok(sheetOf());
  assert.equal(sheetOf().querySelector('.pa-note').textContent, 'the party is full');
});

test('a taken add redraws the page (no button, "in your party") and a double tap sends one command', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const root = dossierPage(dossier('temiwa'), ctx);
  act(root, 'party-add').click();
  const add = act(sheetOf(), 'add');
  add.click();
  add.click();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(ctx.port.recorded.filter(e => e.type === 'dm.join').length, 1, 'one command for a double tap');
  assert.equal(act(root, 'party-add'), null, 'the button is gone');
  assert.match(root.querySelector('.dhero').textContent, /in your party/);
});
