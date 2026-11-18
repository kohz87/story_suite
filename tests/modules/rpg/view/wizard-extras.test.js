// The New character wizard's data and its Create run (modules/rpg/view/wizard-data.js and create-run.js; the new view's wizard sends the same commands):
// reply budget (B9), the Combat rules and Foes extras, Starting level. The old window's layout cases left with the old view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../../../../modules/rpg/index.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { RPG_EXTRAS, buildDefinitions, extraDefinitions, extrasPlan, missingBlocks, newDraft, problemsOf, readDraft } from '../../../../modules/rpg/view/wizard-data.js';
import { reload } from '../../data-modules/helpers.js';
import { begin, fillBlocks, makeBlocks, page } from './page.js';
import { create, draftOf, names, rolesOf, usedReply, worldOf } from './wizard.helpers.js';

// ---- fix round 4, B9: Create asks the reply for room first -------------------------------------------------------------------------

test('B9: with 31 of the reply\'s 32 block actions used, Create stops and makes nothing (no half-made character); the problem is told in plain words', async t => {
    const ctx = await usedReply(t, 31);
    const before = names(ctx.host);
    const world = worldOf(ctx.host).world();
    assert.deepEqual(problemsOf(draftOf('Ren', 'companion'), world), ['This reply has already used 31 of its 32 block actions, and a new character needs 3. Send your next message, then try again.']);
    const done = await create(ctx.host, draftOf('Ren', 'companion'));
    assert.deepEqual(done, { ok: false, failure: '' });
    assert.deepEqual(names(ctx.host), before, 'nothing was made, not even the Character');
    assert.equal(Object.values(ctx.host.head().domains.dataModules.perReply)[0].roots, 31, 'and no action was spent');
});

test('B9: the edge: 29 used leaves exactly the three Create may need, 30 does not; a new reply has room again', async t => {
    const tight = await usedReply(t, 30);
    assert.equal(problemsOf(draftOf('Ren', 'companion'), worldOf(tight.host).world()).length, 1, '30 used');
    const edge = await usedReply(t, 29);
    assert.deepEqual(problemsOf(draftOf('Ren', 'companion'), worldOf(edge.host).world()), [], '29 used');
    const done = await create(edge.host, draftOf('Ren', 'companion'));
    assert.equal(done.ok, true);
    assert.ok(names(edge.host).includes('pack.chat/ren') && names(edge.host).includes('pack.chat/ren-skills'));
    // Three free actions are the character and its skills and the way back: the Combat rules fit after them, the Foes do not, and it is said.
    assert.ok(names(edge.host).includes('pack.chat/combat-rules') && !names(edge.host).includes('pack.chat/foes'));
    assert.equal(done.finished.startsWith('Ren is in the party. Not added: Foes. This reply has no block actions left for it.'), true, done.finished);
    // A new reply is a fresh count.
    await tight.host.send('Onward.', 'The next reply.');
    assert.deepEqual(problemsOf(draftOf('Ren', 'companion'), worldOf(tight.host).world()), [], 'the next reply');
});

test('B9: problemsOf says it when the free actions are fewer than three, and only then', () => {
    const ok = { ...newDraft({ persona: 'Wessel' }) };
    const world = { persona: 'Wessel', names: [], room: true, hasYou: false };
    assert.deepEqual(problemsOf(ok, { ...world, free: 3 }), []);
    assert.equal(problemsOf(ok, { ...world, free: 2 }).length, 1);
    assert.deepEqual(problemsOf(ok, world), [], 'without the count nothing is asked');
});

// ---- 2.9.1: Create adds the Combat rules and Foes blocks the chat lacks --------------------------------------------------------------

test('2.9.1: a chat with neither block: Create makes all four in one go, and one swipe takes them all back', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    assert.deepEqual(worldOf(ctx.host).world().extras, { add: ['rules', 'foes'], skipped: [] }, 'what the Review says it also adds');
    const done = await create(ctx.host, draftOf());
    assert.deepEqual(done, { ok: true, finished: '' }, 'everything fit');
    assert.deepEqual(rolesOf(ctx.host), ['character', 'foes', 'rules', 'skills']);
    const defines = ctx.host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).filter(receipt => receipt.type === 'dm.define');
    assert.deepEqual(defines.length, 4);
    const domain = ctx.host.head().domains.dataModules;
    assert.equal(domain.pins[domain.active['pack.chat/combat-rules'].hash].definition.prompt, STANDARD_TEMPLATES.find(entry => entry.name === 'Combat rules').definition.prompt.replace(/\s+/g, ' '), 'the stock Combat rules text (a block keeps it on one line)');
    await ctx.host.swipe('Another opening.');
    assert.deepEqual(rolesOf(ctx.host), [], 'one swipe: character, skills, Combat rules and Foes all go with the reply');
    await reload(ctx.host);
});

test('2.9.1: only the missing ones: with a Combat rules block already there Create adds the Foes alone, and with both nothing extra', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const rules = structuredClone(STANDARD_TEMPLATES.find(entry => entry.name === 'Combat rules').definition);
    rules.prompt = 'My own combat text.';
    assert.equal((await ctx.host.sdk.command('dm.define', { definition: rules })).ok, true);
    assert.deepEqual(worldOf(ctx.host).world().extras.add, ['foes']);
    assert.equal((await create(ctx.host, draftOf())).ok, true);
    assert.deepEqual(rolesOf(ctx.host), ['character', 'foes', 'rules', 'skills']);
    const domain = ctx.host.head().domains.dataModules;
    assert.equal(domain.pins[domain.active['pack.chat/combat-rules'].hash].definition.prompt, 'My own combat text.', 'the reader\'s block is left alone');
    // A second character: both blocks exist, nothing is added.
    assert.deepEqual(worldOf(ctx.host).world().extras.add, []);
    assert.equal((await create(ctx.host, draftOf('Ren', 'companion'))).ok, true);
    assert.deepEqual(rolesOf(ctx.host), ['character', 'character', 'foes', 'rules', 'skills', 'skills']);
});

