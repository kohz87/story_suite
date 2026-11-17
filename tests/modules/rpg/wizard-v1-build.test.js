// What the New character wizard builds is Combat Rules v1: the Character and Skills definitions pass the block checker, the bars start full and the hidden largest values with them, so
// no size rule fires on the first reply (the sheet does not move), and live = rebuild = reload. A companion who joins is built the same way; a chat that already holds an earlier Character keeps building those.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { STATS_V1 } from '../../../modules/rpg/names.js';
import { barsOf } from '../../../modules/rpg/combat/bars.js';
import { buildDefinitions, newDraft, readDraft, pointsLeft } from '../../../modules/rpg/view/wizard-data.js';
import { joinDefinitions, joinRules } from '../../../modules/rpg/join.js';
import { validateDataModules } from '../../../modules/data-modules/check.js';
import { reply, success, view, rebuilt, reload } from '../data-modules/helpers.js';
const problems = host => host.turn.problems().filter(item => !['ROLLS_SKIPPED', 'DICE_SKIPPED'].includes(item.code)).map(item => item.message);

const CHECK = { packId: 'chat', capabilities: ['data-modules-v1', 'story-director'] };
const sheet = (host, slug) => view(host, `pack.chat/${slug}`).chat;

const draftOf = () => readDraft({ ...newDraft({ persona: 'Wessel' }), about: 'A drover', stats: { str: 10, vit: 9, agi: 8, dex: 7, int: 6, wis: 5, cha: 5 },
    skills: [{ name: 'Cleave', about: 'A hard swing', stat: 'str', start: 1 }, { name: 'Mend', about: 'Closes a wound', stat: 'wis', type: 'heal' }, { name: 'Haggle', about: 'Bargains', stat: 'cha', type: 'utility' }] });

test('a new character is v1: seven stats with WIS and no LUK, HP MP SP full with their largest values, practice for the starting rank, and the budget is spent', () => {
    const draft = draftOf();
    assert.deepEqual(Object.keys(draft.stats), [...STATS_V1]);
    assert.equal(pointsLeft(draft), 10 - (10 + 9 + 8 + 7 + 6 + 5 + 5 - 35));
    const { character, skills } = buildDefinitions(draft, { used: [] });
    for (const definition of [character, skills]) assert.equal(validateDataModules([structuredClone(definition)], CHECK).ok, true);
    assert.equal(Object.hasOwn(character.state, 'luk'), false);
    assert.equal(character.state.wis.default, 5);
    const bars = barsOf(draft.stats, 1);
    for (const bar of ['hp', 'mp', 'sp']) assert.deepEqual([character.state[bar].default, character.state[`${bar}-max`].default], [bars[bar], bars[bar]]);
    assert.deepEqual([skills.state.type1.default, skills.state.type2.default, skills.state.type3.default], ['attack', 'heal', 'utility']);
    assert.deepEqual([skills.state.practice1.default, skills.state.rank1.default, skills.state.practice2.default, skills.state.rank2.default], [200, 2, 0, 0]);
    assert.equal(skills.state.stat2.default, 'wis');
});

test('a character made by the wizard keeps its sheet through a reply, a rebuild and a reload (no size or rank rule fires)', async t => {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    const { character, skills } = buildDefinitions(draftOf(), { used: [] });
    success(await host.sdk.command('dm.define', { definition: character }));
    success(await host.sdk.command('dm.define', { definition: skills }));
    const before = structuredClone(sheet(host, character.slug)), skillsBefore = structuredClone(sheet(host, skills.slug));
    await host.send('Walk on.', reply('The road is quiet.'));
    assert.deepEqual(sheet(host, character.slug), before);
    assert.deepEqual(sheet(host, skills.slug), skillsBefore);
    await host.send('Hurt.', reply(`~ dm ${character.slug} — why | kind: set-health | to: Hurt`));
    assert.ok(sheet(host, character.slug).hp < before.hp, 'the story can lower HP with a stage word');
    assert.equal(sheet(host, character.slug)['hp-max'], before['hp-max']);
    rebuilt(host);
    await reload(host);
    assert.equal(sheet(host, character.slug)['hp-max'], before['hp-max']);
});

test('a joining companion is built under v1, except in a chat that already holds an earlier Character', () => {
    const request = { name: 'Mara', about: 'a hedge-witch', soul: 1, best: 'wis' };
    const made = joinDefinitions(request, { used: [] });
    assert.deepEqual([made.character.state.wis.default, made.character.state.dex.default, made.character.state.str.default], [11, 7, 5]);   // (level 5: four points, the best stat and DEX in turn)
    assert.equal(Object.hasOwn(made.character.state, 'luk'), false);
    assert.equal(made.character.state.points.default, 0);
    assert.equal(made.character.state.hp.default, made.character.state['hp-max'].default);
    const older = joinDefinitions({ ...request, best: 'luk' }, { used: [], kind: 'standard' });
    assert.ok(older.character.state.luk.default >= 9);
    assert.equal(Object.hasOwn(older.character.state, 'hp'), false);
    const state = { domains: { dataModules: { active: {} } } };
    assert.equal(joinRules(state), 'v1');
});

