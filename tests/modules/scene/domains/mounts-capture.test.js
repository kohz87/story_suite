// The party's mounts (src/v2/domains/mounts.js, feature `story-block.mounts`): pace, validator, capture and prompt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_PACE, KIND_PACE, MAX_ROWS, MOUNTS_FEATURE, WALK_PACE, mountsPace, mountsTail, paceOfKind, validateMounts,
} from '../../../../modules/scene/mounts.js';
import { initialScene, validateScene } from '../../../../modules/scene/index.js';
import { checkInvariants } from '../../../suite/qa/helpers/oracle.js';
import { MARE, block, fresh, lastIndex, names, names2, problems, staticText, tailText } from './mounts.helpers.js';

// ---------------------------------------------------------------------------------------------------
// The pace of a kind, the state's validator, the rows read from a state

test('a missing pace is the kind\'s usual one: horse 35, pony 30, camel 30, mule 25, donkey 20, ox 15, cart 18, wagon 18, else 30', () => {
    assert.deepEqual(KIND_PACE, { horse: 35, pony: 30, camel: 30, mule: 25, donkey: 20, ox: 15, cart: 18, wagon: 18 });
    for (const [kind, pace] of Object.entries(KIND_PACE)) assert.equal(paceOfKind(kind), pace, kind);
    assert.equal(paceOfKind('  Horse '), 35, 'case and spaces do not matter');
    assert.equal(paceOfKind('horses'), 35);
    assert.equal(paceOfKind('oxen'), 15);
    for (const kind of ['', 'griffin', null, undefined]) assert.equal(paceOfKind(kind), DEFAULT_PACE, String(kind));
});

test('the validator: no mounts is fine; at most six rows with a name, short texts, a count of 1 to 8 and a pace of 1 to 200', () => {
    const row = (name, over = {}) => ({ name, kind: 'horse', count: 1, pace: 35, condition: '', where: '', ...over });
    const scene = rows => ({ ...initialScene(), mounts: rows });
    assert.deepEqual(validateScene(initialScene()), [], 'older chats read as none');
    assert.deepEqual(validateMounts(scene({ 'm:a': row('A') })), []);
    assert.match(validateMounts(scene('horse')).join(' '), /not a record/);
    assert.match(validateMounts(scene({ x: 'horse' })).join(' '), /A mount is not a record/);
    assert.match(validateMounts(scene({ x: row(' ') })).join(' '), /no name/);
    assert.match(validateMounts(scene({ x: row('N'.repeat(41)) })).join(' '), /name longer than 40/);
    assert.match(validateMounts(scene({ x: row('A', { kind: 'k'.repeat(21) }) })).join(' '), /kind is longer than 20/);
    assert.match(validateMounts(scene({ x: row('A', { condition: 'c'.repeat(61) }) })).join(' '), /condition is longer than 60/);
    assert.match(validateMounts(scene({ x: row('A', { where: 'w'.repeat(81) }) })).join(' '), /where is longer than 80/);
    assert.match(validateMounts(scene({ x: row('A', { count: 0 }) })).join(' '), /count is not a whole number from 1 to 8/);
    assert.match(validateMounts(scene({ x: row('A', { count: 9 }) })).join(' '), /count is not a whole number from 1 to 8/);
    assert.match(validateMounts(scene({ x: row('A', { pace: 201 }) })).join(' '), /pace is not a whole number from 1 to 200/);
    assert.match(validateMounts(scene({ x: row('A', { pace: 1.5 }) })).join(' '), /pace/);
    assert.match(validateMounts(scene({ x: row('Mare'), y: row(' mare') })).join(' '), /twice/);
    const seven = Object.fromEntries(Array.from({ length: MAX_ROWS + 1 }, (_, n) => [`m:${n}`, row(`Mount ${n}`)]));
    assert.match(validateScene(scene(seven)).join(' '), /At most 6 mounts/);
});

