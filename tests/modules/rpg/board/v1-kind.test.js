// The fight kind on the v1 engine: it opens on a v1 sheet, plays exchanges with the port's dice, settles a record the readers know and the calls that move the party's bars,
// and a fight split across replies draws the same dice as the same fight played whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { dice } from '../../../../core/interaction/dice.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { hashJson } from '../../../../core/replay.js';
import { HERO_ID, headSid, step, v1Host } from './v1.helpers.js';

const open = (host, extra = {}) => fightKind.open(host.head(), { anchor: headSid(host), seed: 4242, attempt: 0, args: { rules: {}, ...extra } });

test('a v1 sheet opens a v1 setup: the filled groups fight, no seed or dice is stored, and an empty Foes block opens nothing', async () => {
    const host = (await v1Host()).host;
    try {
        const { setup, error } = open(host);
        assert.equal(error, undefined);
        assert.equal(setup.v1, 1);
        assert.deepEqual(setup.groups, [1]);
        assert.equal(setup.offset, 0);
        assert.equal(Object.hasOwn(setup, 'seed'), false, 'the port owns the dice');
        assert.doesNotThrow(() => structuredClone(setup));
        assert.deepEqual(fightKind.actors(host.head()), [{ id: HERO_ID, name: 'Astra', party: true }]);
        const empty = (await v1Host({ count: 0 })).host;
        assert.match(open(empty).error, /no fight/i);
        empty.close();
    } finally { host.close(); }
});

test('play and settle agree, the result is the record the readers read, and the settle moves only the party\'s bars (and clears an ended fight)', async () => {
    const host = (await v1Host({ count: 1 })).host;
    try {
        const { setup } = open(host), steps = Array.from({ length: 30 }, () => step()), source = dice(4242, 0);
        const played = fightKind.play(host.head(), setup, steps, source), settled = fightKind.settle(host.head(), setup, steps, source);
        assert.deepEqual(settled.result, played.result);
        const { result } = settled;
        assert.equal(result.v, 1);
        assert.equal(result.board.v1, 1);
        assert.deepEqual(result.board.groups, [1]);
        assert.notEqual(result.stop, 'open', 'thirty exchanges end a one-rat fight');
        assert.deepEqual(result.cleared, [1]);
        for (const call of settled.changes) assert.ok(fightKind.changes.includes(call.type), `${call.type} is on the kind's list`);
        assert.ok(settled.changes.some(call => call.type === 'rpg.board.clearFoes'));
        for (const hurt of result.hurts) assert.equal(hurt.module, 'pack.chat/character');
        const bad = fightKind.validate(host.head(), setup, [], { inputs: [{ actor: HERO_ID, choice: 'item', args: { stack: 'x' } }] });
        assert.match(bad, /Choose an action/, 'items are not a v1 action');
    } finally { host.close(); }
});

test('a fight split into two segments equals the same fight played whole (dice, order, foe bars), through the real next()', async () => {
    const host = (await v1Host({ count: 4, level: 8 })).host;
    try {
        const { setup } = open(host), all = Array.from({ length: 6 }, () => step());
        const whole = fightKind.play(host.head(), setup, all, dice(4242, 0));
        assert.equal(whole.result.stop, 'open', 'the fixture fight is still open after six exchanges');
        const first = fightKind.settle(host.head(), setup, all.slice(0, 3), dice(4242, 0));
        assert.equal(first.result.stop, 'open');
        // the first segment's settle writes the party's new bars, as the core would
        const state = structuredClone(host.head());
        for (const hurt of first.result.hurts) state.domains.dataModules.instances[hurt.module].chat.fields[hurt.field] = hurt.to;
        const next = fightKind.next(structuredClone(setup), structuredClone(first.result), state);
        assert.equal(next.offset, 3);
        assert.equal(next.start.offset, 3);
        assert.deepEqual(next.carried.foes, first.result.foes);
        assert.doesNotThrow(() => structuredClone(next));
        const second = fightKind.play(state, next, all.slice(3), dice(4242, next.offset));
        assert.deepEqual([...first.result.lines, ...second.result.lines], whole.result.lines, 'the same lines, die for die');
        assert.deepEqual(second.result.foes, whole.result.foes);
        assert.deepEqual(second.result.party.map(hero => hero.hp), whole.result.party.map(hero => hero.hp));
        assert.equal(second.result.exchanges, 6);
    } finally { host.close(); }
});

