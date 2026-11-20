// LA-2: the world's own people at the scene's place reach the narrator by name (role and look, never a secret), so a scene that needs
// Bluewatch's watch-captain uses Edda Rorke and invents no double; LF4-2: the meeting's cue gives the name of the one it brings in. Ersveil
// (format 4) at its start place; a swipe sends the same line; elsewhere the line names that place's people; anyone met (this reply's meeting
// included: the cue names them) and anyone not a format 4 cast entry are left out; the list is capped; no reader-facing text names them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { HERE_MAX, hereLine } from '../../../../modules/cast/cast/note.js';
import { readEntry } from '../../../../modules/cast/cast/entries.js';
import { TAIL_KEY, sent } from './helpers.js';

const ERSVEIL = readFileSync(new URL('../../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8');
const ERSVEIL_GAME = readFileSync(new URL('../../../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8');
const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const AFTER = 'in the story says it: ';
const named = line => line.slice(line.indexOf(AFTER)).split('; ').length;
const hereOf = host => (sent(host, TAIL_KEY).at(-1) ?? '').split('\n').find(line => line.startsWith('[People here]')) ?? '';

async function ersveil() {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id),
        callModel: async () => ({ ok: false, error: 'BUSY', text: '' }), canCallModel: () => true, chat: () => host?.ctx.chat ?? [] } });
    host = await createHost({ modules: [module], settings: { features: { 'story-director.pulse': false } } });
    assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
    assert.equal((await host.packs.packs.install(ERSVEIL_GAME, { origin: 'pack.json' })).ok, true);
    return host;
}

