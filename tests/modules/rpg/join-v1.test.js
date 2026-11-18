// A companion the story adds under Combat Rules v1: the blocks are v1's (WIS, HP MP SP), `best: wis` is read and `best: luk` refused, and the join replays as live across a swipe, a swipe back, an
// edited Re-read, a rebuild and a reload. A chat that already holds an earlier Character keeps building the earlier blocks for a join (and its Re-read), byte for byte as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { buildDefinitions, newDraft, readDraft } from '../../../modules/rpg/view/wizard-data.js';
import { available, skip, reply, blocks, fields, problems, rebuilt, world } from './join.helpers.js';
import { joinDefinitions, joinDraft } from '../../../modules/rpg/join.js';
import { STANDARD_PRESETS, rulesFromSettings } from '../../../modules/rpg/rules.js';

async function v1World(more = {}) {
    const host = await createHost({ settings: { modules: { 'story-block': { rpgJoin: 'auto', ...more } } } });
    host.features.set(CORE_FEATURE.leanRpg, true);
    await host.send('Begin.', 'Opening.');
    const { character, skills } = buildDefinitions(readDraft({ ...newDraft({ persona: 'Wessel' }), name: 'Wessel' }), { used: [] });
    assert.equal((await host.sdk.command('dm.define', { definition: character })).ok, true);
    assert.equal((await host.sdk.command('dm.define', { definition: skills, after: `pack.chat/${character.slug}` })).ok, true);
    return host;
}

test('a story join in a v1 chat makes v1 blocks, and replays as live (swipe, swipe back, edited Re-read, rebuild, reload)', { skip }, async t => {
    const host = await v1World();
    t.after(() => host.close());
    await host.send('Mara comes.', reply('+ party Mara | about: a hedge-witch | class: I | best: wis'));
    const mara = fields(host, 'mara');
    assert.ok(mara && 'hp' in mara && 'wis' in mara && !('luk' in mara), 'a v1 Character: HP MP SP, WIS, no LUK');
    assert.ok(mara.wis > mara.str && mara.hp === mara['hp-max'], 'the best stat is WIS and the bars start full');
    assert.deepEqual(problems(host), []);
    await rebuilt(host, 'after the join');
    const before = JSON.stringify(host.head());
    await host.swipe(reply('+ party Ren | best: str'));
    assert.equal(blocks(host).includes('pack.chat/ren'), true);
    assert.equal(blocks(host).includes('pack.chat/mara'), false);
    await rebuilt(host, 'swipe');
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(JSON.stringify(host.head()), before, 'swipe back: the state before the swipe');
    const at = host.ctx.chat.length - 1, text = host.ctx.chat[at].mes;
    await host.st.editMessage(at, text.replace('best: wis', 'best: dex'));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.ok(fields(host, 'mara').dex > fields(host, 'mara').wis, 'an edited Re-read builds the blocks again from the edited line');
    await rebuilt(host, 'edited Re-read');
    await host.st.editMessage(at, text);
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.deepEqual(fields(host, 'mara'), mara, 'Re-read shrunk back: the same Character as the first run made');
    await rebuilt(host, 'Re-read back');
});

test('best: luk is refused in a v1 chat, with the seven stats named', { skip }, async t => {
    const host = await v1World();
    t.after(() => host.close());
    await host.send('Mara comes.', reply('+ party Mara | best: luk'));
    assert.equal(blocks(host).includes('pack.chat/mara'), false);
    assert.match(host.store.problems().map(item => item.message).join('\n') + problems(host).join('\n'), /best must be one of str, vit, agi, dex, int, wis, cha/);
});

