// The People tab reads the store (PEOPLE-PLAN P5): through the real sb-port and buildSelectors over the live host, the tab's People view, the dossier pages
// and the Now Here list equal the head's stored people at once after a swipe, a swipe back, a middle delete, a rewind, a reload and an edited Re-read,
// with NO publication in between (so NPC State's cache may still be behind): the view is a reader of the head.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig, record, idOf } from './helpers/people-rig.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { PEOPLE_SHAPE } from '../../ui/contract/people.js';
import { DOSSIER_SHAPE } from '../../ui/contract/dossier.js';
import { checkShape } from '../../ui/contract/shapes.js';

const portOf = rig => createSbPort({ sdk: rig.host.sdk, selectors: buildSelectors(() => null, rig.host.sdk) });
const stored = rig => { const slice = rig.host.head().domains.people ?? { order: [], npcs: {} }; return slice.order.map(id => slice.npcs[id]).filter(person => person.archived !== true); };
const names = vm => [...vm.here, ...vm.elsewhere, ...vm.dormant, ...vm.deceased].map(card => card.name).sort();
const wanted = rig => stored(rig).map(person => person.name).sort();
const addAnn = state => { state.turn += 1; state.npcs.push(record('ann', { present: false, location: 'the quay' })); };

// After a step: the People view lists exactly the stored people, matches the contract, every card's id opens a dossier page of the same person, and Here is who is present.
function proveTab(rig, label) {
  const port = portOf(rig);
  const vm = port.view('people');
  assert.deepEqual(checkShape(vm, PEOPLE_SHAPE), [], `${label}: People matches PEOPLE_SHAPE`);
  assert.deepEqual(names(vm), wanted(rig), `${label}: the tab lists the head's people`);
  const pages = port.view('dossier');
  for (const card of [...vm.here, ...vm.elsewhere, ...vm.deceased]) {
    assert.equal(pages[card.personId]?.name, card.name, `${label}: ${card.name}'s id opens their dossier`);
    assert.deepEqual(checkShape(pages[card.personId], DOSSIER_SHAPE), [], `${label}: dossier ${card.name} matches DOSSIER_SHAPE`);
  }
  assert.deepEqual(vm.here.map(card => card.name).sort(), stored(rig).filter(person => person.present === true).map(person => person.name).sort(), `${label}: Here is who is present`);
  return { vm, port };
}

test('the People tab, the dossier pages and Now Here show the head\'s store people after a swipe, a swipe back, a middle delete, a rewind and a reload', async t => {
  const rig = await peopleRig(t);
  await rig.reply('One.');
  await rig.reply('Two.', addAnn);
  const withAnn = proveTab(rig, 'two replies');
  assert.deepEqual(names(withAnn.vm), ['ANN', 'MIRA', 'TOM']);
  assert.deepEqual(withAnn.port.view('now').here.map(row => row.name).sort(), ['MIRA', 'TOM'], 'Now Here lists the present people');
  assert.equal(withAnn.vm.here[0].personId, idOf('mira'));

  await rig.host.swipe('Another two.');          // (a new swipe of reply two carries the people of before it, then the next write replaces them)
  proveTab(rig, 'new swipe');
  await rig.host.st.swipeTo(rig.host.store.headIndex(), 0);
  const back = proveTab(rig, 'swipe back');
  assert.deepEqual(names(back.vm), ['ANN', 'MIRA', 'TOM'], 'swipe back brings Ann back at once');

  await rig.reply('Three.');
  await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 3);   // (a middle delete: reply one and its people go)
  proveTab(rig, 'middle delete');

  const before = names(portOf(rig).view('people'));
  await rig.host.ctx.saveChat();   // (the page saves the chat file; the rig's disk copy is taken from that save)
  const again = await rig.reload();
  const reloaded = proveTab(again, 'reload');
  assert.deepEqual(names(reloaded.vm), before, 'a reload shows the same people');
});