test('LA-2 + LF4-2: the first reply at the pack\'s start place (Bluewatch Village / Guild Office): the cue names Edda Rorke, the line Sister Temiwa and Torka by role and look; no secret; Continue, swipe, chat change, rewind and a middle delete send the same; Auvoth names its own', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await ersveil();
    try {
        // A new chat with its greeting: the world pack's start puts the scene at its start place, as in the live run (no ~ place line).
        await host.st.loadChat([{ name: 'Narrator', is_user: false, is_system: false, mes: 'You arrive at the guild office.' }], 'la2');
        await host.send('I look around.', 'A clerk and a tired woman in a blue coat: Edda Rorke, the clerk says.');   // (the reply shows her: the meeting stands)
        const tail = sent(host, TAIL_KEY).at(-1);
        assert.match(tail, /^Place: Bluewatch Village \/ Guild Office/m, 'the start place, from the pack');
        assert.match(tail, /^\[Cast\] a stranger comes into the scene in this reply; their name is Watch-Captain Edda Rorke\./m, 'LF4-2: the meeting cue gives the canon name');
        const line = hereOf(host);
        assert.match(line, /^\[People here\] The world's own people at this place or nearby, not necessarily in the scene\./);
        assert.match(line, /use that person by this name rather than making up someone new; the narration uses a name only after someone in the story says it: /, 'one instruction, for any persona name');
        assert.doesNotMatch(line, /\{\{user\}\}|You knows/);
        assert.match(line, /Sister Temiwa, Bluewatch's healer-sealer/);
        assert.match(line, /Torka/);
        assert.doesNotMatch(line, /Edda Rorke/, 'the one this reply meets is named by the cue, not twice');
        assert.doesNotMatch(line, /log blank|Watchhouse log|Saintess Livia|Laan/, 'no secret, nobody from elsewhere');
        assert.equal(named(line), 2, 'Temiwa and Torka');
        // Prompt-only: no receipt, card note or Problem names an unmet person.
        const shown = JSON.stringify([host.sdk.receipts().map(entry => entry.receipt.summary ?? ''), host.turn.problems(), host.head().domains.cast?.notes ?? {}]);
        assert.doesNotMatch(shown, /Temiwa|Torka/, 'nothing a reader sees names the unmet');
        await host.cont(' She nods.');
        assert.equal(hereOf(host), line, 'a Continue is told the same people');
        await host.swipe('A clerk and a tired woman in a blue coat, again: Edda Rorke.');
        assert.equal(hereOf(host), line, 'a swipe of the reply is told the same people');
        const saved = structuredClone(host.ctx.chat);
        await host.st.loadChat([], 'other');
        await host.st.loadChat(structuredClone(saved), 'la2');
        await host.regenerate('After a chat change and back, Edda Rorke.');
        assert.equal(hereOf(host), line, 'a chat change and back (a reload) is told the same people');
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.send('I look around.', 'Rewound and said again: Edda Rorke.');
        assert.equal(hereOf(host), line, 'a rewind and the same message again is told the same people');
        await host.send('I wait.', 'Time passes.');
        await host.st.deleteMessage(1);
        await host.send('I look again.', 'The office.');
        assert.match(hereOf(host), /Sister Temiwa.*Torka/, 'after a middle delete the people of the place are still named');
        await host.send('I walk to Auvoth.', said('Days of road.', ['~ place Auvoth | kind: city', '! time +4d']));
        await host.send('I look around.', 'Auvoth.');
        const there = (sent(host, TAIL_KEY).at(-1) ?? '').split('\n').filter(line => /^\[(People here|Cast)\]/.test(line)).join('\n');
        assert.doesNotMatch(there, /Edda Rorke|Temiwa/, 'Bluewatch\'s people stay at Bluewatch');
        assert.match(there, /Laan/, 'Auvoth\'s guildmaster is named there (by the line, or by the cue of a meeting with her)');
    } finally {
        host.close();
    }
});

test('the line itself: only format 4 cast at the place, anyone met is left out (this reply\'s meeting included: its cue names them), the list is capped', () => {
    const raw = (id, more = {}) => ({ pack: 'w', packVersion: '1', kind: 'figure', id, name: `Person ${id}`, role: `the ${id}`, look: 'Plain.', start: { place: 'Harrow' }, ...more });
    const entries = [raw('a'), (({ kind: _kind, ...own }) => own)(raw('b')), raw('c', { start: { place: 'Kesh' } }), raw('d'), raw('e'), raw('f'), raw('g'), raw('h')].map(readEntry);
    const frame = { cast: { entries, byKey: new Map(entries.map(entry => [entry.key, entry])) }, party: { place: 'Harrow', old: true }, present: new Set(), pinned: new Set() };
    const person = (entry, more = {}) => [entry.key, { name: entry.name, aliases: [], where: entry.place, doing: '', ...more }];
    const slice = { people: Object.fromEntries(entries.map(entry => person(entry, entry.id === 'd' ? { met: { why: 'place', where: 'Harrow', reason: '' } } : {}))), meeting: null };
    const line = hereLine(slice, frame);
    assert.match(line, /Person a, the a \(Plain\)/);
    assert.doesNotMatch(line, /Person b|Person c|Person d/, 'no kind, elsewhere, met');
    assert.equal(named(line), HERE_MAX, 'capped');
    assert.equal(hereLine(slice, { ...frame, party: { place: 'Gwenmar', old: true } }), '', 'nobody at the place: no line');
    assert.equal(hereLine(slice, frame, { persona: 'Person a' }).includes('Person a'), false, 'never the player\'s own character');
});

test('the scene\'s place first, then its parent; a sibling, a district under it or a grandparent is left out; the cap never cuts the person at the place itself', () => {
    const raw = (id, place) => ({ pack: 'w', packVersion: '1', kind: 'figure', id, name: `Person ${id}`, role: '', look: '', start: { place } });
    const entries = [raw('a', 'Town'), raw('b', 'Town'), raw('c', 'Town'), raw('d', 'Town / Gate'), raw('e', 'Town'), raw('f', 'Town / Keep'), raw('g', 'Town / Gate / Cellar')].map(readEntry);
    const cast = { entries, byKey: new Map(entries.map(entry => [entry.key, entry])) };
    const slice = { people: Object.fromEntries(entries.map(entry => [entry.key, { name: entry.name, aliases: [], where: entry.place, doing: '' }])), meeting: null };
    const list = line => line.slice(line.indexOf(AFTER) + AFTER.length).replace(/\.$/, '').split('; ');
    // The atlas's parent links: Town / Keep and Town / Gate sit in Town; the cellar sits in the Gate.
    const spots = { Town: { key: 'id:town', up: [] }, 'Town / Keep': { key: 'id:keep', up: [{ key: 'id:town' }] }, 'Town / Gate': { key: 'id:gate', up: [{ key: 'id:town' }] }, 'Town / Gate / Cellar': { key: 'id:cellar', up: [{ key: 'id:gate' }, { key: 'id:town' }] } };
    const atlas = place => ({ cast, party: { place, locate: name => spots[name] ?? null }, present: new Set(), pinned: new Set() });
    assert.deepEqual(list(hereLine(slice, atlas('Town / Keep'))), ['Person f', 'Person a', 'Person b', 'Person c'], 'the keep\'s own first, then the town, capped; the gate is a sibling');
    assert.deepEqual(list(hereLine(slice, atlas('Town / Gate / Cellar'))), ['Person g', 'Person d'], 'the cellar and its parent, the gate; not the town above it');
    assert.deepEqual(list(hereLine(slice, atlas('Town'))), ['Person a', 'Person b', 'Person c', 'Person e'], 'in the town: its own people, not its districts\'');
    // No atlas reader: the place as written, then the town a "Town / Spot" name writes first.
    const written = { cast, party: { place: 'Town / Gate', old: true }, present: new Set(), pinned: new Set() };
    assert.deepEqual(list(hereLine(slice, written)), ['Person d', 'Person a', 'Person b', 'Person c']);
});

test('the People here line gives each person the start of their personality and their voice, so the first lines they speak are theirs (owner, 20 Nov: a shy healer came in brisk)', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await ersveil();
    try {
        await host.st.loadChat([{ name: 'Narrator', is_user: false, is_system: false, mes: 'You arrive at the guild office.' }], 'voice');
        await host.send('I look around.', 'A clerk and a tired woman in a blue coat: Edda Rorke, the clerk says.');
        const line = hereOf(host);
        assert.match(line, /Sister Temiwa, [^;]*manner: Shy and withdrawn[^;]*, speaks: Soft, a few words at a time/, line);
        assert.doesNotMatch(line.slice(line.indexOf(AFTER)), /secret/i, 'never a secret');
    } finally { host.destroy?.(); }
});