test('a learn line with no type is an attack skill under v1 (the default learn type), and a typed one keeps its type', async t => {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    const { skills } = buildDefinitions(draftOf(), { used: [] });
    success(await host.sdk.command('dm.define', { definition: skills }));
    const learn = (n, extra) => `~ dm ${skills.slug} — learned | kind: learn-${n} | name: Skill ${n} | about: Something. | stat: dex${extra}`;
    await host.send('Learn.', reply(learn(4, ''), learn(5, ' | type: area')));
    const fields = sheet(host, skills.slug);
    assert.deepEqual([fields.skill4, fields.type4, fields.skill5, fields.type5], ['Skill 4', 'attack', 'Skill 5', 'area']);
    rebuilt(host);
    await reload(host);
    assert.equal(sheet(host, skills.slug).type4, 'attack');
});

test('the prompt of a v1 chat made by the wizard never says LUK, Health blocks, undefined or NaN, tells WIS, and a check on WIS is worked', async t => {
    const host = await createHost({ settings: { modules: { 'story-block': { rpgFormula: 'standard' } } } });
    t.after(() => host.close());
    host.features.set('story-block.rpg', true);
    await host.send('Begin.', 'Opening.');
    const { character, skills } = buildDefinitions(draftOf(), { used: [] });
    success(await host.sdk.command('dm.define', { definition: character }));
    success(await host.sdk.command('dm.define', { definition: skills }));
    const rules = structuredClone((await import('../../../modules/rpg/templates.js')).CHOOSER_TEMPLATES.find(entry => entry.definition.role === 'rules').definition);
    success(await host.sdk.command('dm.define', { definition: rules }));
    success(await host.sdk.command('dm.define', { definition: structuredClone((await import('../../../modules/rpg/templates.js')).CHOOSER_TEMPLATES.find(entry => entry.definition.role === 'foes').definition) }));
    const quiet = await host.send('I look around.', 'A quiet street.');
    const prompts = request => request.chat.map(message => message.content).join('\n');
    const first = prompts(quiet.request);
    assert.match(first, /WIS/, 'the stat list the narrator is told has WIS');
    assert.doesNotMatch(first, /LUK|\bluk\b|undefined|NaN|Health \d+ blocks/, 'no leftover of the earlier rules');
    const rolled = await host.send('I read the room.', reply('? roll Wessel | WIS | normal', '? roll Wessel | Cleave | normal'));
    const checks = host.ctx.chat.at(-1).extra.storySuite.receipts.filter(receipt => receipt.type === 'rpg.check');
    assert.equal(checks.length, 1, 'the check step ran (a v1 sheet has no Soul Class: the witness it hashes must not hold an undefined)');
    assert.equal(checks[0].data.v2.result.practice.skills[0].skill, 'Cleave', 'and the Cleave check gave its skill its practice');
    assert.doesNotMatch(prompts(rolled.request), /LUK|undefined|NaN/);
    const fight = await host.send('Wolves!', reply('+ dm foes — they come | kind: set-slot-1 | name: Wolves | count: 2 | level: 3 | tier: standard'));
    assert.doesNotMatch(prompts(fight.request), /LUK|undefined|NaN/);
    const next = await host.send('I strike.', 'Steel rings.');
    const text = prompts(next.request);
    assert.doesNotMatch(text, /LUK|\bluk\b|undefined|NaN|Health \d+ blocks/);
    assert.match(text, /No Plot Armor/, 'a fight stands (the Foes slot is filled): the Combat rules text is told');
    assert.deepEqual(problems(host).filter(message => /hash|not run/.test(message)), [], 'no step failed');
});

test('a pack skill set or cast skill that names LUK is built with WIS (the earlier pack still loads), and an earlier chat keeps LUK', () => {
    const draft = readDraft({ ...newDraft({ persona: 'Wessel' }), skills: [{ name: 'Gamble', about: 'x', stat: 'luk' }] });
    assert.equal(draft.skills[0].stat, 'wis');
    assert.equal(buildDefinitions(draft, { used: [] }).skills.state.stat1.default, 'wis');
    const earlier = readDraft({ standard: true, skills: [{ name: 'Gamble', about: 'x', stat: 'luk' }] });
    assert.equal(earlier.skills[0].stat, 'luk');
});
