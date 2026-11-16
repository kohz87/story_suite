// Tests for the names part (src/v2/names/index.js) inside module `story-director`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createModule } from '../../../../ui/legacy/director/module.js';
import { createHost } from '../../../../packages/story-block/testkit/index.js';
import { fakeDelta } from '../../../modules/cast/keypeople/helpers.js';
import {
    OVERUSED, applyPerson, beforeGenerate as namesBefore, bareKey, capMinor, checkName, clampCount, initialNames, nameKey, parseBanned, parseProfile, pickSuggestions,
    part as namesPart, profileText, tail as namesTail, validateNames,
} from '../../../../modules/cast/names/index.js';

// ---- the names part (src/v2/names/index.js) ----
const PACK_NAMES = { banned: ['Mordred'], river: { regions: ['River Confederacy'], given: ['Wenna', 'Joost', 'Maaike', 'Bregje', 'Temiwa', 'Hilde', 'Gerold', 'Sigrun'] } };

test('names core: banned, overused, taken, first-name and near collisions; titles do not make a new name', () => {
    assert.deepEqual(OVERUSED.slice(0, 4), ['Elara', 'Vane', 'Vance', 'Seraphina']);
    const known = [{ name: 'Sister Temiwa', by: 'used' }, 'Bregje', 'Corst'];
    assert.equal(checkName('Rik', { known }).ok, true);
    assert.deepEqual(checkName('Elara Brightwater').reasons.map(r => r.kind), ['overused']);
    assert.deepEqual(checkName('Mara', { banned: parseBanned('Mara\nKessa, Mara') }).reasons.map(r => r.kind), ['banned']);
    assert.deepEqual(checkName('Temiwa', { known }).reasons, [{ kind: 'taken', by: 'used' }]);
    assert.deepEqual(checkName('Bregje Dale', { known }).reasons.map(r => r.kind), ['first']);
    assert.deepEqual(checkName('Bregja', { known }).reasons.map(r => r.kind), ['near']);
    assert.equal(checkName('Bregje', { known, self: 'Bregje' }).ok, true);
    assert.equal(bareKey('Watch-Captain Roelof'), 'roelof');
    assert.deepEqual(parseBanned('a, b\nA\n'), ['a', 'b']);
    assert.deepEqual([clampCount(undefined), clampCount(99), clampCount(-2), clampCount(2.9)], [3, 8, 0, 2]);
});

test('names core: suggestions are deterministic, setting-fitting and unused; the profile line is capped; minor people are capped oldest first', () => {
    const args = { names: PACK_NAMES, region: 'River Confederacy: Bluewatch', used: ['Temiwa'], banned: ['Joost'], count: 3, seed: '12' };
    const picked = pickSuggestions(args);
    assert.equal(picked.length, 3);
    assert.deepEqual(pickSuggestions({ ...args, names: { ...PACK_NAMES, river: { ...PACK_NAMES.river, given: [...PACK_NAMES.river.given].reverse() } } }), picked, 'the pack order does not matter');
    assert.ok(!picked.includes('Temiwa') && !picked.includes('Joost'));
    assert.deepEqual(pickSuggestions({ ...args, region: 'Elsewhere' }), []);
    assert.deepEqual(pickSuggestions({ ...args, names: undefined }), []);
    assert.notDeepEqual(pickSuggestions({ ...args, seed: '13' }), picked);
    const read = parseProfile('look: a long scar over one eye and a limp | flaw: greedy | voice: low | temper: calm');
    assert.equal(read.ok, true);
    assert.ok(Array.from(profileText({ look: 'x'.repeat(99), flaw: 'y'.repeat(99), voice: 'z'.repeat(99), temper: 'w'.repeat(99) })).length <= 160);
    const people = Object.fromEntries(Array.from({ length: 82 }, (_, i) => [`p${String(i).padStart(2, '0')}`, { first: 100 - i }]));
    const capped = capMinor(people, 80);
    assert.equal(Object.keys(capped.people).length, 80);
    assert.deepEqual(capped.evicted, ['p81', 'p80']);
});