test('the witness follows what the engine reads: a stat edit changes it, the HP it starts from changes it, an unrelated edit does not (gear is v1-soak.test.js)', async () => {
    const host = (await v1Host()).host;
    try {
        const { setup } = open(host), base = hashJson(fightKind.witness(host.head(), setup, []));
        const edit = (field, value) => { const state = structuredClone(host.head()); state.domains.dataModules.instances['pack.chat/character'].chat.fields[field] = value; return state; };
        assert.notEqual(hashJson(fightKind.witness(edit('str', 20), setup, [])), base, 'a stat the fight reads');
        assert.notEqual(hashJson(fightKind.witness(edit('hp', 3), setup, [])), base, 'the HP it starts from');
        assert.equal(hashJson(fightKind.witness(edit('xp', 9), setup, [])), base, 'XP is not read by the fight');
        assert.equal(readSheet(host.head()).characters[0].v1, true);
    } finally { host.close(); }
});

test('the kind\'s note is the owner-approved note golden, byte for byte, for a v1 setup', async () => {
    const { readFileSync } = await import('node:fs'), { hard, played, quiet, skirmish, skirmishChoices } = await import('../combat/note.helper.js');
    const { settledNoteV1 } = await import('../../../../modules/rpg/combat/note.js');
    const healing = [{}, {}, { Cy: { kind: 'heal', target: 'Kira' } }, {}, {}, {}];
    for (const envelope of [played(quiet(), 'a', healing), played(hard(), 'a', 12), played(skirmish(), 'a', skirmishChoices)]) {
        const told = fightKind.note({ v: 1, ...envelope }, { v1: 1 }).join(' | ');
        assert.equal(told, settledNoteV1(envelope));
        assert.ok(readFileSync(new URL('../combat/note.golden.txt', import.meta.url), 'utf8').includes(told.split(' | ').join('\n')), 'it is a paragraph of the approved golden');
    }
});

test('a pre-check opening on a v1 sheet fills a free Foes slot with its tier (no tier reads as standard) and the fight then opens on it', async () => {
    const { preludeDice } = await import('../../../../core/interaction/dice.js'), { boardChangeCommands } = await import('../../../../modules/rpg/board/changes.js');
    const host = (await v1Host({ count: 0 })).host;
    try {
        const args = { opening: { groups: [{ name: 'Wolves', count: 2, level: 6 }, { name: 'Brute', count: 1, level: 9, tier: 'elite' }], key: 'k1', rules: {}, practice: 3 } };
        const made = fightKind.open(host.head(), { anchor: 'a', seed: 5, args });
        assert.equal(made.setup.v1, 1);
        assert.equal(made.setup.opening, true);
        assert.deepEqual(fightKind.witness(host.head(), made.setup, []), { sheet: fightKind.witness(host.head(), made.setup, []).sheet }, 'an opening witnesses the sheet it reads');
        const out = fightKind.opening(host.head(), made.setup, preludeDice(5));
        assert.equal(out.result.v1, 1);
        assert.deepEqual(out.result.opened.map(placed => [placed.name, placed.count, placed.level, placed.tier]), [['Wolves', 2, 6, 'standard'], ['Brute', 1, 9, 'elite']]);
        const state = structuredClone(host.head()), handler = boardChangeCommands()[out.changes[0].type];
        handler({ draft: () => state.domains.dataModules, fail: (code, message) => { throw new Error(`${code} ${message}`); } }, out.changes[0].payload);
        const foes = readSheet(state).foes.filter(foe => foe.filled).map(foe => [foe.name, foe.count, foe.level, foe.tier]);
        assert.deepEqual(foes, [['Wolves', 2, 6, 'standard'], ['Brute', 1, 9, 'elite']], 'the Foes block holds the tiers');
        assert.equal(fightKind.open(state, { anchor: 'a', seed: 5, args: {} }).setup.groups.length, 2, 'and the fight opens on them');
        assert.deepEqual(fightKind.note(out.result, made.setup, { opening: true }).length, 1);
    } finally { host.close(); }
});