test('a second companion in a v1 chat is v1 too (a chat that holds only v1 Characters has no "old" one), the first of an empty chat brings v1 extras', { skip }, async t => {
    const host = await v1World();
    t.after(() => host.close());
    await host.send('Mara comes.', reply('+ party Mara | best: wis'));
    await host.send('Ren comes.', reply('+ party Ren | best: dex'));
    for (const who of ['mara', 'ren']) assert.ok('hp' in fields(host, who) && !('luk' in fields(host, who)), `${who} is a v1 Character`);
    await rebuilt(host, 'two companions');
    const empty = await createHost({ settings: { modules: { 'story-block': { rpgJoin: 'ask' } } } });
    t.after(() => empty.close());
    empty.features.set(CORE_FEATURE.leanRpg, true);
    await empty.send('Begin.', 'Opening.');
    assert.equal((await empty.sdk.command('dm.join', { name: 'Mara', about: '', soul: 1, best: 'wis' })).ok, true);
    const definitions = Object.values(empty.head().domains.dataModules.pins).map(pin => pin.definition);
    assert.equal(definitions.find(definition => definition.role === 'foes')?.state.tier1?.type, 'enum', 'the Foes block it brings is v1\'s (a tier on every slot)');
    assert.equal(definitions.find(definition => definition.role === 'character')?.state.wis?.type, 'int', 'and the Character is v1\'s');
});

test('a companion who joins keeps its stats under a Custom "Stats start at" above 5 (the draft starts where companionStatsV1 starts)', () => {
    const custom = n => rulesFromSettings({ rpgDifficulty: 'custom', rpgStandard: { ...STANDARD_PRESETS.standard, ...n } });
    const str = rules => joinDefinitions({ name: 'Torka', soul: 2, best: 'str' }, { rules }).character.state.str.default;
    assert.equal(str(null), 16);
    for (const n of [{ startStat: 10, createMin: 10, createMax: 20 }, { startStat: 8 }, { startStat: 3, createMin: 1 }]) assert.equal(str(custom(n)), 16, JSON.stringify(n));
    const draft = joinDraft({ name: 'Torka', soul: 2, best: 'str' }, custom({ startStat: 10, createMin: 10, createMax: 20 }));
    assert.deepEqual([draft.creation.start, draft.creation.min, draft.stats.dex], [5, 5, 12]);
});

test('under a Custom "Stats start at" of 10 a story join keeps its stats, and replays as live (swipe, swipe back, edited Re-read, rebuild, reload)', { skip }, async t => {
    const host = await v1World({ rpgDifficulty: 'custom', rpgStandard: { ...STANDARD_PRESETS.standard, startStat: 10, createMin: 10, createMax: 20 } });
    t.after(() => host.close());
    const standard = await v1World();
    t.after(() => standard.close());
    for (const world of [host, standard]) await world.send('Mara comes.', reply('+ party Mara | about: a sellsword | class: III | best: str'));
    const mara = fields(host, 'mara');
    // (the first companion's class I starts at level 1: the best stat 9, below the Custom start of 10, so it is not raised to it)
    assert.deepEqual([mara.level, mara.str, mara.dex], [1, 9, 5], 'the best stat is not held to 10');
    assert.deepEqual(['str', 'dex', 'vit'].map(k => mara[k]), ['str', 'dex', 'vit'].map(k => fields(standard, 'mara')[k]), 'the same stats as the join under Standard');
    await rebuilt(host, 'after the join');
    const before = JSON.stringify(host.head());
    await host.swipe(reply('+ party Ren | class: II | best: str'));
    await rebuilt(host, 'swipe');
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(JSON.stringify(host.head()), before, 'swipe back: the state before the swipe');
    const at = host.ctx.chat.length - 1, text = host.ctx.chat[at].mes;
    await host.st.editMessage(at, text.replace('best: str', 'best: dex'));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.ok(fields(host, 'mara').dex > fields(host, 'mara').str, 'an edited Re-read builds the companion again from the edited line');
    await rebuilt(host, 'edited Re-read');
    await host.st.editMessage(at, text);
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.deepEqual(fields(host, 'mara'), mara, 'Re-read back: the same companion as the first run made');
    await rebuilt(host, 'Re-read back');
});

test('a class I companion joins at Level 1 (best stat 9, the others 5); class II at 15, as the rules say', () => {
    const at = (soul, best) => { const draft = joinDraft({ name: 'Pell', soul, best }, null); return [draft.level ?? 1, ...['str', 'vit', 'agi', 'dex'].map(key => draft.stats[key])]; };
    assert.deepEqual(at(1, 'dex'), [1, 5, 5, 5, 9]);
    assert.deepEqual(at(2, 'str')[0], 15);
    assert.equal(joinDefinitions({ name: 'Pell', soul: 1, best: 'dex' }).character.state.level.default, 1);
});
