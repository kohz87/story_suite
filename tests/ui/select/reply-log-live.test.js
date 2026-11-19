// Each reply's card reads that reply's own state (ui/select/reply-log.js over sdk `{ asOf }`) on a live host: two replies keep their own HP, place,
// time and condition; a swipe redraws only the swiped reply's card; a middle delete leaves the others with their own; a rebuild and a reload agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { COMBAT_V1_TEMPLATES } from '../../../modules/rpg/templates-combat.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { makeReader } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { selectReplyLog, replyIndexes } from '../../../ui/select/reply-log.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { CHAT_SHAPE } from '../../../ui/contract/chat.js';

const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const HIT = '~ dm character — a rat bite | kind: set-health | to: 1';

async function story(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ modules: [createModule()] });
  t.after(() => host.close());
  host.features.set(CORE_FEATURE.leanRpg, true);
  host.features.set(CORE_FEATURE.choices, true);
  await host.send('Begin.', reply('The road.', ['~ time June 3, 1200, 08:00 am', '~ place Highmark', '~ you condition: rested']));
  for (const { definition } of COMBAT_V1_TEMPLATES) assert.equal((await host.sdk.command('dm.define', { definition: structuredClone(definition) })).ok, true);
  await host.send('Into the store.', reply('The rats come.', ['~ time June 3, 1200, 10:40 am', '~ place Grain Storehouse', HIT, '~ you condition: rat bites on both shins', '? choice Run', '? choice Fight on']));
  await host.send('Out.', reply('The gate.', ['~ place Old Gate']));
  return host;
}
const cards = host => selectReplyLog(makeReader(host.sdk), { chat: host.ctx.chat });
const brief = list => list.map(card => ({ index: card.index, place: card.top.place, time: card.top.time, hp: card.top.pools.find(p => p.kind === 'hp') ?? null, condition: card.top.condition, choices: card.choices }));

test('two replies keep their own HP, place, time and condition; the one that moved HP shows the value before it', async t => {
  const host = await story(t);
  const list = cards(host);
  assert.deepEqual(checkShape(list, CHAT_SHAPE.replies), []);
  const [road, store, gate] = brief(list);
  assert.deepEqual([road.place, road.time, road.hp, road.condition], ['Highmark', '08:00 am', { kind: 'hp', value: 7, max: 7, before: null }, 'rested']);
  assert.deepEqual([store.place, store.time, store.hp, store.condition], ['Grain Storehouse', '10:40 am', { kind: 'hp', value: 1, max: 7, before: 7 }, 'rat bites on both shins']);
  assert.deepEqual(store.choices, ['Run', 'Fight on']);
  assert.deepEqual([gate.place, gate.hp.value, gate.hp.before, gate.choices], ['Old Gate', 1, null, []], 'the next reply did not move HP: no change shown');
  assert.ok(list[1].changes.some(line => /Grain Storehouse/u.test(line.line)), 'that reply\'s own change lines');
  const recorded = host.ctx.chat.find(message => !message.is_user);
  assert.deepEqual(replyIndexes([recorded]), [0], 'a greeting with a record gets a card');
  assert.deepEqual(replyIndexes([{ ...recorded, extra: {} }]), [], 'one without, none');
  host.store.rebuild();
  assert.deepEqual(brief(cards(host)), [road, store, gate], 'a rebuild gives the same cards');
  const loaded = await createHost({ modules: [createModule()], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
  t.after(() => loaded.close());
  assert.deepEqual(brief(cards(loaded)), [road, store, gate], 'a reload gives the same cards');
});

test('a swipe changes only the swiped reply\'s card; a middle delete leaves the others with their own', async t => {
  const host = await story(t);
  const [road, store] = brief(cards(host));
  await host.swipe(reply('The gate is shut.', ['~ place Shut Gate', '? choice Knock']));
  const swiped = brief(cards(host));
  assert.deepEqual(swiped.slice(0, 2), [road, store], 'the older cards keep theirs');
  assert.deepEqual([swiped[2].place, swiped[2].choices], ['Shut Gate', ['Knock']]);
  await host.st.swipeTo(host.ctx.chat.length - 1, 0);
  assert.equal(brief(cards(host))[2].place, 'Old Gate', 'swipe back: its own again');
  // delete the store reply (and the reader's message before it): the gate reply keeps its place, HP comes from what is left
  const at = host.ctx.chat.findIndex(message => !message.is_user && String(message.mes).startsWith('The rats come.'));
  await host.st.deleteMessage(at);
  await host.st.deleteMessage(at - 1);
  const after = brief(cards(host));
  assert.deepEqual(after.map(card => card.place), ['Highmark', 'Old Gate']);
  assert.equal(after[1].hp.value, 7, 'no bite left in the story: full HP');
  host.store.rebuild();
  assert.deepEqual(brief(cards(host)), after, 'a rebuild agrees after the delete');
});

test('the chat view: a card per drawn reply, the newest\'s action line, the tab order the setting stores', async t => {
  const host = await story(t);
  const selectors = buildSelectors(() => host.ctx, host.sdk);
  const read = makeReader(host.sdk);
  const all = selectors.chat(read);
  assert.deepEqual(checkShape(all, CHAT_SHAPE), []);
  assert.deepEqual(all.replies.map(card => card.index), replyIndexes(host.ctx.chat).filter(index => all.replies.some(card => card.index === index)));
  assert.equal(all.head.index, host.ctx.chat.length - 1);
  const drawn = selectors.chat(read, { replies: [all.head.index] });
  assert.deepEqual(drawn.replies.map(card => card.index), [all.head.index], 'only the replies on screen');
  host.settings.set('story-block', 'replyTabs', 'choices -chatter here changes');
  assert.deepEqual(selectors.chat(read).tabs, [{ id: 'choices', on: true }, { id: 'chatter', on: false }, { id: 'here', on: true }, { id: 'changes', on: true }]);
});

test('replyIndexes: story replies only; the greeting only with a record; system messages never', () => {
  const chat = [{ mes: 'greeting' }, { is_user: true, mes: 'hi' }, { mes: 'a' }, { mes: 'sys', is_system: true }, { mes: 'b' }];
  assert.deepEqual(replyIndexes(chat), [2, 4]);
  assert.deepEqual(replyIndexes(null), []);
});
