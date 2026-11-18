// Day digest, soak findings: W26 (a quest the story wrote straight is taken on the day it was made), W30 (the day's money in the
// currency's coins, as the bag writes it) and W31 (NPC State's own bookkeeping is not an event of the day).
import test from 'node:test';
import assert from 'node:assert/strict';

import { dayFacts, dayLine, moneyText, walkDays } from '../../../../modules/world/chronicle/days.js';

const DAY = 1440;
const D = 100;
let rev = 1000;
const r = (type, fields = {}) => ({ type, module: 'story-director', cause: 'story', summary: '', narrate: false, data: {}, rev: (rev += 1), ...fields });
const clock = minutes => r('capture.time', { data: { minutes }, summary: 'Story time: …' });
const entries = list => list.map((receipt, index) => ({ index, receipt }));
const quest = fields => ({ id: 'th_aaaaaaaa', key: 'Runner to Auvoth', kind: 'quest', status: 'active', offer: false, taken: null, ended: null, ...fields });

test('a quest written with + quest is taken on the day of its line; an offer is not, until it is accepted', () => {
    const line = r('capture.quest', { summary: 'Director: + quest Runner to Auvoth', data: { thread: 'th_aaaaaaaa' } });
    const walk = walkDays(entries([clock(D * DAY + 60), line, clock((D + 1) * DAY + 60)]));
    const facts = (threads, day = D) => dayFacts(walk.days.get(day) ?? [], { revDay: walk.revs, day, state: { domains: { director: { threads } } } });
    assert.deepEqual(facts({ th_aaaaaaaa: quest({}) }).quests.taken, ['Runner to Auvoth']);
    assert.deepEqual(facts({ th_aaaaaaaa: quest({}) }, D + 1).quests.taken, [], 'only the day of the line');
    assert.deepEqual(facts({ th_aaaaaaaa: quest({ offer: true }) }).quests.taken, [], 'an offer is not taken yet');
    assert.deepEqual(facts({ th_aaaaaaaa: quest({ taken: { rev: 1 } }) }).quests.taken, [], 'an accepted offer is read by its own stamp');
});

test('the day\'s line writes money in coins when the currency has them', () => {
    const currency = { name: 'copper', plural: 'copper', coins: [{ name: 'copper', plural: 'copper', value: 1 }, { name: 'silver', plural: 'silver', value: 10 }] };
    assert.equal(moneyText({ in: 15, out: 0 }, currency), '1 silver 5 copper in');
    assert.match(dayLine('Oct 5', { places: [], quests: { taken: [], done: [], failed: [], dropped: [] }, fights: { count: 0 }, money: { in: 15, out: 0 }, npcs: [], world: [], happened: [], count: 1 }, { currency }), /1 silver 5 copper in/);
    assert.equal(moneyText({ in: 150, out: 0 }, { name: 'mark', plural: 'marks' }), '150 marks in', 'a currency with no coins is as it was');
});

test('NPC State\'s bookkeeping receipts are no event of the day', () => {
    const list = [clock(D * DAY + 60), r('people.write', { module: 'npc-state', summary: 'People stored.' }),
        r('npc.meters', { module: 'npc-state', summary: 'Oswin Marle: meters started' }), r('capture.item', { module: 'story-block', summary: 'The party gains Rope.' })];
    const walk = walkDays(entries(list));
    const facts = dayFacts(walk.days.get(D), { revDay: walk.revs, day: D, state: null });
    assert.deepEqual(facts.happened.map(item => item.text ?? item), ['The party gains Rope.']);
});
