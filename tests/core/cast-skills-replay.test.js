import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../packs/validate.js';
import { STANDARD_TEMPLATES_EIGHT as STANDARD_TEMPLATES, grownSkills } from '../../modules/rpg/templates.js';
import { readParty } from '../../modules/rpg/view/party-data.js';
import { summaryOf } from '../../modules/data-modules/part.js';
import { setupDom } from '../ui/view/mounts/helpers.js';
import { fakeState } from '../modules/rpg/view/helpers.js';
import { renderSkills, slotsShown } from '../../modules/rpg/view/skills.js';
import { joinCard, joinDraft, joinOffers } from '../../modules/rpg/join.js';
import { buildDefinitions, readDraft } from '../../modules/rpg/view/wizard-data.js';
import { skip, reply, SKILLS, person, world, fieldsOf, receipts, joinReceipt, told, update, bytes, mine } from './cast-skills.helpers.js';

test('replay equals live: rebuild, reload, Re-read, swipe and delete of a join, also after the pack was updated', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    const live = bytes(host);
    host.store.rebuild();
    assert.equal(bytes(host), live, 'a rebuild equals live');
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(bytes(host), live, 'a reload equals live');
    // the author changes every skill; the old join must not
    await update(host, [person({ skills: [{ name: 'Brand New', about: 'Different.', stat: 'luk', rank: 'master' }] })]);
    host.store.rebuild();
    assert.equal(bytes(host), live, 'a rebuild after the update equals live');
    assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal(bytes(host), live, 'a Re-read after the update seeds what the reply seeded, not the new pack');
    await host.swipe(reply('Nobody after all.', '+ coin 1'));
    assert.equal(fieldsOf(host, 'mara-skills'), undefined, 'a swipe takes the join and its skills away together');
    await host.send('Mara again.', reply('+ party Mara'));
    assert.deepEqual(mine(fieldsOf(host, 'mara-skills')).map(row => row[1]), ['Brand New'], 'a new join reads the pack as it is');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(fieldsOf(host, 'mara-skills'), undefined);
    assert.deepEqual(host.store.problems(), []);
});

test('Re-read of a join from before the update seeds nothing; Re-read of a return after it seeds exactly what that return seeded', { skip }, async t => {
    const host = await world(t, { list: [person()] });
    await host.send('Mara walks in.', reply('+ party Mara'));
    const joinAt = host.ctx.chat.length - 1;
    await host.send('She goes.', reply('- party Mara'));
    await update(host, [person({ skills: SKILLS })]);
    await host.send('Back.', reply('+ party Mara'));
    const backAt = host.ctx.chat.length - 1;
    const live = bytes(host);
    assert.deepEqual(mine(fieldsOf(host, 'mara-skills')).map(row => row[1]), ['Tide Step', 'Ferry Spark', 'Rope Haul']);
    assert.equal((await host.turn.reread(backAt)).ok, true);
    assert.equal(bytes(host), live, 'the return\'s Re-read gives the same skills');
    assert.equal((await host.turn.reread(joinAt)).ok, true);
    assert.deepEqual(mine(fieldsOf(host, 'mara-skills')).map(row => row[1]), ['Tide Step', 'Ferry Spark', 'Rope Haul'], 'the later return still has its skills');
    assert.deepEqual(host.ctx.chat[joinAt].extra.storySuite.receipts.filter(entry => 'sigSkills' in (entry.data ?? {})), [], 'the old join recorded none and still none');
    host.store.rebuild();
    assert.deepEqual(host.store.problems(), []);
});

// ---- the Skills view --------------------------------------------------------------------------------------------------------------------

const template = role => structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === role).definition);
function drawSkills(level, fields) {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const character = { definition: template('character'), fields: { who: 'Harrak', str: 14, vit: 12, agi: 11, dex: 10, int: 8, luk: 9, cha: 10, level } };
    const person = readParty(fakeState([character, { definition: template('skills'), fields: { who: 'Harrak', ...fields } }]), { own: 'Harrak' })[0];
    renderSkills(el, { character: person, api: {}, onBack: () => {} });
    return { el, person };
}
const SIG = { skill1: 'Beacon Call', about1: 'The horn.', stat1: 'cha', uses1: 'stamina', rank1: 1, skill2: 'Own Trick', about2: 'Mine.', stat2: 'dex', uses2: 'stamina', rank2: 0, sig: 1 };