test('2.9.1: no room for the extras: the character is still made, and Create says which block was not added', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    for (const who of ['Ren', 'Tamsin', 'Mira']) await makeBlocks(ctx.host, { who });
    await fillBlocks(ctx.host, 12);
    // Eighteen own blocks: two more fit (the character and its skills) and no more.
    const extras = worldOf(ctx.host).world().extras;
    assert.deepEqual([extras.add, extras.skipped.map(item => item.role)], [[], ['rules', 'foes']]);
    const done = await create(ctx.host, draftOf('Olwen', 'companion'));
    assert.equal(done.ok, true);
    assert.ok(names(ctx.host).includes('pack.chat/olwen') && names(ctx.host).includes('pack.chat/olwen-skills'), 'the character is made');
    assert.equal(rolesOf(ctx.host).includes('rules') || rolesOf(ctx.host).includes('foes'), false);
    assert.match(done.finished, /^Olwen is in the party\. Not added: Combat rules, Foes\. This story has no room for more blocks \(at most 20\)\. Settings → Blocks adds it later, and Settings → RPG adds the Combat rules block\.$/);
});

test('2.9.1: an extra block that is refused does not take the character back; it is named in plain words', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await begin(ctx.host);
    const command = (type, payload) => (type === 'dm.define' && payload.definition.slug === 'foes' ? { ok: false, code: 'DM_SCHEMA', message: 'Foes: not today; nothing applied.' } : ctx.host.sdk.command(type, payload));
    const done = await create(ctx.host, draftOf(), { command });
    assert.equal(done.ok, true);
    assert.deepEqual(rolesOf(ctx.host), ['character', 'rules', 'skills']);
    assert.match(done.finished, /^Wessel is in the party\. Not added: Foes\. .*Settings → RPG adds the Combat rules block\.$/);
});

// ---- 2.9.1: the planner and the Create run's blocks ------------------------------------------------------------------------------------

test('2.9.1: the pure planner: what is missing, in the order Combat rules then Foes, and what fits beside the two blocks of a character', () => {
    const state = (roles, { own = roles.length } = {}) => ({ domains: { dataModules: {
        active: Object.fromEntries(Array.from({ length: own }, (_, n) => [`pack.chat/b${n}`, { hash: `h${n}` }])),
        pins: Object.fromEntries(Array.from({ length: own }, (_, n) => [`h${n}`, { packId: 'chat', definition: { id: `pack.chat/b${n}`, role: roles[n] ?? null } }])) } } });
    assert.deepEqual(missingBlocks(null), ['rules', 'foes']);
    assert.deepEqual(extrasPlan(null), { add: ['rules', 'foes'], skipped: [] });
    assert.deepEqual(extraDefinitions(['rules', 'foes']).map(definition => [definition.slug, definition.role]), [['combat-rules', 'rules'], ['foes', 'foes']]);
    assert.deepEqual(extraDefinitions(['foes'], { used: ['pack.chat/foes'] }).map(definition => definition.slug), ['foes-2'], 'a taken slug is not reused');
    assert.deepEqual(extrasPlan(null, { free: 3 }), { add: ['rules'], skipped: [{ role: 'foes', why: 'actions' }] });
    assert.deepEqual(extrasPlan(null, { free: 2 }).add, []);
    assert.deepEqual(extrasPlan(null, { free: 32 }).skipped, []);
    assert.equal(RPG_EXTRAS.length, 2);
});


// ---- Levels --------------------------------------------------------------------------------------------------------------------------

test('Levels: the starting level of a draft is held 1 to 99, 1 is not stored, and the Character block gets it as its level default', () => {
    assert.equal(readDraft({ level: 120 }).level, 99);
    assert.equal(readDraft({ level: 1 }).level, undefined);
    assert.equal(readDraft({ soul: 3 }).level, 25, 'a companion\'s or an old file\'s Soul Class stands for the level 10n - 5');
    assert.equal(newDraft({ persona: 'Wessel' }).level, undefined, 'a new character starts at Level 1');
    const state = buildDefinitions({ ...newDraft({ persona: 'Wessel' }), level: 5 }, { used: [] }).character.state;
    assert.equal((state.level ?? state.soul).default, 5);
    assert.equal((buildDefinitions(newDraft({ persona: 'Wessel' }), { used: [] }).character.state.level ?? { default: 1 }).default, 1);
});

test('F13: the Starting level is held to the story\'s level cap (the setting here) in the block Create makes', async t => {
    const ctx = await page(t, { persona: 'Wessel' });
    await ctx.host.settings.set('story-block', 'rpgLevelCap', 40);
    await begin(ctx.host);
    assert.equal(worldOf(ctx.host).levelCap(), 40);
    assert.equal((await create(ctx.host, { ...draftOf(), level: 70 })).ok, true);
    const fields = ctx.host.sdk.query('dataModules.view', { module: 'pack.chat/wessel' }).chat;
    assert.equal(fields.level ?? fields.soul, 40, 'the block\'s level default is held to the cap');
});
