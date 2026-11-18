// Pack format 4, job T2: the weather comes from the climate of the place (its own, else its region's, else temperate), by season; the game's style and lines;
// format 3 weather and a chat with no pack are as they were. Replay == live: swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete, a reload.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { CLIMATE_TABLES, TEMPERATE, climateOf, climateWeather, hashOf, weatherFor, weatherKey } from '../../../modules/time/weather.js';

const REQ = { suite: '^0.1' };
const MONTHS = Array.from({ length: 12 }, (_, n) => ({ name: `M${n + 1}`, days: 30 }));
const place = (id, name, region, extra = {}) => ({ id, name, region, kind: 'village', x: 1, y: 1, ...extra });
const world = () => ({ id: 'w1', format: 4, kind: 'world', version: '1.0.0', name: 'W', requires: REQ, content: {
    start: { date: { year: 5, month: 2, day: 3 } },
    regions: [{ id: 'north', name: 'The North', climate: 'frozen' }, { id: 'mid', name: 'Midlands' }],
    places: [place('peak', 'Peak Hold', 'north'), place('farm', 'Old Farm', 'mid'), place('oasis', 'Green Well', 'north', { climate: 'arid' }), place('mine', 'Deep Mine', 'mid', { layer: 'underground' })] } });
const game = (id, weather) => ({ id, format: 4, kind: 'game', version: '1.0.0', name: id, requires: REQ, content: { calendar: { months: MONTHS, seasons: [{ name: 'Long Night', months: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'] }] }, ...(weather ? { weather } : {}) } });
const said = (text, lines = []) => (lines.length ? `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const at = (name, region) => [`~ place ${name} | kind: village | region: ${region}`];
const current = host => host.head().domains.scene.weather;
const all = table => Object.values(table).flat();

async function newHost(t, packs = [world(), game('g1')]) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [createModule()] });
    t.after(() => host.close());
    for (const pack of packs) assert.equal((await host.packs.packs.install(pack)).ok, true);
    return host;
}

test('the climate of a place: its own, underground by layer, its region\'s, else temperate; a place unknown to the pack takes the scene\'s region', async t => {
    const host = await newHost(t);
    const query = (name, args) => host.sdk.query(name, args);
    assert.equal(climateOf(query, 'Green Well', ''), 'arid', 'the place\'s own, over its region\'s frozen');
    assert.equal(climateOf(query, 'Peak Hold', ''), 'frozen', 'its region\'s, by id');
    assert.equal(climateOf(query, 'Deep Mine', 'midlands'), 'underground');
    assert.equal(climateOf(query, 'Old Farm', ''), 'temperate', 'a region with no climate');
    assert.equal(climateOf(query, 'Nowhere', 'the north'), 'frozen', 'the scene\'s region, by name');
    assert.equal(climateOf(query, 'Nowhere', 'elsewhere'), 'temperate');
    assert.equal(climateOf(null, 'Peak Hold', ''), 'temperate', 'no query: temperate');
});

test('the table: the game\'s lines win for their climate; style "tables" also takes season-only lines; the built-in table otherwise', () => {
    const winter = { name: 'winter', builtIn: 'winter' };
    assert.deepEqual(climateWeather(null, winter, 'cold'), [...CLIMATE_TABLES.cold.winter]);
    assert.deepEqual(climateWeather(null, winter, 'temperate'), [...TEMPERATE.winter]);
    assert.deepEqual(climateWeather(null, null, 'frozen'), all(CLIMATE_TABLES.frozen), 'no clock: all four seasons of the climate');
    assert.deepEqual(climateWeather(null, null, 'temperate'), [...TEMPERATE.any], 'no clock, temperate: the mild table as before');
    assert.deepEqual(climateWeather(null, winter, 'underground'), [...CLIMATE_TABLES.underground]);
    const climate = { style: 'climate', tables: [], climateTables: [{ climate: 'cold', season: 'winter', weather: ['mine'] }, { climate: 'cold', season: '', weather: ['any'] }] };
    assert.deepEqual(climateWeather(climate, winter, 'cold'), ['mine']);
    assert.deepEqual(climateWeather(climate, { name: 'summer', builtIn: 'summer' }, 'cold'), ['any']);
    assert.deepEqual(climateWeather(climate, winter, 'arid'), [...CLIMATE_TABLES.arid.winter], 'another climate: built-in');
    const tables = { style: 'tables', tables: [{ climate: '', season: 'winter', weather: ['season only'] }, { climate: '', season: '', weather: ['grey'] }], climateTables: [] };
    assert.deepEqual(climateWeather(tables, winter, 'arid'), ['season only']);
    assert.deepEqual(climateWeather(tables, { name: 'summer', builtIn: 'summer' }, 'arid'), ['grey']);
    for (const lines of all(CLIMATE_TABLES).filter(Array.isArray)) assert.ok(lines.every(line => line.length <= 60));
    assert.ok(Object.keys(CLIMATE_TABLES).length === 9, 'every climate but temperate');
});

test('the key adds a climate other than temperate, within 80 characters; temperate keeps format 3\'s key', () => {
    assert.equal(weatherKey(1440, 'x', 'temperate'), weatherKey(1440, 'x'));
    assert.equal(weatherKey(1440, 'x', 'frozen'), 'day 1|x|frozen');
    assert.ok(Array.from(weatherKey(1440, 'y'.repeat(200), 'underground')).length <= 80);
    assert.ok(weatherKey(1440, 'y'.repeat(200), 'underground').endsWith('|underground'));
});

test('a chat with no pack, or a format 3 pack with region tables, picks exactly what it did', () => {
    const state = region => ({ domains: { director: { time: { minutes: 700 * 1440 } }, scene: { place: { name: 'X', kind: '', region }, present: [] } } });
    const none = () => null;
    const out = weatherFor(state('the lowmere'), none);
    assert.equal(out.key, weatherKey(700 * 1440, 'the lowmere'));
    assert.equal(out.text, TEMPERATE[out.season || 'any'][hashOf(out.key) % TEMPERATE[out.season || 'any'].length]);
    const three = name => (name === 'packs.weather' ? { pack: 'old', seasons: [], tables: [{ season: '', region: 'Shornmarch', weather: ['moor wind'] }] } : null);
    assert.equal(weatherFor(state('shornmarch: the moors'), three).text, 'moor wind', 'format 3 matches the region name');
    assert.equal(weatherFor(state('shornmarch: the moors'), three).key, weatherKey(700 * 1440, 'shornmarch: the moors'));
});

test('a chat in a frozen region has frozen weather; a place of its own climate, and an underground place, theirs; temperate places keep the built-in table', async t => {
    const host = await newHost(t);
    await host.send('hi', said('Start.', at('Peak Hold', 'The North')));
    assert.match(current(host).key, /\|frozen$/);
    assert.ok(all(CLIMATE_TABLES.frozen).includes(current(host).text), current(host).text);
    await host.send('go', said('Over the hill.', at('Green Well', 'The North')));
    assert.ok(all(CLIMATE_TABLES.arid).includes(current(host).text), 'the place\'s own climate');
    await host.send('go', said('Down.', at('Deep Mine', 'Midlands')));
    assert.ok(CLIMATE_TABLES.underground.includes(current(host).text));
    await host.send('go', said('Out.', at('Old Farm', 'Midlands')));
    assert.ok(all(TEMPERATE).includes(current(host).text));
    assert.doesNotMatch(current(host).key, /\|(frozen|arid|underground)$/);
});

test('the game\'s style and lines: its own lines for a climate; style "story" asks for nothing; a game swapped later does not change it', async t => {
    const own = { style: 'climate', tables: [{ climate: 'frozen', season: 'long night', weather: ['a long dark, the stars hard'] }] };
    const host = await newHost(t, [world(), game('g1', own)]);
    await host.send('hi', said('Start.', at('Peak Hold', 'The North')));
    assert.equal(current(host).text, 'a long dark, the stars hard', 'the game\'s season "Long Night" and its frozen line');
    await host.send('go', said('Down.', at('Deep Mine', 'Midlands')));
    assert.ok(CLIMATE_TABLES.underground.includes(current(host).text), 'a climate the game has no lines for: built-in');
    const story = game('g2', { style: 'story' });
    assert.equal((await host.packs.packs.install(story)).ok, true);
    assert.equal(await host.packs.packs.select('game', 'g2'), true);
    await host.send('go', said('Back.', at('Peak Hold', 'The North')));
    assert.ok(all(CLIMATE_TABLES.frozen).includes(current(host).text), 'the swapped-in game\'s style (story) moves nothing: the chat still has weather, by the built-in frozen table');
    // a chat that begins with the "story" game: the rule sets nothing
    const fresh = await newHost(t, [world(), game('g3', { style: 'story' })]);
    await fresh.send('hi', said('Start.', at('Peak Hold', 'The North')));
    assert.equal(current(fresh), undefined);
    await fresh.send('go', said('Rain.', ['~ weather cold rain']));
    assert.equal(current(fresh).text, 'cold rain', 'the narrator\'s own');
});

test('swipe, swipe back, an edited Re-read (grown and shrunk), a middle delete, a reload and a rewind give the same weather', async t => {
    const host = await newHost(t);
    await host.send('a', said('A.', at('Peak Hold', 'The North')));
    await host.send('b', said('B.', ['! time +1d']));
    await host.send('c', said('C.', at('Green Well', 'The North')));
    const live = structuredClone(current(host));
    const last = host.ctx.chat.length - 1;
    await host.swipe(said('C again.', at('Old Farm', 'Midlands')));
    assert.notEqual(current(host).key, live.key);
    await host.st.swipeTo(last, 0);
    assert.deepEqual([current(host).text, current(host).key], [live.text, live.key], 'swipe back');
    for (const body of [said('C longer.', [...at('Green Well', 'The North'), '+ coin 10 | from: Bob', '+ coin 20 | from: Bob']), said('C.', at('Green Well', 'The North'))]) {
        await host.st.editMessage(last, body);
        assert.equal((await host.sdk.reread(last)).ok, true);
        assert.deepEqual([current(host).text, current(host).key], [live.text, live.key], 'Re-read');
    }
    host.store.rebuild();
    assert.deepEqual([current(host).text, current(host).key], [live.text, live.key], 'reload');
    await host.st.deleteMessage(3);
    await host.st.deleteMessage(2);
    assert.match(current(host).key, /\|arid$/, 'a middle delete leaves the first and last replies: the place is still Green Well');
    assert.deepEqual(host.store.problems().map(({ code }) => code), []);
    await host.st.deleteMessage(1);
    await host.st.deleteMessage(0);
    await host.send('again', said('Fresh.', at('Old Farm', 'Midlands')));
    assert.ok(all(TEMPERATE).includes(current(host).text), 'a rewind to the start');
});

test('LF4-4: a place the pack does not name takes the climate of its region (the narrator\'s short name) or of the last pack place; a narrator ~ weather the same day and town stands', async t => {
    const host = await newHost(t, [{ ...world(), content: { ...world().content, regions: [...world().content.regions, { id: 'auvoth-compact', name: 'Auvoth Compact', climate: 'cold' }], places: [...world().content.places, place('market', 'Pale Market', 'auvoth-compact')] } }, game('g1')]);
    const query = (name, args) => host.sdk.query(name, args);
    assert.equal(climateOf(query, 'Guild Hall', 'auvoth'), 'cold', 'the narrator\'s "Auvoth" is the pack\'s "Auvoth Compact"');
    assert.equal(climateOf(query, 'Guild Hall', 'elsewhere'), 'temperate');
    await host.send('a', said('Market.', ['~ weather thin snow', ...at('Pale Market', 'Auvoth')]));
    const key = current(host).key;
    assert.match(key, /\|cold$/);
    await host.send('b', said('Hall.', at('Guild Grand Hall', 'Auvoth')));
    assert.equal(current(host).key, key, 'the same key at an unmapped place in the same town');
    assert.equal(current(host).text, 'thin snow', 'the narrator\'s weather is not replaced by a rule roll');
});