const namesView = (slice, { chat = 6, present = [], mes = '', log = null, settings = {}, on = true } = {}) => ({
    state: { domains: { names: slice, scene: { place: { region: 'River Confederacy: Bluewatch' } } } }, chat: { length: chat }, feature: () => on, settings: () => settings,
    story: { chat: () => log ?? [{ mes }] }, query: (name, args) => (name === 'packs.content' ? (args.kind === 'names' ? [{ names: PACK_NAMES }] : []) : name === 'scene.present' ? present : null),
});

test('names: the tail offers the setting count of unused names and tells a stored person back in the scene (profile, at most 4); off, nothing', () => {
    const slice = { people: { corst: { name: 'Corst', first: 3, profile: { look: 'scarred', flaw: 'greedy', voice: 'low', temper: 'calm' }, rev: 3 }, hald: { name: 'Hald', first: 4, profile: null, rev: 4 } }, seen: {}, taken: {} };
    const out = namesTail(namesView(slice, { present: ['Corst', 'Hald'], settings: { suggestions: 2 } }));
    assert.deepEqual(out.lines, []);
    assert.equal(out.optional[0], 'Corst: scarred; greedy; low; calm');
    assert.match(out.optional[1], /^Unused names \(pick one for any new person\): \w+, \w+$/);
    assert.equal(out.optional.length, 2, 'a person without a profile is not told');
    assert.equal(namesTail(namesView(slice, { mes: 'Corst spits.', settings: { suggestions: 0 } })).optional.join('|'), 'Corst: scarred; greedy; low; calm');
    assert.deepEqual(namesTail(namesView(slice, { on: false, present: ['Corst'] })), { lines: [], optional: [] });
    // The trigger is the narrator's last reply (not the reader's message after it), and a name is a whole word.
    const told = log => namesTail(namesView(slice, { log, settings: { suggestions: 0 } })).optional;
    assert.deepEqual(told([{ mes: 'Corst spits.', is_user: false }, { mes: 'I wait.', is_user: true }]), ['Corst: scarred; greedy; low; calm']);
    assert.deepEqual(told([{ mes: 'Quiet.', is_user: false }, { mes: 'Where is Corst?', is_user: true }]), []);
    const ket = { people: { ket: { name: 'Ket', first: 1, profile: { look: 'squat', flaw: '', voice: '', temper: '' }, rev: 1 } }, seen: {}, taken: {} };
    assert.deepEqual(namesTail(namesView(ket, { mes: 'A bucket and Ketil.', settings: { suggestions: 0 } })).optional, []);
    assert.deepEqual(namesTail(namesView(ket, { mes: 'Then Ket, grinning.', settings: { suggestions: 0 } })).optional, ['Ket: squat']);
});

test('names core: accents do not hide a banned or overused name; a known person declared again is not a collision and writes nothing; a near miss is a Problem without a cue', () => {
    assert.deepEqual(checkName('Élara').reasons.map(r => r.kind), ['overused']);
    assert.deepEqual(checkName('Maré', { banned: ['Mare'] }).reasons.map(r => r.kind), ['banned']);
    assert.equal(nameKey('Seraphína'), nameKey('Seraphina'));
    const ctx = slice => ({ rev: 7, draft: () => slice, settings: () => ({}), query: () => null, fail: (code, text) => ({ code, text }) });
    const line = (name, look) => ({ op: '+', name, text: `look: ${look}` });
    const slice = { people: { marrit: { name: 'Marrit', first: 2, profile: { look: 'tall', flaw: '', voice: '', temper: '' }, rev: 2 } }, seen: { bregje: { name: 'Bregje', rev: 3 } }, taken: {} };
    for (const name of ['Marrit', 'marrit', 'Bregje']) {
        const out = applyPerson(ctx(slice), line(name, 'one-eyed brute'));
        assert.equal(out.problem, undefined, `${name} is the same person`);
        assert.equal(out.data.known, true);
    }
    assert.deepEqual(slice.taken, {}, 'no rename cue');
    assert.equal(slice.people.marrit.profile.look, 'tall', 'the frozen profile stays');
    assert.equal(slice.people.bregje, undefined, 'a dossier person gets no profile from the line');
    assert.ok(slice.seen.bregje);
    const refused = applyPerson(ctx(slice), line('Elara', 'tall'));
    assert.ok(refused.problem && slice.taken.elara && slice.people.elara === undefined, 'a refused name keeps no profile');
    const near = applyPerson(ctx(slice), line('Bregja', 'thin'));
    assert.ok(near.problem && slice.taken.bregja === undefined && slice.people.bregja === undefined, 'a near miss is told to the reader only');
    const cue = namesBefore({ ...namesView({ people: {}, seen: {}, taken: { elara: { name: 'Elara', rev: 2, told: false } } }, { settings: { suggestions: 0 } }) }, {});
    assert.match(cue.lines[0].text, /by another, unused name/, 'suggestions 0 means no suggested name in the cue either');
});

