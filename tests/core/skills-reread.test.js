// Skills blocks and the Re-read (SK-FIX222): a Re-read of a reply made before the extra skill slots and the signature mark (the chats in tests/v2/fixtures/skills-2210-*.json
// were written by Story Block 2.21.0) builds what that reply built, so every later change of the block still applies; a Re-read of a 2.22 join seeds what the join seeded
// (the pencil on the reply changes nothing); a block grows only when a learn line would otherwise have no slot; and the follow-ups of the review (Ask mode, character
// files after a level drop, the tail's room, the refusal words).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost, hostAvailable } from '../../testkit/index.js';
import { validatePack } from '../../packs/validate.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../modules/rpg/templates.js';
import { skillSlots } from '../../core/runtime/skill-slots.js';
import { partyLines } from '../../modules/rpg/view/changes-lines.js';
import { joinCard, joinDraft, joinOffers } from '../../modules/rpg/join.js';
import { buildDefinitions, draftSlots, readDraft, withImport, withSet, withSkill, withSkillPatch, withoutSkill } from '../../modules/rpg/view/wizard-data.js';
import { buildCharacterFile, parseCharacterFile } from '../../modules/rpg/charfile.js';
import { summaryOf, tailRoom } from '../../modules/data-modules/part.js';
import { DM_LIMITS } from '../../modules/data-modules/schema.js';
import { estimateTokens } from '../../core/prompt.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const reply = (...lines) => `The tide turns.\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const SKILLS = [
    { name: 'Tide Step', about: 'Light footwork on a rocking deck.', stat: 'agi', rank: 'adept' },
    { name: 'Ferry Spark', about: 'A small lantern-flash of magic.', stat: 'int', uses: 'mana' },
    { name: 'Rope Haul', about: 'Hauls a line hand over hand.', stat: 'str', uses: 'stamina', rank: 'expert' },
];
const person = (extra = {}) => ({ id: 'mara', name: 'Mara', aliases: [], about: 'Runs the night ferry.', look: 'Wiry.', start: { place: 'Docks', goal: 'Keep the ferry running.' }, ...extra });
const rawPack = list => ({ id: 'mini', version: '1.0.0', requires: { storyBlock: '^2' }, content: { cast: list } });
const settingsFor = (list, { join = 'auto', formula = 'standard' } = {}) => {
    const raw = rawPack(list);
    const built = validatePack(raw);
    assert.equal(built.ok, true, JSON.stringify(built.errors));
    return { features: { 'story-block.rpg': true }, modules: { 'story-block': { rpgJoin: join } },
        packs: [{ id: built.pack.id, version: built.pack.version, enabled: true, source: 'file', origin: 'test', pack: raw }] };
};
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
// A chat written by 2.21.0, opened here. `skills`: the pack now gives Mara signature skills (it did not when the chat was written).
async function opened(t, name, { skills = false, formula = 'standard' } = {}) {
    t.mock.method(console, 'warn', () => {});
    const saved = fixture(name);
    const host = await createHost({ st: { chatMetadata: saved.metadata ?? {} }, settings: settingsFor([person(skills ? { skills: SKILLS } : {})], { formula }) });
    t.after(() => host.close());
    await host.st.loadChat(saved.chat);
    return { host, saved };
}
const dm = host => host.head().domains.dataModules;
const fieldsOf = (host, slug) => dm(host).instances[`pack.chat/${slug}`]?.chat.fields;
const pinOf = (host, slug) => dm(host).active[`pack.chat/${slug}`]?.hash;
const told = host => host.turn.problems().map(problem => problem.message);
const snapshot = (host, slug) => JSON.stringify([fieldsOf(host, slug), pinOf(host, slug)]);
const receiptsAt = (host, index) => host.ctx.chat[index].extra.storySuite.receipts;

// ---- B1, B2: a reply made before the extra slots, read again ------------------------------------------------------------------------------------

// ---- B3: the pencil on a join reply ----------------------------------------------------------------------------------------------------------------