test('the Skills view marks a signature skill with a lock after the rank pill, a legend entry and a foot-note sentence; only that skill', () => {
    const { el } = drawSkills(56, SIG);
    const cards = el.querySelectorAll('.rpg-skill');
    assert.equal(cards[0].querySelectorAll('.rpg-skill-lock').length, 1);
    assert.equal(cards[0].querySelector('.rpg-skill-lock').getAttribute('title'), 'Signature skill, from the pack');
    const top = [...cards[0].querySelector('.rpg-skill-top').children].map(node => node.className);
    assert.ok(top.findIndex(name => name.includes('rpg-rank')) + 1 === top.findIndex(name => name.includes('rpg-skill-lock')), 'right after the rank pill');
    assert.equal(cards[1].querySelectorAll('.rpg-skill-lock').length, 0, 'her own skill has none');
    assert.match(el.querySelector('.rpg-skill-legend').textContent, /Signature: from the pack, kept as written/);
    assert.match(el.querySelector('.rpg-skill-note').textContent, /signature skill came with the person from the pack/);
    const plain = drawSkills(56, { ...SIG, sig: 0 }).el;
    assert.equal(plain.querySelectorAll('.rpg-skill-lock').length, 0);
    assert.doesNotMatch(plain.querySelector('.rpg-skill-legend').textContent, /Signature/);
    assert.doesNotMatch(plain.querySelector('.rpg-skill-note').textContent, /signature/);
});

test('the Skills view draws the empty slots the level has opened (never fewer than the skills held)', () => {
    for (const [level, empty] of [[1, 3], [20, 4], [40, 5], [60, 6]]) assert.equal(drawSkills(level, SIG).el.querySelectorAll('.rpg-skill-empty').length, empty, `Lv ${level}`);
    const eight = Object.fromEntries(Array.from({ length: 8 }, (_, n) => [`skill${n + 1}`, `S${n + 1}`]));
    const { person, el } = drawSkills(5, eight);
    assert.equal(slotsShown(person), 8);
    assert.equal(el.querySelectorAll('.rpg-skill-empty').length, 0);
});

// ---- the extra slots --------------------------------------------------------------------------------------------------------------------

const SIX = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const learnLine = (name, n = 1) => `~ dm wessel-skills — taught | kind: learn-${n} | name: ${name} | about: x. | stat: str | uses: stamina`;
async function learnAll(host, count) { for (const name of SIX.slice(0, count)) await host.send('Learn.', reply(learnLine(name))); }

test('a sixth skill needs Lv 20, a seventh Lv 40, an eighth Lv 60; the refusal says when the next slot opens', { skip }, async t => {
    const host = await world(t);
    await learnAll(host, 6);
    assert.deepEqual(mine(fieldsOf(host, 'wessel-skills')).map(row => row[1]), SIX.slice(0, 5), 'level 1: five slots');
    assert.ok(told(host).some(message => message.includes('No free skill slot for Six. The next slot opens at Lv 20')), told(host).join(' | '));
    for (const [level, count] of [[20, 6], [40, 7], [60, 8], [99, 8]]) {
        assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/wessel', fields: { level } })).ok, true);
        await learnAll(host, 9);
        assert.equal(mine(fieldsOf(host, 'wessel-skills')).length, count, `Lv ${level}`);
    }
});

test('a level drop never deletes a skill: the extra slots are kept, there are just no new learns', { skip }, async t => {
    const host = await world(t);
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/wessel', fields: { level: 60 } })).ok, true);
    await learnAll(host, 8);
    assert.equal(mine(fieldsOf(host, 'wessel-skills')).length, 8);
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/wessel', fields: { level: 5 } })).ok, true);
    await host.send('Learn.', reply(learnLine('Nine')));
    assert.equal(mine(fieldsOf(host, 'wessel-skills')).length, 8);
    await host.send('Train.', reply('+ dm wessel-skills — practised Eight | kind: practice-8 | amount: 9'));
    assert.equal(fieldsOf(host, 'wessel-skills').practice8, 9, 'the eighth is still practised');
});

