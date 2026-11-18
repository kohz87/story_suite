// LAB2-1 and LAB2-3 on the real host, in the recorded A/B v2 chat's shape (Guild Office, five days on the road to Auvoth, a month there,
// then two taverns no pack names). Code-fired happenings reach the [World now] note by courier and reach; the off-map taverns read the
// world as Auvoth does (the pack place they stand for): the same news by the same way, the same conditions and the same routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FEATURE, agrees, newHost, reply } from '../daily/daily-host.helpers.js';

// A small pack in the recorded shape (the real one is 600 KB): its regions, the places of the run and two routes.
const PACK = {
    id: 'lab2-anchor', version: '1.0.0', name: 'LAB2 anchor', requires: { storyBlock: '^2' },
    content: {
        placeKinds: { 'guild office': 'site', district: 'site' },
        regions: [{ id: 'bluewatch-reach', name: 'Bluewatch Reach' }, { id: 'auvoth-compact', name: 'Auvoth Compact' }, { id: 'shornmarch', name: 'Shornmarch' }, { id: 'shackles', name: 'Shackles' }],
        places: [
            { id: 'bluewatch-village', name: 'Bluewatch Village', region: 'bluewatch-reach', kind: 'village', x: 40, y: 100 },
            { id: 'bluewatch-village-guild-office', name: 'Bluewatch Village / Guild Office', region: 'bluewatch-reach', kind: 'guild office', x: 40, y: 100 },
            { id: 'auvoth', name: 'Auvoth', region: 'auvoth-compact', kind: 'city', x: 59, y: 110 },
            { id: 'auvoth-pale-market', name: 'Auvoth / Pale Market', region: 'auvoth-compact', kind: 'district', x: 59.4, y: 109.6 },
            { id: 'wolfmere-outpost', name: 'Wolfmere Outpost', region: 'shornmarch', kind: 'outpost', x: 60, y: 120 },
            { id: 'shackles-city', name: 'Shackles City', region: 'shackles', kind: 'city', x: 0, y: 0 },
        ],
        routes: [
            { from: 'Bluewatch Village', to: 'Auvoth', kind: 'road', km: 210 },
            { from: 'Auvoth', to: 'Wolfmere Outpost', kind: 'road', km: 130 },
        ],
        conditions: [{ name: 'unrest', scope: 'place', fades: 'until cleared', means: 'Crowds in the streets.' }],
    },
};
const once = (id, where, reach, summary, after = 'start + 1 day') => ({ id, kind: 'one-off', certainty: 'set-in-motion', reach, where: [where], window: { after, within: '1 day' }, ends_when: { for: '90 days' }, summary });
// The recorded run's two code events were regional and far off (spec §4: news stops at reach, acceptance test 30); with them, one at the
// scene's own city (local) and one that reaches everywhere by the routes.
const SPEC = {
    realms: [],
    events: [
        once('harvest', 'Shackles City', 'regional', 'The harvest in Shackles fails.'),
        { ...once('market-fire', 'Auvoth / Pale Market', 'local', 'Fire in the Pale Market.', 'start + 10 days'), effects: { set: ['unrest@Auvoth'] } },
        once('wolfmere-flares', 'Wolfmere Outpost', 'world', 'Signal flares over Wolfmere.'),
        once('lamps-out', 'Auvoth', 'local', 'The Outer Lamps go dark.', 'start + 35 days'),
    ],
};