test('names: a unique full, given, middle, surname, partial or titled name keeps the known person and their profile', () => {
    const slice = { people: { 'marrit anne voss': { name: 'Marrit Anne Voss', first: 2, profile: { look: 'tall', flaw: '', voice: '', temper: '' }, rev: 2 } }, seen: { 'captain joris brand': { name: 'Captain Joris Brand', rev: 3 } }, taken: {} };
    const before = structuredClone(slice);
    const ctx = { rev: 7, draft: () => slice, settings: () => ({}), query: () => null };
    for (const name of ['Marrit Anne Voss', 'Marrit', 'Anne', 'Voss', 'Marrit Voss', 'Anne Voss', 'Lady Marrit Voss', 'Joris Brand', 'Joris', 'Brand', 'Captain Brand']) {
        const result = applyPerson(ctx, { op: '+', name, text: 'look: different' });
        assert.equal(result.data.known, true, name);
        assert.equal(result.problem, undefined, name);
    }
    assert.deepEqual(slice, before, 'no duplicate profile, overwrite or rename cue');
    assert.equal(namesBefore(namesView(slice, { settings: { suggestions: 0 } }), {})?.lines, undefined);
});

test('names: cast, dossier and pin aliases stay linked in recorded history, including a scene alias', () => {
    const slice = initialNames();
    const view = namesView(slice, { present: ['Red Fox'], settings: { suggestions: 0 } });
    view.state.domains.cast = { people: { 'pack:joris': { name: 'Captain Joris Brand', aliases: ['Red Fox', 'Joss the Swift'] } } };
    view.state.domains.keypeople = { pins: { mara: { name: 'Mara Kess', aliases: ['Swift Quill'] }, fox: { name: 'Red Fox', aliases: ['Watch Fox'] } }, gone: {} };
    view.query = (name, args) => name === 'scene.present' ? ['Red Fox'] : name === 'npc.known' ? ['Leonie West'] : name === 'npc.dossier' && args.name === 'Leonie West' ? { name: 'Leonie West', aliases: ['Mistress Willow'] } : name === 'npc.identity' ? { id: 'np_12345678' } : null;
    const step = namesBefore(view, {}).commands.find(command => command.type === 'names.seen');
    assert.equal(step.payload.identities.length, 4);
    const ctx = { cause: 'system', rev: 4, draft: () => slice, settings: () => ({}), query: () => null, fail: (code, text) => ({ code, text }) };
    assert.equal(namesPart.commands['names.seen'](ctx, step.payload).summary, 'Names noted.');
    assert.deepEqual(validateNames(slice), []);
    assert.equal(namesBefore(view, {}), undefined, 'unchanged aliases do not keep writing steps');
    const before = structuredClone(slice);
    for (const name of ['Joris', 'Captain Brand', 'Joss', 'Red Fox', 'Fox', 'Watch Fox', 'Leonie', 'West', 'Willow', 'Mara', 'Kess', 'Swift Quill']) {
        const result = applyPerson(ctx, { op: '+', name, text: 'look: invented' });
        assert.equal(result.data.known, true, name);
        assert.equal(result.problem, undefined, name);
    }
    assert.deepEqual(slice, before, 'known aliases do not invent profiles or cues');
    view.state.domains.cast.people['pack:joris'].aliases = ['The Red Captain'];
    const update = namesBefore(view, {}).commands.find(command => command.type === 'names.seen');
    namesPart.commands['names.seen']({ ...ctx, rev: 5 }, update.payload);
    assert.equal(applyPerson(ctx, { op: '+', name: 'Red Captain' }).data.known, true, 'a newly learned alias is recorded');
    assert.equal(applyPerson(ctx, { op: '+', name: 'Red Fox' }).data.known, true, 'an earlier alias remains linked');
    assert.equal(namesBefore(view, {}), undefined, 'a changed alias is recorded only once');
    assert.deepEqual(validateNames(slice), []);
});