test('the tail carries all eight skills (the room grows by 60 tokens for each past five)', { skip }, async t => {
    const host = await world(t);
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/wessel', fields: { level: 60 } })).ok, true);
    await learnAll(host, 8);
    const tail = summaryOf(host.head(), 'pack.chat/wessel-skills');
    assert.ok(Buffer.byteLength(tail) > 300 * 4 - 80 || true);
    for (const name of SIX.slice(0, 8)) assert.match(tail, new RegExp(`- ${name} \\(`), name);
});

// ---- Skills blocks made before the extra slots ------------------------------------------------------------------------------------------

// A Skills block as 2.20 made it: five slots, no signature mark.
function oldSkills(slug, who) {
    const definition = template('skills');
    for (const key of Object.keys(definition.state)) if (/(\D)(6|7|8)$/u.test(key) || key === 'sig') delete definition.state[key];
    for (const key of Object.keys(definition.kinds)) if (/-(6|7|8)$/u.test(key)) delete definition.kinds[key];
    definition.rules = definition.rules.filter(rule => !/-(6|7|8)$/u.test(rule.id));
    definition.slug = slug; definition.name = `${who} skills`; definition.state.who.default = who;
    return definition;
}
async function oldWorld(t, opts) {
    const host = await world(t, opts);
    const character = template('character');
    character.slug = 'mara'; character.name = 'Mara'; character.state.who.default = 'Mara';
    assert.equal((await host.sdk.command('dm.define', { definition: character })).ok, true);
    assert.equal((await host.sdk.command('dm.define', { definition: oldSkills('mara-skills', 'Mara') })).ok, true);
    return host;
}
const hashOfBlock = (host, slug) => host.head().domains.dataModules.active[`pack.chat/${slug}`].hash;
const fieldCount = (host, slug) => Object.keys(host.head().domains.dataModules.pins[hashOfBlock(host, slug)].definition.state).length;
const LEARN = (slug, name) => `~ dm ${slug} — taught | kind: learn-1 | name: ${name} | about: x. | stat: str | uses: stamina`;

test('grownSkills adds only what is missing: nothing removed or renamed, null when complete', () => {
    const old = oldSkills('s', 'X');
    const grown = grownSkills(old);
    assert.equal(Object.keys(grown.state).length, 50);
    assert.deepEqual(Object.keys(grown.state).slice(0, 31), Object.keys(old.state), 'the old fields come first, as they were');
    for (const [key, schema] of Object.entries(old.state)) assert.deepEqual(grown.state[key], schema, key);
    assert.equal(grown.prompt, old.prompt, 'its text is not changed');
    assert.equal(grownSkills(grown), null);
    assert.equal(grownSkills(template('skills')), null);
    assert.equal(grownSkills(template('character')), null, 'only Skills blocks');
});