async function world(t, { list = [person({ skills: SKILLS })], join = 'auto' } = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: settingsFor(list, { join }) });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = 'wessel'; defs.character.name = 'Wessel'; defs.character.state.who.default = 'Wessel';
    defs.skills.slug = 'wessel-skills'; defs.skills.name = 'Wessel skills'; defs.skills.state.who.default = 'Wessel';
    for (const definition of [defs.character, defs.skills]) assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    return host;
}

// ---- B4: growth only when a learn line would have no slot -----------------------------------------------------------------------------------------

// ---- F1: Ask mode ---------------------------------------------------------------------------------------------------------------------------------

test('F1: a Re-read of the offer reply keeps the offered skills', { skip }, async t => {
    const host = await world(t, { join: 'ask' });
    await host.send('Mara waits.', reply('+ party Mara | about: a ferrywoman'));
    const at = host.ctx.chat.length - 1;
    const offered = () => receiptsAt(host, at).find(entry => entry.data?.join?.op === 'offer').data.join;
    assert.deepEqual(offered().skills.map(skill => skill.name), ['Tide Step', 'Ferry Spark', 'Rope Haul']);
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.deepEqual(offered().skills.map(skill => skill.name), ['Tide Step', 'Ferry Spark', 'Rope Haul'], 'still offered after the Re-read');
    assert.deepEqual(offered().skills.map(skill => skill.rank), [1, 0, 2]);
});

test('F1: Edit first keeps signature skills as written (the pencil\'s rules) and the Skills block it makes writes the join\'s tiles', { skip }, async t => {
    const host = await world(t, { join: 'ask' });
    await host.send('Mara waits.', reply('+ party Mara | about: a ferrywoman'));
    const at = host.ctx.chat.length - 1;
    const offer = receiptsAt(host, at).find(entry => entry.data?.join?.op === 'offer').data.join;
    const card = joinCard(joinOffers([{ index: at, receipt: { data: { join: offer } } }], at, []));
    let draft = joinDraft(card.actions.find(action => action.id === 'edit').payload);
    // stat, resource and rank cannot be changed, a skill cannot be taken out; the name and what it does can be fixed
    const changed = withSkillPatch(draft, 0, { stat: 'str', uses: 'mana', start: 1, rank: 3, name: 'Tide Dance', about: 'Better words.' });
    assert.deepEqual([changed.skills[0].stat, changed.skills[0].uses, changed.skills[0].rank, changed.skills[0].sig], ['agi', 'stamina', 1, true]);
    assert.deepEqual([changed.skills[0].name, changed.skills[0].about], ['Tide Dance', 'Better words.']);
    assert.equal(withoutSkill(draft, 0).skills.length, 3, 'a signature skill stays');
    assert.equal(withSet(draft, { id: 'x', skills: [{ name: 'Spark', stat: 'int', about: 'a', uses: 'mana' }] }).skills.map(skill => skill.name).join(), 'Tide Step,Ferry Spark,Rope Haul,Spark', 'a skill set goes after them');
    draft = withSkill(draft);
    assert.equal(draft.skills.length, 4, 'free slots stay for others');
    assert.equal(withoutSkill(draft, 3).skills.length, 3, 'a skill of the reader\'s own can be taken out');
    // Create: the two defines of the wizard
    const made = buildDefinitions(readDraft({ ...draft, skills: draft.skills.slice(0, 3), name: 'Mara' }), {});
    for (const definition of [made.character, made.skills]) assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    assert.equal(fieldsOf(host, made.skills.slug).sig, 7);
    const record = host.ctx.chat.at(-1).extra.storySuite;
    const tiles = partyLines(record);
    assert.deepEqual(tiles.slice(1).map(line => [line.text, line.flag]), [['Tide Step', 'signature · Adept'], ['Ferry Spark', 'signature · Novice'], ['Rope Haul', 'signature · Expert']]);
    assert.match(tiles[0].summary, /Mara joined, \+3 skills/);
});

// ---- F2: character files after a level drop ---------------------------------------------------------------------------------------------------------