test('names: ambiguous given names, surnames, aliases and identical full names remain collisions', () => {
    const slice = initialNames();
    const view = namesView(slice, { settings: { suggestions: 0 } });
    view.state.domains.cast = { people: {
        'p:a': { name: 'Joris Brand', aliases: ['Fox'] },
        'p:b': { name: 'Joris Voss', aliases: ['Fox'] },
        'p:c': { name: 'Mara Brand', aliases: [] },
        'p:d': { name: 'Riva North', aliases: ['Sparrow'] },
        'p:e': { name: 'Riva North', aliases: ['Wren'] },
    } };
    view.state.domains.keypeople = { pins: { fox: { name: 'Fox', aliases: ['Night Fox'] } }, gone: {} };
    const ctx = { cause: 'system', rev: 3, draft: () => slice, settings: () => ({}), query: () => null, fail: (code, text) => ({ code, text }) };
    namesPart.commands['names.seen'](ctx, namesBefore(view, {}).commands[0].payload);
    for (const name of ['Joris Brand', 'Joris Voss', 'Mara Brand', 'Sparrow', 'Wren']) {
        assert.equal(applyPerson(ctx, { op: '+', name }).data.known, true, `${name} identifies one person`);
    }
    for (const name of ['Joris', 'Brand', 'Fox', 'Riva North', 'Joris Dane', 'Elara']) {
        const result = applyPerson(ctx, { op: '+', name, text: 'look: invented' });
        assert.ok(result.problem, `${name} must be a collision`);
        assert.ok(slice.taken[nameKey(name)], `${name} gets a rename cue`);
        assert.equal(slice.people[nameKey(name)], undefined, `${name} gets no profile`);
    }
    const cues = namesBefore(view, {}).lines;
    assert.equal(cues.length, 6);
    assert.ok(cues.every(cue => cue.keep));
    assert.deepEqual(validateNames(slice), []);
});

test('names on the host: partial and dossier alias declarations stay quiet through a swipe, deletion and rebuild', async () => {
    const delta = { 'Joris Brand': { aliases: ['Red Fox'] } };
    const host = await createHost({ modules: [fakeDelta(delta), createModule()], settings: { features: { 'story-director.names': true, 'story-director.pulse': false } } });
    try {
        await host.send('Hello.', '<Changes>\n+ person Marrit Anne Voss | look: tall\n</Changes>');
        await host.send('Again.', '<Changes>\n+ person Marrit | look: short\n+ person Brand | look: made up\n+ person Red Fox | look: made up\n</Changes>');
        const middle = host.ctx.chat.length - 1;
        const names = () => host.head().domains.names;
        assert.deepEqual(names().taken, {});
        assert.equal(names().people['marrit anne voss'].profile.look, 'tall');
        assert.deepEqual(Object.keys(names().people), ['marrit anne voss']);
        await host.swipe('<Changes>\n+ person Voss | look: short\n+ person Fox | look: made up\n</Changes>');
        assert.deepEqual(names().taken, {});
        delta['Joris Brand'].aliases = ['Grey Falcon'];
        await host.send('Then?', '<Changes>\n+ person Grey Falcon | look: made up\n</Changes>');
        assert.deepEqual(names().taken, {});
        delta['Joris Brand'].aliases = ['Red Fox'];
        assert.ok(!host.st.promptLog.some(entry => String(entry.value ?? '').includes('[Names] "Marrit"')));
        await host.st.deleteMessage(middle);
        await host.st.deleteMessage(middle - 1);
        assert.deepEqual(host.store.problems(), []);
        assert.ok(!Object.values(names().seen).some(entry => entry.aliases?.includes('Grey Falcon')), 'the deleted observation leaves no alias behind');
        const live = structuredClone(host.head());
        host.store.rebuild();
        assert.deepEqual(host.head(), live);
        assert.deepEqual(validateNames(names()), []);
    } finally {
        host.close();
    }
});

