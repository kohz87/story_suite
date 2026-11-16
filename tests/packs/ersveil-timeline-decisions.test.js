// Ersveil 2.2.0's hidden timeline (examples/packs/ersveil/pack.json): replay decisions on the real host (a decision
// once made stays made) and 2.9.6 flood news.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition } from '../../modules/world/events/condition.js';
import { NEWS_REGIONS, events, pack, rowsOf, view } from './ersveil-timeline.helpers.js';

// A small Director on the real host: quests change Hasse's sway, world entries behave like lasting
// chronicle entries, and fights are read from receipts, so the replay tests exercise the actual bus and store.
let swayShift = [0, 0, 0];     // what the scoring now adds to each power (a Director update): the test sets it after the decisions
function directorForDecisions() {
    return {
        id: 'test-director', name: 'Test director', version: '1.0.0',
        domains: {
            director: { initial: () => ({ time: { minutes: 0 }, deed: 'none' }), validate: () => [] },
            chronicle: { initial: () => ({ entries: {} }), validate: () => [] },
        },
        commands: {
            'test.time'(ctx, { minutes }) { ctx.draft('director').time.minutes = minutes; return { summary: 'Time.' }; },
            'test.fight'() { return { summary: 'A fight was won.' }; },
            'chronicle.lasting'(ctx, payload) {
                const entries = ctx.draft('chronicle').entries;
                entries[payload.name] = { ...payload, since: entries[payload.name]?.since ?? ctx.read('director').time.minutes };
                return { summary: payload.name };
            },
            'test.reign'(ctx, { name }) { ctx.draft('chronicle').entries[name] = { name, since: 0 }; return { summary: name }; },
        },
        queries: {
            'chronicle.passed': (state, { name, minutes }) => {
                const entry = state.domains.chronicle.entries[name];
                return !!entry && state.domains.director.time.minutes >= entry.since + minutes;
            },
            'ripples.sway': (state, _args, tools) => {
                const helped = state.domains.director.deed === 'hasse' || tools.receipts().some(entry => entry.receipt.type === 'test.fight');
                return rowsOf((helped ? [40, 35, 55] : [40, 35, 25]).map((value, at) => value + swayShift[at]));
            },
        },
        capture: { kinds: { deed: { grammar: '! deed Name' } }, apply(ctx, line) {
            ctx.draft('director').deed = line.name;
            return { summary: `Helped ${line.name}.` };
        } },
    };
}

async function decisionHost(t, { deed = 'none', swipes = false, fightAfterWar = false } = {}) {
    const { createHost } = await import('../../testkit/index.js');
    const host = await createHost({ modules: [directorForDecisions()] });
    t.after(() => host.close());
    const alternatives = events.filter(event => event.decision).map(({ after, ...event }) => event);
    const mini = { id: 'ersveil', version: '1.0.0', requires: { storyBlock: '^2.31.0' }, ripples: pack.ripples, content: { events: alternatives } };
    const installed = await host.packs.packs.install(mini);
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    const story = name => `A deed.\n\n<Changes>\n! deed ${name}\n</Changes>`;
    await host.send('Begin.', story(deed));
    const earlier = host.ctx.chat.length - 1;
    if (swipes) await host.swipe(story('none'));
    await host.send('Later.', 'At Marrowbridge.');
    const warCarrier = host.ctx.chat.length - 1;
    assert.equal((await host.bus.command('test.time', { minutes: 318100000 }, { cause: 'ui' })).ok, true);
    const war = await host.bus.command('events.fire', { id: 'pack.ersveil/marrowbridge-hasse' }, { cause: 'system' });
    assert.equal(war.ok, true, war.message);
    if (fightAfterWar) assert.equal((await host.bus.command('test.fight', {}, { cause: 'system' })).ok, true);
    await host.send('Later still.', 'The Diet meets.');
    assert.equal((await host.bus.command('test.time', { minutes: 318400000 }, { cause: 'ui' })).ok, true);
    const crown = await host.bus.command('events.fire', { id: 'pack.ersveil/crown-wendhild-over-corvin' }, { cause: 'system' });
    assert.equal(crown.ok, true, crown.message);
    return { host, earlier, warCarrier, story };
}