async function host(on = true) {
    const made = await newHost(on, SPEC);
    const installed = await made.packs.packs.install(JSON.stringify(PACK), { origin: 'pack.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    return made;
}

// The [World now] note and the atlas's routes line the reply was given (the prompt values set while it was generated).
async function turn(made, lines) {
    const mark = made.st.promptLog.length;
    await made.send('Go on.', reply('The story goes on.', lines));
    const told = made.st.promptLog.slice(mark).map(entry => String(entry.value ?? ''));
    return { note: told.filter(value => value.includes('[World now]')).at(-1) ?? '', routes: told.join('\n').match(/Routes from [^\n]*/)?.[0] ?? '' };
}
const heard = (made, place = null) => (made.sdk.query('world.heardHere', place ? { place } : {}) ?? []).map(entry => `${entry.name.replace(/ · .*$/, '')} [${entry.tag} ${entry.via} ${entry.days ?? ''}]`).sort();

async function play(made) {
    const seen = {};
    await turn(made, ['~ time October 1, 1200, 08:00 am', '~ place Bluewatch Village / Guild Office']);
    await turn(made, ['! time +5d', '~ place Auvoth']);
    await turn(made, ['! time +1h']);
    await turn(made, ['! time +30d']);
    seen.auvoth = await turn(made, ['! time +1h']);
    seen.auvothHeard = heard(made, 'Auvoth');
    await turn(made, ['! time +6h', '~ place The Sled & Winch']);
    seen.unmapped = heard(made, 'The Sled & Winch');
    // The same moment, the tavern not on the map yet: today's cue and one entry's arrival, as at Auvoth.
    seen.cue = [made.sdk.query('world.cueToday', {}), made.sdk.query('world.cueToday', { place: 'Auvoth' })];
    const flares = (made.sdk.query('chronicle.events', {}) ?? []).find(entry => /^Signal flares/.test(entry.name));
    seen.arrival = flares ? [made.sdk.query('world.newsAt', { entryId: flares.id }), made.sdk.query('world.newsAt', { entryId: flares.id, place: 'Auvoth' })] : [];
    seen.tavern = await turn(made, ['! time +10m']);
    seen.tavernHeard = heard(made, 'The Sled & Winch');
    await turn(made, ['~ place Slate Bunkhouse', '! time +12h']);
    seen.bunk = await turn(made, ['! time +1h']);
    seen.bunkHeard = heard(made, 'Slate Bunkhouse');
    seen.auvothLater = heard(made, 'Auvoth');
    return seen;
}

test('LAB2-1/LAB2-3: code-fired news reaches the note by courier and reach; the off-map taverns hear it as Auvoth does, with its conditions and routes', async () => {
    const made = await host(true);
    try {
        const seen = await play(made);
        // At Auvoth: the local fire at once (its own city), the flares by the road (130 km), never the far regional harvest.
        assert.match(seen.auvoth.note, /News that has reached here: .*Fire in the Pale Market/);
        assert.match(seen.auvoth.note, /Today: The Outer Lamps go dark/, 'today\'s happening here');
        assert.doesNotMatch(seen.auvoth.note, /harvest/i, 'regional news from another region stops at its reach (spec §4)');
        assert.match(seen.auvoth.note, /Conditions here: unrest at Auvoth/);
        assert.ok(seen.auvothHeard.some(line => /^Signal flares .*\[fact route/.test(line)), JSON.stringify(seen.auvothHeard));
        // The tavern, before and after the atlas has it, and the bunkhouse: the same news by the same way as Auvoth (no "tier, 10 days" in one and "route" in the other).
        assert.deepEqual(seen.unmapped, seen.auvothHeard, 'a tavern the atlas has not placed yet hears as Auvoth, not everything at 10 days');
        assert.deepEqual(seen.tavernHeard, seen.auvothHeard);
        assert.deepEqual(seen.bunkHeard, seen.auvothLater);
        for (const [label, at] of [['tavern', seen.tavern], ['bunkhouse', seen.bunk]]) {
            assert.match(at.note, /Fire in the Pale Market/, `${label}: the local happening of the city it is in`);
            assert.match(at.note, /The Outer Lamps go dark/, `${label}: a local happening of its town, today`);
            assert.doesNotMatch(at.note, /harvest/i, label);
            assert.match(at.note, /Conditions here: unrest at Auvoth/, `${label}: the conditions of the place it stands for`);
            assert.match(at.routes, /Routes from Auvoth: .*Wolfmere Outpost/, `${label}: the routes of the place it stands for`);
        }
        assert.ok(seen.cue[1], 'a happening of Auvoth fired today');
        assert.deepEqual(seen.cue[0], seen.cue[1], 'world.cueToday in the tavern not yet on the map: as at Auvoth');
        assert.deepEqual(seen.arrival[0], seen.arrival[1], 'world.newsAt in the tavern not yet on the map: as at Auvoth');
        assert.equal(seen.arrival[1].via, 'route');
        assert.equal(made.sdk.query('atlas.anchor', { name: 'The Sled & Winch' })?.name, 'Auvoth');
        assert.equal(made.sdk.query('atlas.anchor', { name: 'Auvoth / Pale Market' })?.via, 'pack');
        // Derived from stored state only: a swipe and back, a middle delete, a reload and a rewind read the same.
        const last = made.ctx.chat.length - 1;
        await made.swipe(reply('The bunkhouse, quieter.', ['! time +1h']));
        assert.deepEqual(heard(made), seen.bunkHeard, 'swipe');
        await made.st.swipeTo(last, 0);
        await agrees(made, 'swipe back');
        const tavern = made.ctx.chat.findIndex(message => !message.is_user && /place The Sled & Winch/.test(message.mes));
        for (const [label, line] of [['grown', '! time +2d'], ['shrunk', '! time +1m']]) {
            await made.st.editMessage(tavern, reply('The story goes on.', [line, '~ place The Sled & Winch']));
            assert.equal((await made.sdk.reread(tavern)).ok, true);
            assert.deepEqual(heard(made), heard(made, 'Auvoth'), `${label} Re-read: the bunkhouse still hears as Auvoth`);
            await agrees(made, `${label} Re-read`);
        }
        const chat = structuredClone(made.ctx.chat);
        await made.st.loadChat([{ name: 'Other', is_user: false, mes: 'Elsewhere.' }]);
        assert.notEqual(made.sdk.query('atlas.anchor', { name: 'The Sled & Winch' })?.name, 'Auvoth', 'another chat: its own map, not this one');
        await made.st.loadChat(chat);
        assert.equal(made.sdk.query('atlas.anchor', { name: 'The Sled & Winch' })?.name, 'Auvoth', 'back: as before');
        await made.st.deleteMessage(last - 2);
        assert.deepEqual(heard(made), heard(made, 'Auvoth'), 'middle delete: the bunkhouse still hears as Auvoth');
        await agrees(made, 'middle delete');
        while (made.ctx.chat.length > 12) await made.st.deleteMessage(made.ctx.chat.length - 1);
        assert.deepEqual(heard(made), heard(made, 'Auvoth'), 'rewound into the tavern: as Auvoth');
        await agrees(made, 'rewind');
    } finally { made.done(); }
});

test('LAB2-3: with the switch off the routes line of an off-map place is as before (none) and there is no note', async () => {
    const made = await host(false);
    try {
        const seen = await play(made);
        assert.equal(seen.tavern.note, '');
        assert.doesNotMatch(seen.tavern.routes, /Routes from/, 'switch off: the tavern has no routes line, as before');
        assert.match(seen.auvoth.routes, /Routes from Auvoth/, 'a pack place keeps its own');
        assert.equal(made.features.on(FEATURE), false);
    } finally { made.done(); }
});

test('LAB2-1: a happening at the scene\'s region itself is heard there at once, as fact (not "tier, 10 days" as rumour); another region still waits', async () => {
    const made = await host(true);
    try {
        await turn(made, ['~ time October 1, 1200, 08:00 am', '~ place Auvoth']);
        await turn(made, ['! time +1h', '+ world Tolls raised — the Compact doubles its gate tolls | state: ongoing | place: Auvoth Compact']);
        const at = place => (made.sdk.query('world.heardHere', { place }) ?? []).find(entry => /^Tolls raised/.test(entry.name));
        assert.deepEqual([at('Auvoth')?.tag, at('Auvoth')?.days], ['fact', 0], 'in its region: at once');
        assert.deepEqual([at('Auvoth / Pale Market')?.tag, at('Auvoth / Pale Market')?.days], ['fact', 0]);
        assert.equal(at('Bluewatch Village')?.tag, 'rumour', 'another region: rumour until the courier');
        const { note } = await turn(made, ['! time +1h']);
        assert.match(note, /News that has reached here: Tolls raised —/);
        assert.doesNotMatch(note, /Tolls raised \(rumour\)/);
    } finally { made.done(); }
});