test('names on the host: a repeated or overused name is a Problem and a pinned cue on the next reply; a fresh name is stored with its profile; off, the prompt is as it was', async () => {
    const run = async features => {
        const host = await createHost({ modules: [createModule()], settings: { features: { 'story-director.pulse': false, ...features } } });
        return host;
    };
    const plain = await run({ 'story-director.names': false });
    const on = await run({ 'story-director.names': true });
    try {
        const open = '<Changes>\n~ time June 3, 1200, 08:00 am\n~ place Harrow | kind: settlement\n';
        await plain.send('Hello.', `${open}+ person Corst | look: scarred | flaw: greedy\n</Changes>`);
        await on.send('Hello.', `${open}+ person Corst | look: scarred | flaw: greedy | voice: low | temper: calm\n</Changes>`);
        assert.deepEqual(plain.head().domains.names, initialNames(), 'a chat without the feature stores nothing');
        assert.deepEqual(on.head().domains.names.people.corst.profile, { look: 'scarred', flaw: 'greedy', voice: 'low', temper: 'calm' });
        assert.deepEqual(validateNames(on.head().domains.names), []);
        await on.send('Next.', '<Changes>\n+ person Elara | look: tall\n+ person Corst | look: fat\n</Changes>');
        const names = on.head().domains.names;
        assert.deepEqual(Object.keys(names.taken), ['elara'], 'Corst declared again is the same person, not a collision');
        assert.equal(names.people.corst.profile.look, 'scarred', 'the first profile is frozen');
        assert.ok(on.sdk.receipts().some(entry => /not a fresh name/.test(entry.receipt?.summary ?? '')));
        await on.send('And?', 'Quiet.');
        const cues = on.st.promptLog.map(entry => String(entry.value ?? '')).filter(text => text.includes('[Names] "Elara"'));
        assert.ok(cues.length >= 1, 'the rename cue reaches the next reply');
        assert.ok(Object.values(on.head().domains.names.taken).every(entry => entry.told === true));
        const statics = host => host.st.promptLog.filter(entry => entry.key === 'story_suite_static' && entry.value).map(entry => entry.value);
        assert.ok(statics(on).at(-1).includes('+ person Name'));
        assert.ok(!statics(plain).at(-1).includes('+ person Name'));
        const before = structuredClone(on.head());
        on.store.rebuild();
        assert.deepEqual(on.head(), before, 'rebuild == live');
    } finally {
        plain.close();
        on.close();
    }
});

test('names: the step before a reply notes who else is in use (scene, cast, dossiers, key people) and marks a told cue once; a Continue tells it again without a step', () => {
    const view = namesView({ people: {}, seen: {}, taken: { elara: { name: 'Elara', rev: 2, told: false } } }, { present: ['Rika'] });
    view.state.domains.cast = { people: { 'p:a': { name: 'Brom', aliases: ['Old Brom'] } } };
    const out = namesBefore(view, {});
    assert.deepEqual(out.commands.map(c => c.type), ['names.seen', 'names.told']);
    assert.deepEqual(out.commands[0].payload.who, ['Rika']);
    assert.deepEqual(out.commands[0].payload.identities.map(person => person.name), ['Brom']);
    assert.match(out.lines[0].text, /^\[Names\] "Elara" is not a fresh name/);
    assert.equal(out.lines[0].keep, true);
    assert.equal(out.lines[0].text.includes('Brom'), false, 'nobody known is named in the cue');
    const again = namesBefore(view, { commit: false });
    assert.equal(again.commands, undefined);
    assert.equal(again.lines.length, 1);
    assert.equal(namesBefore(namesView(initialNames(), { on: false }), {}), undefined);
});