function chosen(host) {
    const entries = host.head().domains.chronicle.entries;
    return {
        wars: Object.keys(entries).filter(name => name.startsWith("Highmark's war: ")),
        reigns: Object.keys(entries).filter(name => name.startsWith('Reign of ')),
        decisions: host.store.receipts().filter(entry => entry.receipt.type === 'events.fire').map(entry => entry.receipt.data.event),
    };
}

test('a Re-read replaces both later decisions from the changed deed and reloads identically', async t => {
    const { host, earlier, story } = await decisionHost(t);
    assert.deepEqual(chosen(host).reigns, ['Reign of Empress Wendhild']);
    host.ctx.chat[earlier].mes = story('hasse');
    host.ctx.chat[earlier].swipes[0] = story('hasse');
    const done = await host.turn.reread(earlier);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(chosen(host).wars, ["Highmark's war: Wendhild against Hasse"]);
    assert.deepEqual(chosen(host).reigns, ['Reign of Emperor Hasse']);
    assert.deepEqual(chosen(host).decisions, ['pack.ersveil/marrowbridge-corvin', 'pack.ersveil/crown-hasse-over-wendhild']);
    const before = JSON.stringify(host.head());
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), before);
});

test('deleting or swiping an earlier deed reselects the surviving war and crown', async t => {
    const removed = await decisionHost(t, { deed: 'hasse' });
    assert.deepEqual(chosen(removed.host).reigns, ['Reign of Emperor Hasse']);
    await removed.host.st.deleteMessage(removed.earlier);
    assert.deepEqual(chosen(removed.host).reigns, ['Reign of Empress Wendhild']);
    assert.deepEqual(chosen(removed.host).wars, ["Highmark's war: Wendhild against Corvin"]);

    const swiped = await decisionHost(t, { deed: 'hasse', swipes: true });
    assert.deepEqual(chosen(swiped.host).reigns, ['Reign of Empress Wendhild']);
    await swiped.host.st.swipeTo(swiped.earlier, 0);
    assert.deepEqual(chosen(swiped.host).reigns, ['Reign of Emperor Hasse']);
    assert.deepEqual(chosen(swiped.host).wars, ["Highmark's war: Wendhild against Hasse"]);
});

test('a fight after a decision on the same carrier cannot influence that earlier decision on Re-read', async t => {
    const { host, earlier, story } = await decisionHost(t, { fightAfterWar: true });
    assert.deepEqual(chosen(host).wars, ["Highmark's war: Wendhild against Corvin"]);
    host.ctx.chat[earlier].mes = story('none');
    host.ctx.chat[earlier].swipes[0] = story('none');
    const done = await host.turn.reread(earlier);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(chosen(host).wars, ["Highmark's war: Wendhild against Corvin"]);
});

test('an existing 2.9.3 reign blocks every alternative crown even when sway changes', () => {
    const allCrowns = events.filter(event => event.decision === 'highmark-crown');
    for (const crown of allCrowns) for (const reign of ['Reign of Empress Wendhild', 'Reign of Emperor Corvin', 'Reign of Emperor Hasse']) {
        const chronicle = new Map([[reign, { since: 0 }], ["Highmark's war: Wendhild against Corvin", { since: 0 }], ["Highmark's war: Wendhild against Hasse", { since: 0 }], ["Highmark's war: Corvin against Hasse", { since: 0 }]]);
        const result = evaluateCondition(crown.when, view({ minutes: 318400000, chronicle, sway: [25, 35, 40] }));
        assert.equal(result.met, false, `${crown.id}: ${reign}`);
    }
});