test('mounts.pace worked out from rows: the slowest row, the count in all, the walk when there are too few', () => {
    const state = rows => ({ domains: { scene: { ...initialScene(), mounts: Object.fromEntries(rows.map((row, n) => [`m:${n}`, { name: 'x', kind: '', count: 1, pace: 30, condition: '', where: '', ...row }])) } } });
    assert.equal(mountsPace({ domains: { scene: initialScene() } }), null, 'no mount, no pace');
    assert.deepEqual(mountsPace(state([{ name: 'Mare', pace: 35 }, { name: 'Burr', pace: 25 }, { name: 'Cart', pace: 25 }]), 1), { pace: 25, mounts: 3, riders: 1, short: 0, slowest: 'Burr' }, 'the first of equals');
    assert.deepEqual(mountsPace(state([{ name: 'Mare', pace: 35, count: 4 }, { name: 'Ox', pace: 15, count: 1 }]), 5), { pace: 15, mounts: 5, riders: 5, short: 0, slowest: 'Ox' }, 'a group counts its animals');
    assert.deepEqual(mountsPace(state([{ name: 'Mare', pace: 35 }]), 3), { pace: WALK_PACE, mounts: 1, riders: 3, short: 2, slowest: 'Mare' }, 'short: they walk');
    assert.equal(mountsPace(state([{ name: 'Mare', pace: 35 }]), 0).riders, 1, 'at least the one rider');
    assert.equal(mountsPace(state([{ name: 'Mare', pace: 35 }]), 'many').riders, 1);
});

// ---------------------------------------------------------------------------------------------------
// Capture

test('+ mount, ~ mount, - mount: rows in story order, a missing pace from the kind, names matched without case or extra spaces', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', [MARE, '+ mount Guild remounts | kind: horse | count: 4', '+ mount Burr | kind: mule', '+ mount Old Flea']));
    assert.deepEqual(problems(host), []);
    assert.deepEqual(host.sdk.query('mounts.list'), [
        { name: 'Grey Mare', kind: 'horse', count: 1, pace: 35, condition: '', where: 'ridden by Wessel' },
        { name: 'Guild remounts', kind: 'horse', count: 4, pace: 35, condition: '', where: '' },
        { name: 'Burr', kind: 'mule', count: 1, pace: 25, condition: '', where: '' },
        { name: 'Old Flea', kind: '', count: 1, pace: 30, condition: '', where: '' },
    ]);
    const summaries = host.ctx.chat.at(-1).extra.storySuite.receipts.map(receipt => receipt.summary);
    assert.deepEqual(summaries.slice(0, 2), ['The party gets Grey Mare: horse, 35 km/day.', 'The party gets Guild remounts ×4: horse, 35 km/day.']);
    // `~` changes only what it names; the name matches without case or extra spaces.
    await host.send('Burr limps.', block('A stone.', ['~ mount  burr | condition: lame | where: stabled at the Stray Oar']));
    assert.deepEqual(problems(host), []);
    assert.deepEqual(host.sdk.query('mounts.list')[2], { name: 'Burr', kind: 'mule', count: 1, pace: 25, condition: 'lame', where: 'stabled at the Stray Oar' });
    // An empty label clears; a new kind takes its usual pace unless the line says one or the pace was set by hand.
    await host.send('Better.', block('Rested.', ['~ mount Burr | condition:', '~ mount Burr | kind: donkey', '~ mount Old Flea | kind: ox | pace: 12']));
    assert.deepEqual(host.sdk.query('mounts.list').slice(2), [
        { name: 'Burr', kind: 'donkey', count: 1, pace: 20, condition: '', where: 'stabled at the Stray Oar' },
        { name: 'Old Flea', kind: 'ox', count: 1, pace: 12, condition: '', where: '' },
    ]);
    // A `+` for a mount the party has updates it (a model repeats itself); nothing is added twice.
    await host.send('Again.', block('Again.', ['+ mount grey  MARE | where: led']));
    assert.equal(names(host).filter(name => name === 'Grey Mare').length, 1);
    assert.equal(host.sdk.query('mounts.list')[0].where, 'led');
    await host.send('Sold.', block('Sold.', ['- mount burr', '- mount Guild remounts']));
    assert.deepEqual(names(host), ['Grey Mare', 'Old Flea']);
    assert.deepEqual(problems(host), []);
});

