import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../../core/registry.js';
import { assemble } from '../../../core/prompt.js';
import { LIMITS } from '../src/domain/shape.js';
import { skillSlots } from '../src/module-parts/members.js';
import { listedSkills } from '../src/module-parts/listed.js';
import { skillRows } from '../src/module-parts/sheet-skills.js';
import { tailOf } from '../src/module-parts/tail.js';
import { textRpgModule } from '../src/module.js';
import { SID, astra, sliceOf } from './helpers/fake-ctx.js';

const viewOf = (slice, chat = { lastUser: '', lastReply: '' }) => ({
    feature: id => id === 'text-rpg.on', state: { domains: { textRpg: slice } }, settings: () => ({}), chat,
    query: name => (name === 'textRpg.dice' ? slice.dice[SID] ?? null : null),
});
const many = (extra = {}, count = 18) => {
    const member = astra(extra);
    for (let at = 0; at < count; at++) member.skills.push({ name: `Craft${String.fromCharCode(65 + at)}`, about: 'x', stat: 'str', type: 'utility', cost: null, learned: at });
    return member;
};

test('skill slots are 5 and one every tenth level, 8 from level 30, and the record holds that many', () => {
    for (const [level, slots] of [[1, 5], [9, 5], [10, 6], [20, 7], [30, 8], [99, 8]]) assert.equal(skillSlots(level), slots, `level ${level}`);
    assert.equal(LIMITS.skills, skillSlots(LIMITS.levelMax));
});

test('a member with 20 skills lists the 8 most practised and a skill the last message names; the sheet row lists all', () => {
    const me = many();
    me.skills.length = 20;
    // (a fixture past the record's limit of 8 skills: none is learned, so all 20 count and the list has more to choose from than its 8)
    for (const skill of me.skills) delete skill.learned;
    me.xp = 100000;
    me.practice.crafte = 50;
    const listed = listedSkills(me, '').map(skill => skill.name);
    assert.equal(listed.length, 8);
    assert.deepEqual(listed.slice(0, 3), ['Obscure', 'Lore', 'CraftA'], 'ties: creation first, then learn order');
    assert.ok(listed.includes('CraftE'), 'the practised one');
    assert.ok(!listed.includes('CraftQ'));
    const named = listedSkills(me, 'I try craftq now.').map(skill => skill.name);
    assert.equal(named.length, 9);
    assert.ok(named.includes('CraftQ'));
    assert.ok(!listedSkills(me, 'Craftqx and Xcraftq').some(skill => skill.name === 'CraftQ'), 'whole words only');
    const slice = sliceOf([me], { list: [11, 3, 20], floor: 0 });
    const { lines } = tailOf(viewOf(slice, { lastUser: '', lastReply: 'Edda hands over a craftr token.' }));
    assert.match(lines[1], /CraftR \(/);
    assert.doesNotMatch(lines[1], /CraftQ \(/);
    assert.match(lines[0], /CraftR\+\d+/);
    assert.equal(skillRows(me).length, 20);
});

test('three such members keep the dice note whole at the module budget', () => {
    const party = ['ac_astra001', 'ac_rorke001', 'ac_edda0001'].map((id, at) => many({ id, name: ['Astra', 'Rorke', 'Edda'][at], pc: at === 0, xp: 100000 }));
    const slice = sliceOf(party, { list: [11, 3, 20], floor: 2 });
    const view = viewOf(slice, { lastUser: 'craftq', lastReply: '' });
    const { lines } = tailOf(view);
    const note = lines.find(text => text.startsWith('Dice for this reply'));
    const module = textRpgModule(null);
    const registry = createRegistry();
    const { feature, ...context } = module.context;
    registry.register({ ...module, context });
    const { tailText } = assemble({ registry, view: Object.freeze({ ...view }) });
    assert.ok(tailText.includes(note), 'the whole note');
    assert.equal(module.context.budget, 600);
});