test('a decision whose story did not change is kept when the scoring changes: swipe, delete, Re-read of a later reply', async t => {
    swayShift = [0, 0, 0];
    t.after(() => { swayShift = [0, 0, 0]; });
    const { host, earlier, story } = await decisionHost(t);
    await host.send('Later on.', 'Months pass.');
    const crowned = ['Reign of Empress Wendhild'];
    assert.deepEqual(chosen(host).reigns, crowned);
    swayShift = [-30, 0, 0];       // now Corvin would be picked
    await host.swipe('Months pass, again.');
    assert.deepEqual(chosen(host).reigns, crowned, 'swipe of the last reply');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.deepEqual(chosen(host).reigns, crowned, 'delete of the last reply');
    assert.deepEqual(chosen(host).wars, ["Highmark's war: Wendhild against Corvin"]);
    await host.send('One more.', 'Winter.');
    const done = await host.turn.reread(host.ctx.chat.length - 1);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(chosen(host).reigns, crowned, 'Re-read of a reply after the crown');
    const before = JSON.stringify(host.head());
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), before);
    // the earlier deed changed: the war and the crown are picked again
    host.ctx.chat[earlier].mes = story('hasse');
    host.ctx.chat[earlier].swipes[0] = story('hasse');
    const again = await host.turn.reread(earlier);
    assert.equal(again.ok, true, again.message);
    assert.deepEqual(chosen(host).reigns, ['Reign of Emperor Hasse']);
});

// ---- 2.9.6: the flood news is one event (region(...)), so moving between the regions that hear it never repeats it ----