test('hostile or odd lines: plain Problems, nothing saved on a refusal, numbers held to their range', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', [MARE]));
    const before = JSON.stringify(host.head().domains.scene);
    await host.send('Odd.', block('Odd.', [
        '~ mount Nobody | condition: lame', '- mount Nobody', '+ mount', '+ mount Wagon | count: several', '+ mount Wagon | pace: fast',
        `+ mount ${'N'.repeat(41)}`, '* mount Wagon', '+ mount Grey Mare | count: 2.5',
    ]));
    const said = problems(host).join('\n');
    assert.match(said, /no mount called Nobody/);
    assert.match(said, /mount has no name/);
    assert.match(said, /count must be a whole number/);
    assert.match(said, /pace must be a whole number/);
    assert.match(said, /name is at most 40 characters/);
    assert.equal(JSON.stringify(host.head().domains.scene), before, 'a refused line changes nothing');
    // Out of range is held, and said.
    await host.send('Big.', block('Big.', ['+ mount Herd | kind: horse | count: 12 | pace: 900', '+ mount Slug | pace: 0']));
    assert.deepEqual(host.sdk.query('mounts.list').slice(1).map(row => [row.name, row.count, row.pace]), [['Herd', 8, 200], ['Slug', 1, 1]]);
    assert.match(problems(host).join('\n'), /count was held to 8/);
    assert.match(problems(host).join('\n'), /pace was held to 200/);
    // Long and markup-laden text is one plain line, cut: the name stays plain text for every screen.
    await host.send('Long.', block('Long.', [`~ mount Herd | condition: ${'tired and sore '.repeat(10)} | where: <b>by the <i>river</i></b>\nmore`, `~ mount Slug | kind: ${'k'.repeat(40)}`]));
    const herd = host.sdk.query('mounts.list')[1];
    assert.ok(Array.from(herd.condition).length <= 60 && herd.condition.endsWith('…'), 'condition cut with an ellipsis');
    assert.ok(Array.from(herd.where).length <= 80);
    assert.equal(host.sdk.query('mounts.list')[2].kind.length, 20);
    assert.deepEqual(validateScene(host.head().domains.scene), []);
});

test('- mount for a mount the party does not have is quiet, like - present: said plainly, ok, nothing changed, not a Problem (~ mount still is one)', async t => {
    const host = await fresh(t);
    await host.send('Saddle up.', block('The yard.', [MARE]));
    const before = JSON.stringify(host.head().domains.scene);
    await host.send('Gone.', block('Gone.', ['- mount Burr', '- mount Old Flea']));
    assert.deepEqual(problems(host), [], 'no Problem');
    assert.deepEqual(host.ctx.chat.at(-1).extra.storySuite.receipts.map(receipt => [receipt.summary, receipt.narrate, receipt.data.missing]), [['Burr is not with the party.', false, true], ['Old Flea is not with the party.', false, true]]);
    assert.equal(JSON.stringify(host.head().domains.scene), before, 'nothing changed');
    assert.deepEqual(names(host), ['Grey Mare']);
    // One that is there still goes, in the same reply as one that is not.
    await host.send('Sold.', block('Sold.', ['- mount Burr', '- mount  grey mare ']));
    assert.deepEqual(problems(host), []);
    assert.deepEqual(host.ctx.chat.at(-1).extra.storySuite.receipts.map(receipt => receipt.summary), ['Burr is not with the party.', 'The party no longer has Grey Mare.']);
    assert.deepEqual(names(host), []);
    await host.send('Odd.', block('Odd.', ['~ mount Burr | condition: lame']));
    assert.match(problems(host).join('\n'), /no mount called Burr/, 'a change to a mount the party does not have is still a Problem');
    checkInvariants(host, 'after the quiet lines');
});

