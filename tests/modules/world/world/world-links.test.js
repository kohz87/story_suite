// World data for the map (G10): news carry place and faction ids and a heard stamp, factions list their members and area place,
// open quests are tied to places; on a real host with a stand-in NPC State Delta. Replay == live (the shape test is tests/ui-gaps/world-data.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';

import { said, worldHost } from './helpers.js';
import { delta, LINES } from './links-helpers.js';

test('news, factions and quests carry the links the map needs, and replay equals live', async t => {
    const host = await worldHost({ extra: [delta()] });
    t.after(() => host.close());
    await host.send('Begin.', said('The harbour.', LINES));
    await host.send('Then.', said('Still there.'));
    const view = host.sdk.query('director.world');
    const plague = view.news.find(n => n.name === 'Red Plague');
    const places = host.sdk.query('atlas.places');
    const harbour = places.find(p => p.name === 'Harbour');
    assert.ok(harbour, 'the atlas has the harbour');
    assert.equal(plague.placeId, harbour.id);
    assert.equal(plague.factionIds.length, 1);
    // Where the story had the party and when, at the reply that wrote it; nobody told it.
    assert.deepEqual(plague.heard, [{ where: 'in Harbour', when: 'June 3, 1200', from: null }]);
    const fair = view.news.find(n => n.name === 'Harvest Fair');
    assert.deepEqual([fair.placeId, fair.factionIds, fair.heard], [null, [], []]);
    const guild = view.factions.find(f => f.name === 'Guild');
    assert.deepEqual(guild.areaPlaceIds, [harbour.id]);
    assert.deepEqual(guild.members.map(m => m.name).sort(), ['Brecht', 'Mira']);
    assert.deepEqual(view.quests.map(q => [q.name, q.placeId]), [['Rat Cellar', harbour.id], ['Far Errand', null]]);
    const live = JSON.stringify(host.sdk.query('director.world'));
    host.store.rebuild();
    assert.equal(JSON.stringify(host.sdk.query('director.world')), live);
    // A swipe of the last reply gives its own lines in their place; the earlier ones' links stay.
    await host.swipe(said('Elsewhere.', ['~ place Harbour', '+ faction Chapel — the chapel | area: Harbour']));
    const swiped = host.sdk.query('director.world');
    assert.equal(swiped.quests.length, 2);
    assert.deepEqual(swiped.factions.map(f => f.name).sort(), ['Chapel', 'Guild']);
    assert.deepEqual(swiped.factions.find(f => f.name === 'Chapel').members.map(m => m.name), ['Brecht', 'Wynn']);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.sdk.query('director.world')), JSON.stringify(swiped));
});

test('a later reply adds a stamp at its own place and time; deleting it takes the stamp away; a rebuild agrees', async t => {
    const host = await worldHost({ extra: [delta()] });
    t.after(() => host.close());
    await host.send('Begin.', said('The harbour.', LINES));
    await host.send('Then.', said('The market.', ['~ time June 4, 1200, 09:00 am', '~ place Market', '~ world Red Plague | state: ongoing — spreads']));
    const stamps = () => host.sdk.query('director.world').news.find(n => n.name === 'Red Plague').heard;
    assert.deepEqual(stamps().map(h => [h.where, h.when]), [['in Harbour', 'June 3, 1200'], ['in Market', 'June 4, 1200']]);
    const live = JSON.stringify(host.sdk.query('director.world'));
    host.store.rebuild();
    assert.equal(JSON.stringify(host.sdk.query('director.world')), live);
    const user = host.ctx.chat.findIndex(message => message.is_user && /Then\./.test(message.mes));
    await host.st.deleteMessage(user + 1);
    await host.st.deleteMessage(user);
    assert.deepEqual(stamps().map(h => h.where), ['in Harbour']);
    const after = JSON.stringify(host.sdk.query('director.world'));
    host.store.rebuild();
    assert.equal(JSON.stringify(host.sdk.query('director.world')), after);
});

test('a reply that leaves the event unchanged gives no stamp', async t => {
    const host = await worldHost({ extra: [delta()] });
    t.after(() => host.close());
    await host.send('Begin.', said('The harbour.', LINES));
    await host.send('Then.', said('The market.', ['~ time June 4, 1200, 09:00 am', '~ place Market', '~ world Red Plague | state: ongoing']));
    assert.deepEqual(host.sdk.query('director.world').news.find(n => n.name === 'Red Plague').heard.map(h => h.where), ['in Harbour']);
});

test('without NPC State Delta and without the atlas places the links are empty, not missing', async t => {
    const host = await worldHost();
    t.after(() => host.close());
    await host.send('Begin.', said('Quiet.', ['+ world Red Plague — coughing | state: ongoing', '+ faction Guild — guild | stance: wary']));
    const view = host.sdk.query('director.world');
    assert.deepEqual([view.news[0].placeId, view.news[0].factionIds, view.news[0].heard], [null, [], []]);
    assert.deepEqual([view.factions[0].areaPlaceIds, view.factions[0].members, view.quests], [[], [], []]);
});
