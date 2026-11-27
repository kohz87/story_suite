// The hidden `join` field of a world cast entry: the pack check, the dossier (castFrom.join), the narrator's line (only while the person is
// not in the party) and the reader's views, none of which show it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWorldCast } from '../../packs/validate/world-pack-parts/cast-world.js';
import { buildInjection, createNpcRecord, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { injectionOptionalFields } from '../../modules/people/core/core-injection-parts-parts/optional-fields.js';
import { JOIN_LINE, hideJoinLines } from '../../modules/people/core/core-injection-parts-parts/join-line.js';
import { applyCastEntry, castView, linkToCast, normalizeCast } from '../../modules/people/dossier/cast-dossier.js';
import { peopleQueries } from '../../modules/people/domain/queries.js';
import { dossierFields } from '../../modules/people/adapter/queries-dossier.js';
import { redactSentOf, sentText } from '../../core/sent/sent.js';
import { suite } from './helpers/pacing-suite.js';
import { CORE_FEATURE } from '../../core/features.js';
import { make } from '../modules/rpg/join.helpers.js';

// The runtime reads the host's stubs when it loads.
globalThis.__npcMock ??= { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { createInjectionPart } = await import('../../modules/people/runtime/runtime-injection.js');

const WORDS = 'once You (and no one else); keep her secret: the lighthouse oath';
const entry = (extra = {}) => ({ kind: 'companion', id: 'fenna', name: 'Fenna', role: 'Ferrywoman', history: 'Runs the night ferry.', join: WORDS, ...extra });
const [person] = normalizeCast([{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', met: { on: 0, where: 'The quay' }, entry: entry() }]);
const made = () => normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), person, { packName: 'Ersveil' }));
const present = () => ({ ...made(), id: 'npc_fenna', present: true });
const inject = (npc, options = {}, budget) => buildInjection([npc], 'Fenna ties up the ferry.', 1, 3, undefined, budget, null, options);

function check(join) {
    const warnings = [];
    const other = { kind: 'figure', id: 'orrin', name: 'Orrin' };
    const kept = checkWorldCast([entry({ join }), other], 'ersveil', () => {}, (code, path, message) => warnings.push({ path, message }), true);
    return { kept, warnings };
}

test('the pack check keeps plain text of 1 to 400 characters and refuses that person alone otherwise', () => {
    assert.equal(check(WORDS).kept[0].join, WORDS);
    assert.equal(check('x'.repeat(400)).kept[0].join.length, 400);
    for (const bad of ['x'.repeat(401), '', 'a <b> tag', 'a {macro}', 7, ['text']]) {
        const { kept, warnings } = check(bad);
        assert.deepEqual(kept.map(one => one.id), ['orrin'], JSON.stringify(bad));
        assert.equal(warnings[0].path, 'content.cast[0].join');
        assert.match(warnings[0].message, /join must be plain text of 1 to 400 characters/);
    }
});

test('the dossier keeps the words in castFrom, through the normalizer and a later link', () => {
    assert.equal(made().castFrom.join, WORDS);
    assert.equal(normalizeNpcRecord(made()).castFrom.join, WORDS);
    assert.equal(linkToCast(createNpcRecord('Fenna', []), person).castFrom.join, WORDS);
    const [plain] = normalizeCast([{ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', met: { on: 0, where: '' }, entry: entry({ join: undefined }) }]);
    assert.equal(Object.hasOwn(applyCastEntry(createNpcRecord('Fenna', []), plain).castFrom, 'join'), false);
});

test('the narrator is told once while the person is not in the party, and not once they are', () => {
    const text = inject(present());
    assert.equal(text.split(JOIN_LINE(WORDS)).length, 2, text);
    assert.ok(text.indexOf('background: Runs the night ferry.') < text.indexOf('would join the party:'), 'after background');
    assert.ok(!inject(present(), { partyIds: new Set(['npc_fenna']) }).includes('would join'));
    assert.ok(inject(present(), { partyIds: new Set(['npc_other']) }).includes(JOIN_LINE(WORDS)));
    assert.ok(!injectionOptionalFields(present()).includes(JOIN_LINE(WORDS)), 'not one of the fields shared out in turns');
});

test('under a shrinking budget the line goes whole, before the essentials and no later than the background', () => {
    const npc = { ...present(), memories: Array.from({ length: 5 }, (_, i) => `${i} ${'remembers the flood '.repeat(8)}`), personality: 'Stubborn and kind. '.repeat(40) };
    let without = 0;
    for (let budget = 1800; budget >= 100; budget -= 50) {
        const text = inject(npc, {}, budget);
        assert.match(text, /- Fenna: IDENTITY/, String(budget));
        if (text.includes('would join')) assert.ok(text.includes(JOIN_LINE(WORDS)), `${budget}: ${text}`);
        else without += 1;
    }
    assert.ok(without > 0, 'some budget leaves it out');
});

test('the line takes no room from another person: a sparse dossier ranked first does not cost the next one their appearance', () => {
    const ann = { ...createNpcRecord('Ann', []), id: 'npc_ann', present: true, castFrom: { join: 'j'.repeat(400) } };
    const bea = { ...createNpcRecord('Bea', []), id: 'npc_bea', present: true, appearance: 'tall, grey-eyed and weathered; '.repeat(6), location: 'the north quay' };
    const send = (options, budget) => buildInjection([ann, bea], 'Ann waves. Bea waits.', 1, 3, undefined, budget, null, { includeAppearance: true, ...options });
    for (let budget = 512; budget <= 900; budget += 4) {
        const text = send({}, budget);
        const without = send({ partyIds: new Set(['npc_ann']) }, budget);
        const rows = text.split('\n');
        const [a, b] = ['- Ann:', '- Bea:'].map(lead => rows.findIndex(row => row.startsWith(lead)));
        assert.ok(a >= 0 && a < b, `${budget}: ${text}`);
        assert.equal(rows[b], without.split('\n').find(row => row.startsWith('- Bea:')), `${budget}: Bea's line`);
        assert.equal(text.replace(`; ${JOIN_LINE('j'.repeat(400))}`, ''), without, `${budget}: only the whole line differs`);
    }
    assert.match(send({}, 512).split('\n').find(row => row.startsWith('- Bea:')), /APPEARANCE/);
});

test('the dossier queries, the cast block and "What\'s sent" never carry the words', () => {
    const npc = present();
    const state = { domains: { people: { npcs: { npc_fenna: npc }, order: ['npc_fenna'] } } };
    const queries = peopleQueries('people');
    for (const view of [queries['people.dossier'](state, { id: 'npc_fenna' }), queries['people.list'](state, {}), dossierFields(npc), castView(npc, person)]) {
        assert.ok(!JSON.stringify(view).includes('lighthouse'), JSON.stringify(view));
    }
    const sent = inject(npc);
    assert.ok(sent.includes('lighthouse'));
    const shown = hideJoinLines(sent);
    assert.ok(!shown.includes('lighthouse') && !shown.includes('would join'), shown);
    assert.match(shown, /background: Runs the night ferry\./);
    const registry = { module: () => ({ hooks: { redactSent: hideJoinLines } }) };
    assert.ok(!sentText([], [{ module: 'people', label: 'NPC State', text: sent }], { redact: redactSentOf(registry) }).copy.includes('lighthouse'));
});

test('a line cut short by a budget is still hidden, and the lines after it stay', () => {
    const line = `- Fenna: x; ${JOIN_LINE(WORDS)}`;
    assert.equal(hideJoinLines(`${line}\n- Orrin: y`), '- Fenna: x\n- Orrin: y');
    assert.equal(hideJoinLines(`${line.slice(0, line.indexOf('lighthouse') + 5)}…\n- Orrin: y`), '- Fenna: x\n- Orrin: y');
});

test('the sent dossier asks `party.levels` who is in the party: a member goes without the line, one who left keeps it', () => {
    const settings = { injectLimit: 3, injectBudgetTokens: 1800 };
    const liveText = levels => createInjectionPart({}, {
        awayReturnNotes: () => null, scenePresenceView: npcs => npcs, hostedMeterView: npcs => npcs,
        adapterMeters: () => (levels === undefined ? null : { partyLevelsAnswer: () => levels }),
    }).liveInjectionText({ npcs: [present()], turn: 1 }, settings, { namedNpcIds: [], transcript: 'Fenna ties up the ferry.' });
    assert.ok(liveText(undefined).includes('would join'), 'no host');
    assert.ok(liveText(null).includes('would join'), 'the RPG off');
    assert.ok(liveText([{ name: 'Orrin', left: false }]).includes('would join'));
    assert.ok(liveText([{ name: 'Fenna', left: true }]).includes('would join'));
    assert.ok(!liveText([{ name: 'fenna', left: false }]).includes('would join'));
    // The diagnostics dialog reads the last sent text through `injectionPreview`.
    const preview = createInjectionPart({ lastInjection: { text: liveText(null) } }, { getChatKey: () => 'no-chat' }).injectionPreview();
    assert.ok(preview.sending && !preview.text.includes('lighthouse'), preview.text);
});

test('while the reply where they joined is rerolled, the party is read as of the reply before, so the line is back', () => {
    const chat = [{ mes: 'On.' }, { is_user: true, mes: 'Join us?' }, { mes: 'Fenna joins.' }];
    const was = globalThis.__npcMock.context;
    globalThis.__npcMock.context = { chat };
    try {
        let asOf = null;
        const adapter = {
            partyLevelsAnswer: () => (asOf === null ? [{ name: 'Fenna', left: false }] : []),
            at: (index, read) => { asOf = index; try { return read(); } finally { asOf = null; } },
        };
        const send = replacingReply => createInjectionPart({ replacingReply }, {
            awayReturnNotes: () => null, scenePresenceView: npcs => npcs, hostedMeterView: npcs => npcs, adapterMeters: () => adapter, getChatKey: () => 'chat-1',
        }).liveInjectionText({ npcs: [present()], turn: 1 }, { injectLimit: 3, injectBudgetTokens: 1800 }, { namedNpcIds: [], transcript: 'Fenna ties up the ferry.' });
        assert.ok(!send(null).includes('would join'));
        assert.ok(send({ key: 'chat-1', message: chat[2] }).includes('would join'));
        assert.ok(!send({ key: 'another-chat', message: chat[2] }).includes('would join'));
    } finally { globalThis.__npcMock.context = was; }
});

test('ordinary text that only looks like the join line is shown as it is', () => {
    for (const text of [
        '- A: IDENTITY x; background: She would join the party: that sails north; goal: y\n- B: z',
        '- A: IDENTITY x; memories: would join the party: if asked; location: the quay',
        '- A: IDENTITY x; background: She would join the party: that sails…\n- B: z',
    ]) assert.equal(hideJoinLines(text), text);
});

// The real store, the real RPG's `party.levels` and the production adapter's own `at` and `partyLevelsAnswer`. Fenna joins as a Character
// made by `dm.define`, which is stored on the latest reply.
async function rerolled(arrange) {
    const s = await suite({ records: {} });
    const was = globalThis.__npcMock.context;
    try {
        s.host.features.set(CORE_FEATURE.leanRpg, true);
        await arrange(s);
        const chat = s.host.ctx.chat;
        globalThis.__npcMock.context = { chat };
        const send = replacingReply => createInjectionPart({ replacingReply }, {
            awayReturnNotes: () => null, scenePresenceView: npcs => npcs, hostedMeterView: npcs => npcs, adapterMeters: () => s.adapter, getChatKey: () => 'chat-1',
        }).liveInjectionText({ npcs: [present()], turn: 1 }, { injectLimit: 3, injectBudgetTokens: 1800 }, { namedNpcIds: [], transcript: 'Fenna ties up the ferry.' });
        return { chat, head: send(null).includes('would join'), reroll: send({ key: 'chat-1', message: chat.at(-1) }).includes('would join') };
    } finally { globalThis.__npcMock.context = was; s.host.close(); }
}

test('real store: a join in a hidden reply before the rerolled one still counts', async () => {
    const result = await rerolled(async s => {
        await s.say([]);
        await make(s.host, 'Fenna');
        s.host.ctx.chat.at(-1).is_system = true;
        await s.say([]);
    });
    assert.equal(result.head, false, 'the head lists Fenna');
    assert.equal(result.reroll, false, 'so does the reroll');
});

test('real store: with no earlier reply, the rerolled reply\'s own join does not count', async () => {
    const result = await rerolled(async s => {
        s.host.ctx.chat.length = 0;
        await s.say([]);
        await make(s.host, 'Fenna');
    });
    assert.deepEqual(result.chat.map(message => Boolean(message.is_user)), [true, false]);
    assert.equal(result.head, false, 'the head lists Fenna');
    assert.equal(result.reroll, true);
});

test('a rerolled first message has an empty party, and no dossier with join words means no party query', () => {
    const chat = [{ mes: 'Fenna is aboard.' }];
    const was = globalThis.__npcMock.context;
    globalThis.__npcMock.context = { chat };
    try {
        let asked = 0;
        const adapter = { partyLevelsAnswer: () => { asked += 1; return [{ name: 'Fenna', left: false }]; }, at: () => assert.fail('nothing precedes the first message') };
        const send = (npc, replacingReply) => createInjectionPart({ replacingReply }, {
            awayReturnNotes: () => null, scenePresenceView: npcs => npcs, hostedMeterView: npcs => npcs, adapterMeters: () => adapter, getChatKey: () => 'chat-1',
        }).liveInjectionText({ npcs: [npc], turn: 1 }, { injectLimit: 3, injectBudgetTokens: 1800 }, { namedNpcIds: [], transcript: 'Fenna ties up the ferry.' });
        assert.ok(send(present(), { key: 'chat-1', message: chat[0] }).includes('would join'));
        assert.equal(asked, 0);
        send({ ...present(), castFrom: { key: 'ersveil:fenna' } }, null);
        assert.equal(asked, 0);
        send(present(), null);
        assert.equal(asked, 1);
    } finally { globalThis.__npcMock.context = was; }
});

test('replay == live: a dossier made inside a reply keeps the words through a rebuild, and a swipe and a swipe back', async () => {
    const raw = entry({ id: 'torka', name: 'Torka' });
    const cast = {
        id: 'story-director', name: 'Story Director stand-in (cast)', domains: { zzcast: { initial: () => ({}) } },
        queries: { 'director.cast': () => [{ key: 'ersveil:torka', pack: 'ersveil', id: 'torka', name: 'Torka', aliases: [], met: { on: null, where: 'The quay' }, alive: true, entry: structuredClone(raw) }] },
    };
    const s = await suite({ lines: true, modules: [cast], records: {} });
    const people = () => s.host.head().domains.people;
    const kept = () => Object.values(people().npcs).find(npc => npc.name === 'Torka')?.castFrom.join;
    await s.say(['~ npc Torka | goal: mend the ferry']);
    const at = s.host.store.headIndex();
    const live = JSON.stringify(people());
    assert.equal(kept(), WORDS);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(people()), live, 'a rebuild');
    await s.swipe(['~ npc Torka | goal: sell the ferry']);
    assert.equal(kept(), WORDS, 'another swipe');
    await s.host.st.swipeTo(at, 0);
    assert.equal(JSON.stringify(people()), live, 'swipe back');
});

test('words that quote the instruction itself are hidden whole, in What\'s sent and in the diagnostics preview', () => {
    // the deep review's own words, then a shorter case of them
    const reviewed = 'After the scout says (keep this to yourself; let it come about through the story, never say it outright), retrieve the captain’s stolen seal.';
    assert.equal(check(reviewed).kept[0].join, reviewed);
    const seen = hideJoinLines(inject({ ...present(), castFrom: { ...present().castFrom, join: reviewed } }));
    assert.ok(!/scout|stolen seal|would join/.test(seen), seen);
    const KEEP = '(keep this to yourself; let it come about through the story, never say it outright)';
    const tricky = `someone says ${KEEP} and then You find the drowned bell`;
    assert.equal(check(tricky).kept[0].join, tricky, 'the pack check keeps it');
    const npc = { ...present(), castFrom: { ...present().castFrom, join: tricky } };
    const sent = `${inject(npc)}\n- Orrin: y`;
    assert.ok(sent.includes('drowned bell'));
    const shown = hideJoinLines(sent);
    assert.ok(!/drowned bell|would join|keep this to yourself/.test(shown), shown);
    assert.match(shown, /background: Runs the night ferry\.[\s\S]*\n- Orrin: y$/);
    const preview = createInjectionPart({ lastInjection: { text: sent } }, { getChatKey: () => 'no-chat' }).injectionPreview();
    assert.ok(!preview.text.includes('drowned bell'), preview.text);
    // cut short by a budget after the quoted words, the rest of the line goes too
    const line = `- Fenna: x; ${JOIN_LINE(tricky)}`;
    assert.equal(hideJoinLines(`${line.slice(0, line.indexOf('drowned') + 12)}…\n- Orrin: y`), '- Fenna: x\n- Orrin: y');
});
