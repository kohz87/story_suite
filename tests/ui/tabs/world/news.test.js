import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { worldFor } from '../../../../ui/fixtures/world.js';
import { newsCard, heardLine } from '../../../../ui/tabs/world/news.js';

function setup(state = { filter: 'all' }) {
  const w = worldFor();
  const log = { goto: [], views: [], edits: [] };
  const act = {
    placeName: id => w.places.find(p => p.id === id)?.name ?? null,
    factionName: id => w.factions.find(f => f.id === id)?.name ?? null,
    gotoPlace: id => log.goto.push(id), setView: v => log.views.push(v), edit: t => log.edits.push(t),
  };
  return { card: newsCard(w.news, state, act), log, state, w };
}
const titles = card => card.querySelectorAll('.ev .eh b').map(b => b.textContent);

test('heardLine: single, repeated, you-were-there and empty', () => {
  assert.equal(heardLine([{ where: 'in Bluewatch', when: 'this morning', from: 'Oyla' }]), 'heard in Bluewatch, this morning · from Oyla');
  assert.equal(heardLine([{ where: 'a', when: 'b', from: 'x' }, { where: 'in Bluewatch', when: 'this morning', from: 'Oyla, at the guild desk' }]),
    'last news: heard in Bluewatch, this morning · from Oyla, at the guild desk');
  assert.equal(heardLine([{ where: 'at the toll gate', when: 'Goldwane 12', from: null }]), 'heard at the toll gate, Goldwane 12 · you were there');
  assert.equal(heardLine([]), '');
  assert.equal(heardLine(), '');
});

test('news card lists all six events with state words, filter counts and the Director note', () => {
  installFakeDom();
  const { card } = setup();
  assert.equal(card.dataset.card, 'news');
  assert.equal(titles(card).length, 6);
  assert.deepEqual(card.querySelectorAll('.st').map(s => s.textContent), ['looming', 'ongoing', 'looming', 'looming', 'rumour', 'resolved']);
  assert.deepEqual(card.querySelectorAll('.fil button').map(b => b.dataset.nf), ['all', 'looming', 'ongoing', 'rumour', 'resolved']);
  assert.deepEqual(card.querySelectorAll('.fil button small').map(s => s.textContent), ['6', '3', '1', '1', '1']);
  assert.equal(card.querySelector('.cnt').textContent, 'what you have heard');
  assert.match(card.querySelector('.fine').textContent, /Story › Director/);
});

test('filter chips narrow the list in place and mark the pressed chip', () => {
  installFakeDom();
  const { card, state } = setup();
  const list = card.querySelector('.evlist');
  card.querySelector('[data-nf="looming"]').click();
  assert.equal(state.filter, 'looming');
  assert.equal(card.querySelector('.evlist'), list);
  assert.deepEqual(titles(card), ['Bandit tolls on the Auvoth road', 'Grain toll in Thousand Sails', 'Harvest fair at Auvoth']);
  assert.equal(card.querySelector('[data-nf="looming"]').getAttribute('aria-pressed'), 'true');
  assert.equal(card.querySelector('[data-nf="all"]').getAttribute('aria-pressed'), 'false');
  card.querySelector('[data-nf="resolved"]').click();
  assert.deepEqual(titles(card), ['The toll keeper killed']);
  card.querySelector('[data-nf="all"]').click();
  assert.equal(titles(card).length, 6);
});

test('the chosen filter survives a rebuild through state', () => {
  installFakeDom();
  const { card } = setup({ filter: 'rumour' });
  assert.deepEqual(titles(card), ['A boatman gone missing']);
  assert.equal(card.querySelector('[data-nf="rumour"]').getAttribute('aria-pressed'), 'true');
});

test('each event shows its summary, heard line, place link and faction link', () => {
  installFakeDom();
  const { card } = setup();
  const raids = card.querySelectorAll('.ev')[1];
  assert.equal(raids.dataset.event, 'frontier-raids');
  assert.equal(raids.querySelector('p').textContent.startsWith('A caravan burned'), true);
  const meta = raids.querySelector('.meta2').textContent;
  assert.match(meta, /📍 Wolfmere Outpost/);
  assert.match(meta, /⚑ Bluewatch Guild/);
  assert.match(meta, /last news: heard in Bluewatch, this morning · from Oyla, at the guild desk/);
  assert.match(meta, /first heard Goldwane 12/);
  const harvest = card.querySelectorAll('.ev')[3];
  assert.equal(harvest.textContent.includes('⚑'), false);
  const keeper = card.querySelectorAll('.ev')[5];
  assert.equal(keeper.textContent.includes('📍'), false);
  assert.match(keeper.textContent, /you were there/);
});

test('place, faction and Edit links call back and keep the page from navigating', () => {
  installFakeDom();
  const { card, log } = setup();
  const ev = card.querySelectorAll('.ev')[0];
  const place = ev.querySelector('[data-goto="auvoth"]');
  const e = place.dispatch('click');
  assert.equal(e.defaultPrevented, true);
  ev.querySelector('[data-wf="factions"]').click();
  ev.querySelector('.ed').click();
  assert.deepEqual(log.goto, ['auvoth']);
  assert.deepEqual(log.views, ['factions']);
  assert.deepEqual(log.edits, [{ kind: 'news', id: 'bandit-tolls' }]);
  assert.equal(ev.querySelector('.ed').getAttribute('aria-label'), 'Edit Bandit tolls on the Auvoth road');
});

test('no news gives no card', () => {
  installFakeDom();
  assert.equal(newsCard([], {}, {}), null);
  assert.equal(newsCard(undefined, {}, {}), null);
});