test('2.9.6: one flood-news event covers both old region groups and the split event is gone', () => {
    const news = events.filter(event => event.id.startsWith('flood-611-news'));
    assert.deepEqual(news.map(event => event.id), ['flood-611-news']);
    assert.equal(news[0].after, 'flood-611');
    assert.match(news[0].when, /region\('Highmark Empire', 'Valegard'/);
    assert.ok(!/region ==/.test(news[0].when), 'no region chain is left');
    const at = (region, minutes = 316974720 + 9000) => evaluateCondition(news[0].when, view({ minutes, place: { name: 'x', region }, chronicle: new Map([['The early flood', { since: 316974720 }]]) })).met;
    for (const region of NEWS_REGIONS) assert.equal(at(region), true, region);
    for (const region of ['River Confederacy: Bluewatch', 'Shornmarch', 'Auvoth Compact', 'Ardelian Empire and Southmarch', '']) assert.equal(at(region), false, region);
    assert.equal(at('Valegard', 316974720 + 100), false, 'not before the news has had its days to travel');
    assert.equal(pack.version, '2.9.6');
});

test('2.9.6: moving between the two old region groups tells the flood news once', () => {
    const regions = ['Valegard', 'Silver Mark', 'Highmark Empire', 'Ironanvil', 'Startrace Tower'];
    const fired = [];
    const done = new Set(['flood-611']);
    const chronicle = new Map([['The early flood', { since: 316974720 }]]);
    const news = events.filter(event => event.id.startsWith('flood-611-news'));
    for (let reply = 0; reply < regions.length; reply += 1) {
        const env = view({ minutes: 316974720 + 9000 + reply * 360, place: { name: 'x', region: regions[reply] }, chronicle });
        for (const event of news) if (!done.has(event.id) && evaluateCondition(event.when, env).met) { done.add(event.id); fired.push(event.id); }
    }
    assert.deepEqual(fired, ['flood-611-news'], 'one bulletin, however the player moves between the groups');
});

test('2.9.6: a chat that already heard the news keeps its record, and written replies replay as they were', async t => {
    const { createHost } = await import('../../testkit/index.js');
    const host = await createHost({});
    t.after(() => host.close());
    const mini = { id: 'ersveil', version: '2.9.6', requires: { storyBlock: '^2.31.0' }, content: { events: events.filter(event => event.id === 'flood-611-news').map(({ after, when, ...event }) => ({ ...event, when: "query('scene.place') != null && region('Valegard', 'Silver Mark')" })) } };
    const installed = await host.packs.packs.install(mini);
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    await host.send('Begin.', '<Changes>\n~ place Valegard Keep | kind: town | region: Valegard\n</Changes>');
    const before = JSON.stringify(host.ctx.chat.map(message => message.mes));
    const first = await host.bus.command('events.fire', { id: 'pack.ersveil/flood-611-news' }, { cause: 'system' });
    assert.equal(first.ok, true, first.message);
    const again = await host.bus.command('events.fire', { id: 'pack.ersveil/flood-611-news' }, { cause: 'system' });
    assert.equal(again.ok, false, 'the record stands: it is not told twice');
    assert.equal(JSON.stringify(host.ctx.chat.map(message => message.mes)), before, 'written replies are untouched');
});

// The old two-event list (2.9.5): the first group's event and the second group's own event, as the merged one was made from.
test('2.9.6: a chat that fired only the old second-group news: swap to the merged event, rebuild equals the head, Re-read is byte-identical, the claim stands', async t => {
    const { createHost } = await import('../../testkit/index.js');
    const host = await createHost({});
    t.after(() => host.close());
    const [group1, group2] = [NEWS_REGIONS.slice(0, 6), NEWS_REGIONS.slice(6)];
    const { after, when, ...base } = events.find(event => event.id === 'flood-611-news');   // (the chronicle wait is left out: the mini-pack has no flood-611)
    const eventFor = (id, names) => ({ ...base, id, when: `query('scene.place') != null && region(${names.map(name => `'${name}'`).join(', ')})` });
    const oldPack = { id: 'ersveil', version: '2.9.5', requires: { storyBlock: '^2.31.1' }, content: { events: [eventFor('flood-611-news', group1), eventFor('flood-611-news-2', group2)] } };
    const first = await host.packs.packs.install(oldPack);
    assert.equal(first.ok, true, JSON.stringify(first.errors));
    await host.send('Begin.', '<Changes>\n~ place Silver Keep | kind: town | region: Silver Mark\n</Changes>');
    const fired = await host.bus.command('events.fire', { id: 'pack.ersveil/flood-611-news-2' }, { cause: 'system' });
    assert.equal(fired.ok, true, fired.message);
    await host.send('Onward.', 'The road goes on.');
    const at = host.ctx.chat.findIndex(message => message.extra?.storySuite?.receipts?.some(receipt => receipt.type === 'events.fire'));   // the reply that holds the fire
    assert.ok(at > 0, 'the fire is in a reply');
    // 2.9.6 replaces both with the merged event (the second group's event is gone from the list).
    const merged = await host.packs.packs.install({ id: 'ersveil', version: '2.9.6', requires: { storyBlock: '^2.31.1' }, content: { events: [eventFor('flood-611-news', NEWS_REGIONS)] } });
    assert.equal(merged.ok, true, JSON.stringify(merged.errors));
    const head = JSON.stringify(host.head()), chat = JSON.stringify(host.ctx.chat);
    assert.match(head, /event:pack\.ersveil\/flood-611-news-2/, 'the claim of the old second-group event is in the head');
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), head, 'rebuild equals the head');
    const done = await host.turn.reread(at);
    assert.equal(done.ok, true, done.message);
    assert.equal(JSON.stringify(host.head()), head, 'Re-read leaves the record byte-identical');
    assert.equal(JSON.stringify(host.ctx.chat), chat, 'Re-read leaves the chat byte-identical');
    await host.st.loadChat(structuredClone(host.ctx.chat));
    assert.equal(JSON.stringify(host.head()), head, 'reload equals the head');
    assert.match(JSON.stringify(host.head()), /event:pack\.ersveil\/flood-611-news-2/, 'the claim stands');
});