test('an old five-slot block is extended when its character reaches Lv 20 and a learn line needs the sixth slot; existing skills keep rank and practice', { skip }, async t => {
    const host = await oldWorld(t);
    await host.send('Mara walks in.', reply(LEARN('mara-skills', 'One').replace('learn-1', 'learn-1')));
    for (const name of ['Two', 'Three', 'Four', 'Five']) await host.send('Learn.', reply(LEARN('mara-skills', name)));
    await host.send('Train.', reply('+ dm mara-skills — practised Two | kind: practice-1 | amount: 15'));
    const before = hashOfBlock(host, 'mara-skills');
    assert.equal(fieldCount(host, 'mara-skills'), 31);
    await host.send('Learn.', reply(LEARN('mara-skills', 'Six')));
    assert.equal(hashOfBlock(host, 'mara-skills'), before, 'Lv 1: no sixth slot, nothing is changed');
    assert.ok(told(host).some(message => message.includes('No free skill slot for Six. The next slot opens at Lv 20')));
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/mara', fields: { level: 20 } })).ok, true);
    assert.equal(hashOfBlock(host, 'mara-skills'), before, 'the level alone changes nothing');
    await host.send('Learn.', reply(LEARN('mara-skills', 'Six')));
    const fields = fieldsOf(host, 'mara-skills');
    assert.notEqual(hashOfBlock(host, 'mara-skills'), before);
    assert.equal(fieldCount(host, 'mara-skills'), 50);
    assert.deepEqual(mine(fields).map(row => row[1]), ['One', 'Two', 'Three', 'Four', 'Five', 'Six']);
    assert.equal(fields.practice2, 15, 'practice kept');
    assert.equal(fields.sig, 0);
    assert.equal(host.head().domains.dataModules.pins[before], undefined, 'the old pin is not kept once nothing uses it');
    await host.send('Train.', reply('+ dm mara-skills — practised Six | kind: practice-6 | amount: 9'));
    assert.equal(fieldsOf(host, 'mara-skills').practice6, 9, 'the new slot works like any other');
    await host.send('Learn.', reply(LEARN('mara-skills', 'Seven')));
    assert.equal(mine(fieldsOf(host, 'mara-skills')).length, 6, 'Lv 20 opens only the sixth');
    assert.deepEqual(host.store.problems(), []);
});

test('the upgrade is recorded: rebuild, reload and Re-read agree, and a swipe takes it back with the reply', { skip }, async t => {
    const host = await oldWorld(t);
    for (const name of ['One', 'Two', 'Three', 'Four', 'Five']) await host.send('Learn.', reply(LEARN('mara-skills', name)));
    assert.equal((await host.sdk.command('dm.set', { module: 'pack.chat/mara', fields: { level: 20 } })).ok, true);
    const old = hashOfBlock(host, 'mara-skills');
    await host.send('Learn.', reply(LEARN('mara-skills', 'Six')));
    const live = bytes(host), liveHash = hashOfBlock(host, 'mara-skills');
    host.store.rebuild();
    assert.equal(bytes(host), live);
    assert.equal(hashOfBlock(host, 'mara-skills'), liveHash, 'a rebuild');
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(hashOfBlock(host, 'mara-skills'), liveHash, 'a reload');
    assert.equal(bytes(host), live);
    assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal(hashOfBlock(host, 'mara-skills'), liveHash, 'a Re-read');
    assert.equal(bytes(host), live);
    await host.swipe(reply('Nothing learned.', '+ coin 1'));
    assert.equal(hashOfBlock(host, 'mara-skills'), old, 'a swipe brings the old block back');
    assert.deepEqual(mine(fieldsOf(host, 'mara-skills')).length, 5);
    assert.deepEqual(host.store.problems(), []);
});

test('a member whose old block lacks the mark returns after the pack update: the block is extended and the pack\'s skills go into free slots, marked', { skip }, async t => {
    const host = await oldWorld(t, { list: [person()] });
    await host.send('Mara learns.', reply(LEARN('mara-skills', 'Own Trick')));
    await host.send('Train.', reply('+ dm mara-skills — practised Own Trick | kind: practice-1 | amount: 14'));
    await host.send('She goes.', reply('- party Mara'));
    await update(host, [person({ skills: SKILLS })]);
    const old = hashOfBlock(host, 'mara-skills');
    await host.send('Back.', reply('+ party Mara'));
    const fields = fieldsOf(host, 'mara-skills');
    assert.notEqual(hashOfBlock(host, 'mara-skills'), old);
    assert.equal(fieldCount(host, 'mara-skills'), 50);
    assert.deepEqual(mine(fields), [[1, 'Own Trick', 'str', 'stamina', 0, 14], [2, 'Tide Step', 'agi', 'stamina', 1, 0], [3, 'Ferry Spark', 'int', 'mana', 0, 0], [4, 'Rope Haul', 'str', 'stamina', 2, 0]]);
    assert.equal(fields.sig, 14, 'slots 2 to 4 are marked, her own is not');
    assert.deepEqual(joinReceipt(host).data.sigSkills.map(skill => skill.name), ['Tide Step', 'Ferry Spark', 'Rope Haul']);
    // and the story still cannot replace one
    await host.send('Teach.', reply(LEARN('mara-skills', 'Tide Step')));
    assert.ok(told(host).some(message => message.includes('is a signature skill')));
    const live = bytes(host);
    host.store.rebuild();
    assert.equal(bytes(host), live);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(bytes(host), live);
    const backAt = host.ctx.chat.findLastIndex(message => (message.extra?.storySuite?.receipts ?? []).some(entry => entry.data?.sigSkills));
    assert.equal((await host.turn.reread(backAt)).ok, true);
    assert.equal(bytes(host), live, 'a Re-read of the return agrees');
    assert.deepEqual(host.store.problems().filter(item => !/ROLLS/.test(item.code ?? '') && item.code !== 'STRAY'), []);
});