test('F2: a character file keeps up to eight skills when its level has dropped below the slots they fill', () => {
    const eight = Array.from({ length: 8 }, (_, n) => ({ name: `Skill ${n + 1}`, about: 'x', stat: 'str', uses: 'stamina', rank: n % 4 }));
    const file = parseCharacterFile(JSON.stringify(buildCharacterFile({ level: 30, soul: 4, points: 0, stats: { str: 10, vit: 10, agi: 10, dex: 10, int: 10, wis: 10, cha: 10 }, skills: eight })));
    assert.equal(file.ok, true, JSON.stringify(file));
    assert.equal(file.file.skills.length, 8);
    assert.equal(skillSlots(30), 6, 'the level opens six');
    const { draft } = withImport(readDraft({ name: 'Wessel', kind: 'companion' }), file.file);
    assert.equal(draft.skills.length, 8, 'no cut to the current slots');
    assert.equal(readDraft(draft).skills.length, 8, 'a draft read again keeps them');
    assert.equal(draftSlots(readDraft(draft)), 11, 'eight combat kept and the three utility ones');
    assert.equal(withSkill(readDraft(draft)).skills.at(-1).type, 'utility', 'a new one can only be a utility skill');
    const made = buildDefinitions(readDraft(draft), {});
    assert.equal(made.skills.state.skill8.default, 'Skill 8');
    assert.equal(made.skills.state.rank7.default, 2);
    // a draft that holds fewer keeps the level's room
    assert.equal(draftSlots(readDraft({ name: 'Wessel', level: 30, skills: [] })), 9, 'the level\'s six combat slots and the three utility ones');
});

// ---- F3: the tail's room -------------------------------------------------------------------------------------------------------------------------------

// ---- F4, F7: words ---------------------------------------------------------------------------------------------------------------------------------------

test('F7: a refused line on an old block names only the learn kinds the block has, and does not extend it', { skip }, async t => {
    const { host } = await opened(t, 'skills-2210-lv30-learns.json');
    const pin = pinOf(host, 'wessel-skills');
    await host.send('Bad.', reply('~ dm wessel-skills — taught | kind: learn-9 | name: Odd | about: x. | stat: str | uses: stamina'));
    const message = told(host).find(text => text.includes('kind must be'));
    assert.ok(message, told(host).join(' | '));
    assert.match(message, /learn-5/);
    assert.doesNotMatch(message, /learn-6|learn-7|learn-8/);
    assert.equal(pinOf(host, 'wessel-skills'), pin);
    // fill the block, then a line that grows it and is then refused (a stat that is no stat) names the kinds the block had
    for (const [n, name] of [[3, 'C'], [4, 'D'], [5, 'E']]) await host.send('Learn.', reply(`~ dm wessel-skills — taught | kind: learn-${n} | name: ${name} | about: x. | stat: str | uses: stamina`));
    await host.send('Bad.', reply('~ dm wessel-skills — taught | kind: learn-6 | name: Odd | about: x. | stat: wis | uses: stamina'));
    assert.equal(pinOf(host, 'wessel-skills'), pin, 'a refused line takes its growth back');
    assert.ok(told(host).length > 0);
    assert.deepEqual(host.store.problems(), []);
});

// ---- R1, R2: the follow-ups of the re-check -------------------------------------------------------------------------------------------------------

const RETURN_SKILLS = [{ name: 'Tide Step', about: 'Footwork.', stat: 'agi', rank: 'adept' }, { name: 'Ferry Spark', about: 'Magic.', stat: 'int', uses: 'mana' }];
test('R2: a Re-read does not send a learn-6 line to a free lower slot unless the reply, as it stood, held that skill there', { skip }, async t => {
    const { host } = await opened(t, 'skills-2210-lv30-learns.json');
    // a reply of 2.21 whose learn-6 was refused (the block had five slots): its words say learn-6 and it holds no Oar Sweep
    const at = 6;
    host.ctx.chat[at].mes = host.ctx.chat[at].mes.replace('kind: learn-2 | name: Tide Step | about: Footwork.', 'kind: learn-6 | name: Oar Sweep | about: Sweeps.');
    assert.match(host.ctx.chat[at].mes, /learn-6/);
    assert.equal((await host.turn.reread(at)).ok, true);
    const fields = fieldsOf(host, 'wessel-skills');
    assert.equal(Object.keys(fields).some(key => /^skill\d$/.test(key) && fields[key] === 'Oar Sweep'), false, 'the line stays refused');
    assert.ok(told(host).some(text => text.includes('kind must be')), told(host).join(' | '));
});
