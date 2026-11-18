// LA-2: the world's own people at the scene's place reach the narrator by name (role and look, never a secret), so a scene that needs
// Bluewatch's watch-captain uses Edda Rorke and invents no double. Ersveil (format 4) at its start place; a swipe sends the same line; elsewhere
// the line names that place's people; a person met earlier and anyone not a format 4 cast entry are left out; the list is capped.
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
const named = line => line.slice(line.indexOf('in the story: ')).split('; ').length;
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

test('LA-2: at Bluewatch the narrator is told Edda Rorke and Sister Temiwa by name, role and look; no secret; a swipe sends the same line; Auvoth names its own', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await ersveil();
    try {
        await host.send('Begin.', said('The guild office.', ['~ time October 1, 611, 07:00 am', '~ place Bluewatch Village / Guild Office | kind: guild office']));
        await host.send('I look around.', 'A clerk and a tired woman in a blue coat.');
        const line = hereOf(host);
        assert.match(line, /^\[People here\] The world's own people at this place or close by/);
        assert.match(line, /Watch-Captain Edda Rorke, Bluewatch's Watch-Captain \(Tired human woman of about forty-eight/, 'the canon watch-captain, named');
        assert.match(line, /Sister Temiwa, Bluewatch's healer-sealer/);
        assert.match(line, /knows a name only once it is said in the story: /);
        assert.doesNotMatch(line, /log blank|Watchhouse log|Saintess Livia|Laan/, 'no secret, nobody from elsewhere');
        assert.equal(named(line), 3, 'Temiwa, Torka and Edda Rorke (the one this reply meets, under no name in the cue)');
        await host.swipe('A clerk and a tired woman in a blue coat, again.');
        assert.equal(hereOf(host), line, 'a swipe of the reply is told the same people');
        const saved = structuredClone(host.ctx.chat);
        await host.st.loadChat([], 'other');
        await host.st.loadChat(structuredClone(saved), 'la2');
        await host.regenerate('After a chat change and back.');
        assert.equal(hereOf(host), line, 'a chat change and back (a reload) is told the same people');
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.send('I look around.', 'Rewound and said again.');
        assert.equal(hereOf(host), line, 'a rewind and the same message again is told the same people');
        await host.send('I walk to Auvoth.', said('Days of road.', ['~ place Auvoth | kind: city', '! time +4d']));
        await host.send('I look around.', 'Auvoth.');
        const there = hereOf(host);
        assert.doesNotMatch(there, /Edda Rorke|Temiwa/, 'Bluewatch\'s people stay at Bluewatch');
        assert.match(there, /Laan/, 'Auvoth\'s guildmaster is named there');
    } finally {
        host.close();
    }
});

test('the line itself: only format 4 cast at the place, a person met before is left out (one met in this reply under no name is not), the list is capped', () => {
    const raw = (id, more = {}) => ({ pack: 'w', packVersion: '1', kind: 'figure', id, name: `Person ${id}`, role: `the ${id}`, look: 'Plain.', start: { place: 'Harrow' }, ...more });
    const entries = [raw('a'), (({ kind: _kind, ...own }) => own)(raw('b')), raw('c', { start: { place: 'Kesh' } }), raw('d'), raw('e'), raw('f'), raw('g'), raw('h')].map(readEntry);
    const frame = { cast: { entries, byKey: new Map(entries.map(entry => [entry.key, entry])) }, party: { place: 'Harrow', old: true }, present: new Set(), pinned: new Set() };
    const person = (entry, more = {}) => [entry.key, { name: entry.name, aliases: [], where: entry.place, doing: '', ...more }];
    const slice = { people: Object.fromEntries(entries.map(entry => person(entry, entry.id === 'd' ? { met: { why: 'place', where: 'Harrow', reason: '' } } : {}))), meeting: null };
    const line = hereLine(slice, frame, { at: 4 });
    assert.match(line, /Person a, the a \(Plain\)/);
    assert.doesNotMatch(line, /Person b|Person c|Person d/, 'no kind, elsewhere, met before');
    assert.equal(named(line), HERE_MAX, 'capped');
    const fresh = { ...slice, meeting: [{ at: 4, keys: [entries[3].key], rev: 1 }] };
    assert.match(hereLine(fresh, frame, { at: 4 }), /Person d/, 'met in this reply under no name: still named here');
    assert.equal(hereLine(slice, { ...frame, party: { place: 'Gwenmar', old: true } }, { at: 4 }), '', 'nobody at the place: no line');
    assert.equal(hereLine(slice, frame, { at: 4, persona: 'Person a' }).includes('Person a'), false, 'never the player\'s own character');
});