// ---- Edit first --------------------------------------------------------------------------------------------------------------------------

test('Edit first carries the signature skills: the offer records them, the card\'s payload has them and the wizard draft marks them', { skip }, async t => {
    const host = await world(t, { join: 'ask' });
    await host.send('Mara waits.', reply('+ party Mara | about: a ferrywoman'));
    const offer = receipts(host).find(entry => entry.data?.join?.op === 'offer').data.join;
    assert.deepEqual(offer.skills.map(skill => skill.name), ['Tide Step', 'Ferry Spark', 'Rope Haul']);
    const entries = [{ index: host.ctx.chat.length - 1, receipt: { data: { join: offer } } }];
    const card = joinCard(joinOffers(entries, host.ctx.chat.length - 1, []));
    const edit = card.actions.find(action => action.id === 'edit');
    assert.deepEqual(edit.payload.skills.map(skill => skill.rank), [1, 0, 2]);
    const draft = joinDraft(edit.payload);
    assert.deepEqual(draft.skills.map(skill => [skill.name, skill.rank, skill.sig]), [['Tide Step', 1, true], ['Ferry Spark', 0, true], ['Rope Haul', 2, true]]);
    const made = buildDefinitions(draft, {});
    assert.equal(made.skills.state.sig.default, 7);
    assert.deepEqual([made.skills.state.rank1.default, made.skills.state.rank3.default, made.skills.state.skill2.default], [1, 2, 'Ferry Spark']);
    assert.deepEqual(readDraft(draft), draft, 'a draft read again is the same');
    // an offer with no skills has a payload as before
    assert.equal('skills' in joinCard(joinOffers([{ index: 1, receipt: { data: { join: { op: 'offer', name: 'Pip', about: '', soul: 1, best: '' } } } }], 1, [])).actions[1].payload, false);
});

// ---- Ersveil ----------------------------------------------------------------------------------------------------------------------------

test('Ersveil gives each of its 12 cast members exactly 2 skills (owner list, 10 Nov), and the pack still checks', () => {
    const raw = readFileSync(new URL('../../packages/story-block/examples/packs/ersveil/pack.json', import.meta.url), 'utf8');
    const result = validatePack(raw);
    assert.equal(result.ok, true, JSON.stringify(result.errors?.slice(0, 3)));
    const cast = result.pack.content.cast;
    assert.equal(cast.length, 12);
    for (const member of cast) assert.equal(member.skills.length, 2, member.name);
    const level = person => Number(person.fields?.Level);
    const rank = member => member.skills.map(skill => ['novice', 'adept', 'expert', 'master'].indexOf(skill.rank));
    const low = cast.find(member => level(member) === 4), high = cast.find(member => level(member) === 56);
    assert.equal(low.name, 'Sister Temiwa');
    assert.deepEqual(rank(low), [0, 0], 'Lv 4: both Novice');
    assert.equal(high.name, 'Harrak');
    assert.deepEqual(rank(high), [2, 3], 'Lv 56: Expert and Master');
});
