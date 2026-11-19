// Soak findings drawn in the dossier: own feelings and stage words on the With page (F21, F25), no empty Right now card (F14), the gender flag once (F8), Wants alone (F16), Delete/Edit answers (F27).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/dom.js';
import { createBackStack } from '../../../../../ui/runtime/back-stack.js';
import { dossierPage, dossierPages } from '../../../../../ui/tabs/people/dossier/dossier.js';
import { withPage } from '../../../../../ui/tabs/people/dossier/feelings.js';
import { nowPage } from '../../../../../ui/tabs/people/dossier/now-page.js';
import { dossier, makeCtx } from './helpers.js';

test('F21/F25: the With page lists the reader\'s own feeling on its own range, and a stage word under the feeling that has one', () => {
  installFakeDom();
  const d = { ...dossier('temiwa'), axisStages: { trust: 'Trusted ally' }, extraMeters: [{ key: 'respect', label: 'Respect', value: 25, min: 0, max: 100, stage: 'Respected' }] };
  const rows = withPage(d)[1].querySelectorAll('.mrow');
  assert.deepEqual(rows.map(r => r.dataset.meter), ['trust', 'affection', 'desire', 'tension', 'respect']);
  assert.match(rows[0].textContent, /Trust.*Trusted ally/);
  assert.match(rows[4].textContent, /Respect.*Respected.*25/);
  assert.equal(withPage(dossier('temiwa'))[1].querySelectorAll('.mrow').length, 4, 'nothing extra without them');
});

test('F14: no Right now card or page for someone with no place, doing or scene; with any of them it stays', () => {
  const empty = { ...dossier('temiwa'), scene: null, now: { where: null, doing: null, wearing: null, thought: null } };
  assert.equal(dossierPages(empty).some(p => p.id === 'now'), false);
  assert.equal(dossierPages({ ...empty, now: { lastPlace: null, lastSeen: null, said: null } }).some(p => p.id === 'now'), false);
  assert.equal(dossierPages({ ...empty, now: { ...empty.now, doing: 'watching the inn' } }).some(p => p.id === 'now'), true);
  assert.equal(dossierPages({ ...empty, scene: { wants: 'x', hiding: null } }).some(p => p.id === 'now'), true);
});

test('F8: an unstated gender is flagged once under the name; an empty line is not led by a dot', () => {
  installFakeDom();
  const hero = d => dossierPage(d, makeCtx({ backStack: createBackStack() })).querySelector('.idl');
  const line = hero({ ...dossier('temiwa'), idLine: 'Human · 41', genderUnknown: true });
  assert.equal(line.textContent, 'Human · 41 · gender not stated');
  assert.equal(hero({ ...dossier('temiwa'), idLine: '', genderUnknown: true }).textContent, 'gender not stated');
});

test('F16: Wants shows alone when there is no Hiding secret', () => {
  installFakeDom();
  const page = nowPage({ ...dossier('temiwa'), scene: { wants: 'catch the Grey Ledger', hiding: null } }, makeCtx());
  const labels = page.querySelectorAll('.scene-rows dt').map(n => n.textContent);
  assert.deepEqual(labels, ['Wants']);
});

test('F27: Delete closes the dossier once the engine says yes; a refusal is told under the top bar', async () => {
  installFakeDom();
  const run = async (answer) => {
    const closed = [];
    const port = { can: () => true, command: async (type) => (type === 'npc.delete' ? answer : { ok: true }) };
    const el = dossierPage(dossier('temiwa'), makeCtx({ port, backStack: createBackStack(), onClose: () => closed.push(1) }));
    el.querySelector('[data-act="menu"]').click();
    el.querySelector('.menu [data-act="delete"]').click();
    el.querySelector('.menu [data-act="delete"]').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    return { closed, note: el.querySelector('.dnote').textContent };
  };
  assert.equal((await run({ ok: true })).closed.length, 1);
  const refused = await run({ ok: false, message: 'They may already be gone.' });
  assert.equal(refused.closed.length, 0);
  assert.equal(refused.note, 'They may already be gone.');
});

test('SFU2: Ties and Past always pair for the living (an empty Ties card says so); a Right now card with only a thought or wearing has a line', () => {
  installFakeDom();
  const root = d => dossierPage(d, makeCtx({ backStack: createBackStack() }));
  const base = { ...dossier('temiwa'), now: { where: 'the inn', doing: null, wearing: 'a grey cloak', thought: null } };
  const withTies = root(base);
  assert.equal(withTies.querySelectorAll('.dpair').length, 1);
  const alone = root({ ...base, ties: [] });
  assert.equal(alone.querySelectorAll('.dpair').length, 1, 'the empty Ties card keeps the pair');
  assert.ok(alone.querySelector('[data-page="past"]'));
  assert.match(alone.querySelector('[data-page="now"]').textContent, /the inn · wearing a grey cloak/);
  const onlyWearing = root({ ...base, now: { where: null, doing: null, wearing: 'a grey cloak', thought: null } });
  assert.match(onlyWearing.querySelector('[data-page="now"] .lc').textContent, /wearing a grey cloak/);
});