test('a rewind shows the earlier people with nothing stale; a Re-read of an edited reply shows the people of the new reply (grown, then shrunk)', async t => {
  const rig = await peopleRig(t);
  await rig.reply('One.');
  await rig.reply('Two.', addAnn);
  await rig.reply('Three.', state => { state.turn += 1; state.npcs.push(record('bo', { present: true })); });
  assert.deepEqual(names(proveTab(rig, 'three').vm), ['ANN', 'BO', 'MIRA', 'TOM']);
  await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);    // rewind to before reply three
  assert.deepEqual(names(proveTab(rig, 'rewind').vm), ['ANN', 'MIRA', 'TOM'], 'rewind: Bo is gone at once');
  await rig.host.st.editMessage(rig.host.store.headIndex(), 'Two, edited and longer.\n\nWith more words in it than before, to grow the reply.');
  const done = await rig.host.turn.reread(rig.host.store.headIndex());
  assert.equal(done.ok, true, done.message);
  proveTab(rig, 'Re-read of the grown reply');
  await rig.host.st.editMessage(rig.host.store.headIndex(), 'Two.');
  const shrunk = await rig.host.turn.reread(rig.host.store.headIndex());
  assert.equal(shrunk.ok, true, shrunk.message);
  proveTab(rig, 'Re-read of the shrunk reply');
});

test('the tab answers from the store while NPC State\'s memory disagrees: a person only the cache knows is not listed, a stored one the cache lost still is', async t => {
  const rig = await peopleRig(t);
  await rig.reply('One.');
  rig.live.state.npcs.push(record('ghost'));                    // (only the cache: never published, so never stored)
  rig.live.state.npcs = rig.live.state.npcs.filter(person => person.id !== idOf('tom'));   // (the cache lost Tom; the store keeps him)
  const vm = portOf(rig).view('people');
  assert.deepEqual(names(vm), ['MIRA', 'TOM']);
  assert.equal(portOf(rig).view('dossier')[idOf('tom')].name, 'TOM');
});

test('Follow is the store\'s flag: people.follow shows the star on the card and the dossier, and it follows a swipe and a reload', async t => {
  const rig = await peopleRig(t);
  await rig.reply('One.');
  await rig.reply('Two.');
  assert.equal((await rig.host.sdk.command('people.follow', { id: idOf('mira'), on: true })).ok, true);
  const view = r => portOf(r).view('people').here.find(card => card.name === 'MIRA');
  assert.equal(view(rig).followed, true);
  assert.equal(portOf(rig).view('dossier')[idOf('mira')].following, true);
  await rig.host.swipe('Other two.');
  await rig.host.st.swipeTo(rig.host.store.headIndex(), 0);
  assert.equal(view(rig).followed, true, 'swipe back keeps the flag');
  assert.equal(portOf(rig).view('now').here.find(row => row.name === 'MIRA').followed, true, 'Now Here shows it too');
  await rig.host.ctx.saveChat();
  const again = await rig.reload();
  assert.equal(view(again).followed, true, 'a reload keeps the flag');
});

test('the harness-only fields have real data: Likes, a tie\'s person link and portrait come from the stored dossiers, and they follow a swipe', async t => {
  const rig = await peopleRig(t);
  await rig.reply('One.');
  await rig.reply('Two.', state => {
    state.turn += 1;
    state.npcs[0].keyRelationships = ['TOM — her brother | teases her', 'A stranger — passing'];
    state.npcs[0].customFields = { Likes: 'plain bread, sea songs' };
    state.portraitAssets = { [idOf('tom')]: { path: '/user/files/tom.webp', type: 'image/webp', hash: 'h' } };
  });
  const mira = () => portOf(rig).view('dossier')[idOf('mira')];
  assert.deepEqual(mira().profile.likes, ['plain bread', 'sea songs']);
  assert.deepEqual(mira().ties, [
    { personId: idOf('tom'), name: 'TOM', line: 'her brother · teases her', portrait: '/user/files/tom.webp' },
    { personId: null, name: 'A stranger', line: 'passing' },
  ]);
  assert.deepEqual(checkShape(mira(), DOSSIER_SHAPE), []);
  assert.equal(portOf(rig).view('people').here.find(card => card.name === 'TOM').portrait, '/user/files/tom.webp');
  await rig.host.swipe('Other two.');     // (a new swipe, then a rewind to before reply two)
  await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 1);
  assert.equal('likes' in mira().profile, false, 'rewound: the Likes of the deleted reply are gone');
  assert.equal(mira().ties.length, 0);
});