test('a seventh row is refused with a plain Problem; the six stay', async t => {
    const host = await fresh(t);
    await host.send('Many.', block('Many.', ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(name => `+ mount ${name} | kind: pony`)));
    assert.deepEqual(names(host), ['A', 'B', 'C', 'D', 'E', 'F']);
    assert.deepEqual(problems(host), ['"+ mount G | kind: pony" was not used: The party can keep at most 6 mounts, so G was not added.']);
    // Sold one: there is room again. An update of a mount the party has is never "a seventh".
    await host.send('Sold.', block('Sold.', ['- mount C', '+ mount G | kind: pony', '+ mount A | where: led']));
    assert.deepEqual(names(host), ['A', 'B', 'D', 'E', 'F', 'G']);
    assert.deepEqual(problems(host), []);
});

// ---------------------------------------------------------------------------------------------------
// The prompt: one grammar line, the narrator's line, off means off

test('the grammar line and the tail line: one line each, the same bytes reply to reply, none of it while the feature is off', async t => {
    const host = await fresh(t);
    assert.equal(host.features.on(MOUNTS_FEATURE), true, 'on by default');
    await host.send('On.', 'Nothing yet.');
    const on = staticText(host);
    assert.equal(on.split('\n').filter(line => line.startsWith('+ mount Name')).length, 1, 'one grammar line');
    assert.doesNotMatch(tailText(host), /Mounts:/, 'no mount, no line');
    await host.send('Saddle up.', block('The yard.', [MARE, '+ mount Guild remounts | kind: horse | count: 4', '+ mount Burr | kind: mule | condition: tired | where: led']));
    await host.send('On.', 'On.');
    assert.equal(staticText(host), on, 'the static part does not move with the mounts');
    assert.match(tailText(host), /^Mounts: Grey Mare \(horse, 35 km\/day, ridden by Wessel\); Guild remounts ×4 \(horse, 35 km\/day\); Burr \(mule, 25 km\/day, tired, led\)$/m);
    assert.equal(mountsTail({ domains: { scene: initialScene() } }), null);

    host.features.set(MOUNTS_FEATURE, false);
    await host.send('On.', block('More.', ['+ mount Pia | kind: pony']));
    const off = staticText(host);
    assert.notEqual(off, on, 'the grammar line goes once');
    assert.equal(off, on.split('\n').filter(line => !line.startsWith('+ mount Name')).join('\n'), 'and only that line');
    assert.doesNotMatch(tailText(host), /Mounts:|mount/i, 'no narrator line');
    assert.deepEqual(host.turn.problems().filter(item => item.index === lastIndex(host)).map(item => [item.code, item.quiet]), [['FEATURE_OFF', true]], 'the line written while off is quietly not used');
    assert.equal(host.sdk.query('mounts.list'), null, 'queries are off with it');
    assert.equal(host.sdk.query('mounts.pace'), null);
    assert.equal((await host.sdk.command('mounts.edit', { mount: 'Burr', condition: 'fine' })).ok, false, 'the pencil command too');
    assert.equal(names2(host).includes('Pia'), false, 'nothing was captured');
    assert.equal(Object.keys(host.head().domains.scene.mounts).length, 3, 'the rows are kept for when it is on again');
    host.features.set(MOUNTS_FEATURE, true);
    await host.send('On.', 'On.');
    assert.equal(staticText(host), on, 'back on: the old bytes');
    assert.equal(names(host).length, 3);
});

test('with no mount ever written, the scene state is exactly what it was before mounts', async t => {
    const host = await fresh(t);
    await host.send('On.', 'On.');
    assert.equal(Object.hasOwn(host.head().domains.scene, 'mounts'), false);
    assert.deepEqual(host.sdk.query('mounts.list'), []);
    assert.equal(host.sdk.query('mounts.pace'), null);
});
