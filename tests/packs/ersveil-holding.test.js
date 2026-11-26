// Your Holding (Ersveil rules 1.2.0): the story founds a company, fief or powerhouse and grows it; code keeps the numbers, the tier bars and the upkeep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { world, success, reply, rebuilt, reload } from '../modules/data-modules/helpers.js';
import { grammarFor, summaryOf } from '../../modules/data-modules/part.js';
import { selectStory } from '../../ui/select/story.js';
import { validateDataModules, dataModuleHash } from '../../modules/data-modules/check.js';

const ID = 'pack.ersveil-game/holding';
const ersveil = () => JSON.parse(readFileSync(new URL('../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8'));
const KINDS = ['found', 'seat', 'recruit', 'lose', 'income', 'spend', 'renown', 'rise', 'fall', 'month'];

async function chat(t, { pinned = true } = {}) {
    const host = await world(t, ersveil());
    const offer = host.sdk.query('dataModules.offers').find(row => row.module === ID);
    if (pinned) success(await host.sdk.command('dm.pin', { module: ID, hash: offer.hash, packHash: offer.packHash }));
    await host.send('Begin.', 'A hill above the frozen lake.');
    return host;
}
const holding = host => host.sdk.query('dataModules.view', { module: ID }).chat;
const pick = (host, ...keys) => keys.map(key => holding(host)[key]);
const say = (host, ...lines) => host.send('On.', reply(...lines));
const FOUND = '+ dm holding — Founded Ravenhold | kind: found | type: fief | name: Ravenhold';
const SEAT = '~ dm holding — the palisade is up | kind: seat | at: Ravenhold | region: Bluewatch Reach';
const put = async (host, field, value) => success(await host.sdk.command('dm.set', { module: ID, field, value }));
const refusals = host => host.turn.problems().map(problem => problem.message).filter(message => message.includes('Your Holding'));

test('the founding line founds a fief at its first tier; a second found is refused and changes nothing', async t => {
    const host = await chat(t);
    assert.equal(summaryOf(host.head(), ID), 'Your Holding — not founded yet.');
    await say(host, FOUND);
    assert.deepEqual(pick(host, 'founded', 'name', 'type', 'tier', 'rank', 'retainers', 'treasury', 'renown', 'loyalty', 'upkeep'),
        [true, 'Ravenhold', 'fief', 0, 'camp', 0, 0, 0, 60, 0]);
    await say(host, '+ dm holding — again | kind: found | type: company | name: Other');
    assert.deepEqual(pick(host, 'name', 'type'), ['Ravenhold', 'fief']);
    assert.ok(refusals(host).some(message => message.includes('A holding is already founded; a story has one')), refusals(host).join());
    rebuilt(host);
});

test('no line but found works before a founding', async t => {
    const host = await chat(t);
    await say(host, SEAT, '+ dm holding — men | kind: recruit | n: 5', '+ dm holding — rise | kind: rise', '! dm holding | kind: month');
    assert.deepEqual(pick(host, 'founded', 'seat', 'retainers', 'tier'), [false, '', 0, 0]);
    assert.ok(refusals(host).some(message => message.includes('Found a holding first (kind: found)')));
    assert.ok(refusals(host).some(message => message.includes('A rise is not due: no holding is founded yet; nothing applied')), refusals(host).join('\n'));
});

test('seat, recruit, lose, income, spend and renown move their track; a move with no region clears the old one', async t => {
    const host = await chat(t);
    await say(host, FOUND);
    await say(host, SEAT, '+ dm holding — hands | kind: recruit | n: 12', '+ dm holding — toll | kind: income | gold: 80', '+ dm holding — the ford is held | kind: renown | size: great');
    assert.deepEqual(pick(host, 'seat', 'region', 'retainers', 'treasury', 'renown', 'upkeep'), ['Ravenhold', 'Bluewatch Reach', 12, 80, 10, 6]);
    await say(host, '- dm holding — fever | kind: lose | n: 2', '- dm holding — timber | kind: spend | gold: 30', '+ dm holding — a fair deal | kind: renown | size: small');
    assert.deepEqual(pick(host, 'retainers', 'treasury', 'renown', 'upkeep'), [10, 50, 13, 5]);
    await say(host, '- dm holding — too much | kind: spend | gold: 51');
    assert.equal(holding(host).treasury, 50);
    assert.ok(refusals(host).some(message => message.includes('treasury holds that much')));
    await say(host, '- dm holding — all gone | kind: lose | n: 500');
    assert.equal(holding(host).retainers, 0);
    await say(host, '~ dm holding — they move to the mill | kind: seat | at: The Old Mill');
    assert.deepEqual(pick(host, 'seat', 'region'), ['The Old Mill', '']);
    rebuilt(host);
});

test('rise is refused naming every missing bar, then only the one still short; met bars raise the tier and set the next bars', async t => {
    const host = await chat(t);
    await say(host, FOUND);
    await say(host, '+ dm holding — a rise | kind: rise');
    assert.ok(refusals(host).some(message => message.endsWith('Your Holding: A rise is not due: it needs a seat; retainers 0 of 5; treasury 0 of 20 gold; renown 0 of 5; nothing applied.')), refusals(host).join('\n'));
    await say(host, SEAT, '+ dm holding — hands | kind: recruit | n: 5', '+ dm holding — toll | kind: income | gold: 20', '+ dm holding — word | kind: renown | size: small');
    await say(host, '+ dm holding — not yet | kind: rise');
    assert.ok(refusals(host).some(message => message.endsWith('A rise is not due: renown 3 of 5; nothing applied.')), refusals(host).join('\n'));
    assert.equal(holding(host).tier, 0);
    await say(host, '+ dm holding — word | kind: renown | size: small', '+ dm holding — the oath | kind: rise');
    assert.deepEqual(pick(host, 'tier', 'rank', 'treasury', 'need-retainers', 'need-treasury', 'need-renown', 'upkeep'), [1, 'outpost', 20, 20, 100, 15, 8]);
    await say(host, '- dm holding — the wall falls | kind: fall');
    assert.deepEqual(pick(host, 'tier', 'rank', 'need-retainers'), [0, 'camp', 5]);
    await say(host, '- dm holding — further | kind: fall');
    assert.equal(holding(host).tier, 0);
    rebuilt(host);
});

test('each type has its own tier names, and the highest tier cannot rise', async t => {
    const host = await chat(t);
    await say(host, FOUND);
    const names = { company: ['camp', 'band', 'company', 'free company', 'great company', 'host'], fief: ['camp', 'outpost', 'hold', 'domain', 'great house', 'realm'], powerhouse: ['stall', 'counting room', 'house', 'trading house', 'great house', 'power'] };
    for (const [type, ranks] of Object.entries(names)) {
        await put(host, 'type', type);
        const seen = [];
        for (let tier = 0; tier < 6; tier += 1) { await put(host, 'tier', tier); seen.push(holding(host).rank); await host.send('.', 'Quiet.'); }
        assert.deepEqual(seen, ranks, type);
    }
    await say(host, '+ dm holding — higher | kind: rise');
    assert.ok(refusals(host).some(message => message.endsWith('A rise is not due: it is at the highest tier; nothing applied.')), refusals(host).join('\n'));
});

test('month pays the upkeep from the treasury; an unpaid month empties it and costs 15 loyalty, once a reply', async t => {
    const host = await chat(t);
    await say(host, FOUND);
    await say(host, '+ dm holding — hands | kind: recruit | n: 20', '+ dm holding — toll | kind: income | gold: 15');
    await say(host, '! dm holding | kind: month', '! dm holding — twice | kind: month');
    assert.deepEqual(pick(host, 'upkeep', 'treasury', 'loyalty'), [10, 5, 60]);
    await say(host, '! dm holding | kind: month');
    assert.deepEqual(pick(host, 'treasury', 'loyalty'), [0, 45]);
    await say(host, '+ dm holding — toll | kind: income | gold: 10');
    await say(host, '! dm holding | kind: month');
    assert.deepEqual(pick(host, 'treasury', 'loyalty'), [0, 45], 'exactly the upkeep is paid');
    for (let at = 0; at < 4; at += 1) await say(host, '! dm holding | kind: month');
    assert.equal(holding(host).loyalty, 0);
    rebuilt(host);
});

test('swipe, edit and reload give the same holding as live', async t => {
    const host = await chat(t);
    await say(host, FOUND);
    await say(host, SEAT, '+ dm holding — hands | kind: recruit | n: 8');
    await host.swipe(reply('Another telling.', '+ dm holding — fewer | kind: recruit | n: 3'));
    assert.deepEqual(pick(host, 'seat', 'retainers'), ['', 3]);
    await reload(host);
    const last = host.ctx.chat.length - 1;
    await host.st.editMessage(last, reply('Edited.', SEAT, '+ dm holding — more | kind: recruit | n: 9'));
    success(await host.sdk.reread(last));
    assert.deepEqual(pick(host, 'seat', 'retainers'), ['Ravenhold', 9]);
    await reload(host);
});

test('the narrator is offered all ten lines and told the holding in one line that fits its room at its longest', async t => {
    const host = await chat(t);
    const grammar = grammarFor(host.head());
    for (const kind of KINDS) assert.ok(grammar.includes(`kind: ${kind}`), kind);
    assert.ok(grammar.includes('! dm holding — reason | kind: month'));
    await say(host, FOUND);
    for (const [field, value] of [['name', 'N'.repeat(40)], ['seat', 'S'.repeat(60)], ['region', 'R'.repeat(60)], ['type', 'powerhouse'], ['tier', 4], ['retainers', 5000], ['treasury', 1000000], ['renown', 100], ['loyalty', 100]]) {
        await put(host, field, value);
        await host.send('.', 'Quiet.');
    }
    const line = summaryOf(host.head(), ID);
    assert.ok(line.endsWith('retainers 5000 of 1000; treasury 1000000 gold; renown 100; loyalty 100; upkeep 2580 gold a month; next tier needs retainers 400, treasury 3000, renown 80.'), line);
});

test('Story › Trackers shows the holding with its labels; the reader corrects numbers and names but not what code works out', async t => {
    const host = await chat(t);
    await say(host, FOUND, SEAT);
    const card = selectStory((name, args) => { try { return host.sdk.query(name, args); } catch { return null; } }).trackers.find(row => row.id === ID);
    assert.equal(card.name, 'Your Holding');
    const shown = Object.fromEntries(card.fields.map(field => [field.label, field]));
    assert.deepEqual(['Name', 'Type', 'Seat', 'Region', 'Rank', 'Loyalty', 'Treasury'].map(label => shown[label].value), ['Ravenhold', 'fief', 'Ravenhold', 'Bluewatch Reach', 'camp', '60', '0']);
    assert.deepEqual(['Name', 'Type', 'Treasury', 'Rank', 'Upkeep', 'Founded', 'Next tier: retainers'].map(label => shown[label].edit ?? null), ['text', 'choice', 'number', null, null, null, null]);
    const screen = host.sdk.query('dataModules.presentation', { kind: 'screens' }).find(entry => entry.id === 'ersveil-holding');
    assert.equal(screen.tabTitle, 'Holding');
});

test('a chat that has not turned the module on has no holding lines, state or tail', async t => {
    const host = await chat(t, { pinned: false });
    await say(host, FOUND);
    assert.equal(host.head().domains.dataModules, undefined);
    assert.equal(host.sdk.query('dataModules.holding'), null);
    assert.equal(grammarFor(host.head()), '');
});

test('the three modules of 1.1.0 keep their hashes, so chats that pinned them are not moved', () => {
    const pack = ersveil();
    const checked = validateDataModules(pack.content.dataModules, { packId: pack.id, capabilities: pack.requires.capabilities });
    assert.deepEqual(checked.definitions.slice(0, 3).map(dataModuleHash), [
        'f38d7eb4c4172982607d428a5bd6ef9cd77b720e5464a1971880cd1091d07637',
        'd3a318d545d30fca5bf418081d4b3af5ddcb3db0b91231074b86b6352bfddb89',
        '4710132dc5556be741add69b723bb3507bfbd6b63bc962ab000741168d04d5f4']);
});

test('the checker takes a kind\'s refusals only as conditions with text naming fields, and adds no empty list to a definition without them', () => {
    const check = refusals => validateDataModules([{ slug: 'c', name: 'C', schema: 1, stateVersion: 1, scope: 'chat', state: { n: { type: 'int', min: 0, max: 9, default: 0 } },
        kinds: { gain: { op: '+', labels: {}, effects: [], ...(refusals ? { refusals } : {}) } } }], { packId: 'p', capabilities: ['data-modules-v1'] });
    assert.equal(check([{ when: ['eq', ['get', ['n']], 0], text: 'n is {n}' }]).ok, true);
    for (const bad of [[{ when: ['get', ['n']], text: 'x' }], [{ when: true, text: '' }], [{ when: true, text: '{other}' }], [{ when: true, text: 'x', more: 1 }], {}]) assert.equal(check(bad).ok, false, JSON.stringify(bad));
    assert.equal(Object.hasOwn(check(null).definitions[0].kinds.gain, 'refusals'), false);
});
