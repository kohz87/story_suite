import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInjection, createNpcRecord, normalizeNpcRecord as normalizeProduction } from '../core.js';
import { normalizeNpcRecord } from '../core-mechanics.js';
import { resolveNpcAppearance } from '../appearance.js';
import { castFromHtml, castProjection, projectDossierState } from '../dossier-ui.js';
import { normalizeSecrets, observeCast, validateNpcSlice } from '../src/npc-meters.js';
import {
    applyCastEntry, castBadge, castSecrets, castView, dossierFor, findCastPerson, metWithEntry, normalizeCast, normalizeEntry, parsePeople, shortPackName,
} from '../src/cast-dossier.js';
import { ERSVEIL, FENNA_ENTRY, dateText, person, unmet } from './cast-dossier.helpers.js';

test('the answer is cleaned; an unmet person never carries an entry, a met one does; dates are written on the calendar', () => {
    const list = normalizeCast([person(), { ...unmet(), key: 'ersveil:sera', id: 'sera', name: 'Sera', entry: structuredClone(FENNA_ENTRY) }, { name: 'no key' }, 'junk', null], dateText);
    assert.deepEqual(list.map(item => item.key), ['ersveil:fenna', 'ersveil:sera'], 'unusable rows and duplicates are left out');
    const [fenna, sera] = list;
    assert.equal(fenna.met.on, 'Gw 12');
    assert.equal(fenna.met.where, 'Bluewatch docks');
    assert.deepEqual(fenna.lastHeard, { text: 'took the ferry upriver to Ashford', on: 'Gw 15' });
    assert.equal(fenna.entry.start.goal, 'Find out who opened the weir');
    assert.equal(sera.entry, null, 'an entry that came with an unmet person is dropped');
    assert.equal(sera.lastHeard, null);
    assert.deepEqual(metWithEntry(list).map(item => item.key), ['ersveil:fenna']);
    assert.equal(findCastPerson(list, 'ersveil:sera').name, 'Sera');
    assert.deepEqual(normalizeCast('nope'), [], 'no array, no cast');
    assert.equal(normalizeCast([person()])[0].met.on, '', 'without a calendar a story minute has no text');
    assert.equal(normalizeCast([person({ met: { on: 'Gw 3', where: 'x' } })])[0].met.on, 'Gw 3', 'words are kept as given');
});

test('the entry is bounded plain text: lists and texts cut, the pack\'s hidden notes keep a meter rule or a story event', () => {
    const long = 'word '.repeat(700);
    const entry = normalizeEntry({ ...FENNA_ENTRY, look: long, aliases: Array.from({ length: 20 }, (_, i) => `alias ${i}`), fields: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`F${i}`, `v${i}`])) });
    assert.ok(entry.look.length <= 1800 && entry.aliases.length === 8 && Object.keys(entry.fields).length === 12);
    assert.equal(normalizeEntry({ about: 'no name' }), null);
    assert.deepEqual(entry.stages.map(stage => stage.name), ['Wary', 'Ally']);
    assert.deepEqual(normalizeEntry({ ...FENNA_ENTRY, stages: [{ meter: 'trust', at: 30, name: 'Friend' }] }).stages, [{ name: 'Friend', needs: [{ meter: 'trust', at: 30 }] }], 'a threshold row reads as a need');
    const secrets = castSecrets(FENNA_ENTRY.secrets.concat([{ title: 'no rule', text: 'dropped' }, { title: 'no text', meter: 'trust', at: 5 }]));
    assert.equal(secrets.length, 2);
    assert.deepEqual(secrets[0], { title: "Her husband's debt", text: 'He owed the smugglers; she still pays it off.', meter: 'trust', at: 60, from: 'pack' }, 'a pack\'s note says it came from the pack (the dossier editor keeps it hidden while locked)');
    assert.deepEqual([secrets[1].title, secrets[1].when, secrets[1].meter], ['The weir', 'the party learns of the toll-gang', undefined]);
    assert.deepEqual(normalizeSecrets(secrets).map(note => [note.id.startsWith('sec_'), note.when ?? null]), [[true, null], [true, 'the party learns of the toll-gang']], 'the hidden-notes code reads them (ids, story-event rule)');
    assert.equal(castSecrets(Array.from({ length: 12 }, (_, i) => ({ text: `n${i}`, meter: 'trust', at: i }))).length, 8, 'at most eight');
});

// ---- the dossier ----

test('a pack secret with both rules (trust 90 or a story event) goes through the answer, castSecrets and the made dossier with both', () => {
    const either = { title: 'Either way', text: 'She forged the seal.', meter: 'trust', at: 90, when: 'the party asks about the seal' };
    const entry = { ...FENNA_ENTRY, secrets: [either] };
    const [p] = normalizeCast([person({ entry })], dateText);
    assert.deepEqual(p.entry.secrets, [{ ...either, from: 'pack' }], 'the answer keeps the note whole, marked as the pack\'s');
    assert.deepEqual(castSecrets(entry.secrets), [{ ...either, from: 'pack' }]);
    const made = normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil' }));
    assert.deepEqual(made.secrets.map(note => [note.meter, note.at, note.when, note.from]), [['trust', 90, 'the party asks about the seal', 'pack']]);
    assert.deepEqual(normalizeSecrets(made.secrets).map(note => [note.meter, note.at, note.when]), [['trust', 90, 'the party asks about the seal']]);
});

test('the dossier is made from the entry: profile, numbers, fields, notes, portrait, the way back to the pack', () => {
    const [p] = normalizeCast([person()], dateText);
    const portrait = { dataUrl: 'data:image/webp;base64,AAAA', mime: 'image/webp', sourceName: 'fenna.webp', updatedAt: 1 };
    const made = normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil', portrait }));
    assert.equal(made.role, 'Runs the night ferry at Bluewatch docks.');
    // Changed with the wears rule: the pack's look is the physical appearance (this entry has no `wears`: the current slot stays empty).
    assert.equal(made.overallAppearance, FENNA_ENTRY.look);
    assert.equal(made.appearance, '');
    assert.equal(made.speech, FENNA_ENTRY.voice);
    assert.equal(made.personality, FENNA_ENTRY.personality);
    assert.equal(made.background, FENNA_ENTRY.history);
    assert.equal(made.homeBase, 'Bluewatch docks');
    assert.equal(made.goal, 'Find out who opened the weir');
    assert.equal(made.location, 'Bluewatch docks', 'where they were met');
    assert.deepEqual(made.aliases, ['the ferrywoman']);
    assert.deepEqual(made.customFields, { Allegiance: 'Ferry guild' });
    assert.equal(made.relationship.trust, 10, 'the built-in numbers start where the pack put them');
    assert.deepEqual(made.meterSetup, { track: 'companion', limits: {} });
    assert.equal(made.secrets.length, 2, 'the hidden notes are handed over');
    assert.equal(made.portrait.dataUrl, portrait.dataUrl);
    assert.deepEqual(made.castFrom, {
        key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', packName: 'Ersveil', met: { on: 'Gw 12', where: 'Bluewatch docks' },
        goal: 'Find out who opened the weir', routine: 'evenings at the ferry', stages: FENNA_ENTRY.stages.map(({ name, needs }) => ({ name, needs })),
        first: { overallAppearance: FENNA_ENTRY.look, speech: FENNA_ENTRY.voice, personality: FENNA_ENTRY.personality, background: FENNA_ENTRY.history },
    });
    // The narrator hears the pack's words like any dossier's.
    const injection = buildInjection([{ ...made, present: true }], 'Fenna is here.', 1);
    assert.match(injection, /oilskin coat/);
    assert.match(injection, /says "aye"/);
    assert.equal(applyCastEntry(createNpcRecord('Fenna', []), { ...p, entry: null }), null, 'without an entry (an unmet person) there is nothing to make');
});

test('the badge says the pack\'s short name: a bracketed note or a subtitle is left off', () => {
    assert.equal(shortPackName('Ersveil (open world)'), 'Ersveil');
    assert.equal(shortPackName('Moonveil — the long night'), 'Moonveil');
    assert.equal(shortPackName('Lean: a small RPG'), 'Lean');
    assert.equal(shortPackName('  Ersveil '), 'Ersveil');
    assert.equal(shortPackName(''), '');
    const [p] = normalizeCast([person()], dateText);
    assert.equal(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil (open world)' }).castFrom.packName, 'Ersveil');
    assert.equal(castBadge(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: '(x)' }).castFrom), 'Cast', 'nothing left of the name: just Cast');
});

test('the pack\'s words stay exactly as written until the field is changed; then it is compacted like any other', () => {
    const [p] = normalizeCast([person({ entry: { ...FENNA_ENTRY, voice: 'Dry and slow. Never raises her voice; goes quieter when angry. Calls everyone love or sailor. Asks about food first. Hums when worried. Says aye.' } })], dateText);
    const made = normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil' }));
    assert.equal(made.speech, p.entry.voice, 'the whole voice, nothing dropped');
    assert.equal(normalizeNpcRecord(structuredClone(made)).speech, p.entry.voice, 'and again on the next load');
    const changed = normalizeNpcRecord({ ...made, speech: `${p.entry.voice} Whistles at the weir.` });
    assert.notEqual(changed.speech, `${p.entry.voice} Whistles at the weir.`, 'a changed field is compacted as for anyone');
});

test('a dossier already standing for the person is found by the cast key, name or alias, and is never replaced', () => {
    const [p] = normalizeCast([person()], dateText);
    const mine = normalizeNpcRecord({ ...createNpcRecord('Fenna', []), id: 'npc_fenna', castFrom: { key: 'ersveil:fenna' } });
    const byName = createNpcRecord('The Ferrywoman', []);
    assert.equal(dossierFor([createNpcRecord('Mira', []), mine], p), mine);
    assert.equal(dossierFor([createNpcRecord('Mira', []), createNpcRecord('FENNA', [])], p)?.name, 'FENNA', 'a dossier a scan made, by name');
    assert.equal(dossierFor([byName], p), byName, 'by an alias');
    assert.equal(dossierFor([createNpcRecord('Mira', [])], p), null);
});

test('what the dossier shows: the badge, first met, their own path, last heard (words escaped); Story Director gone, the pack\'s words stand', () => {
    const [p] = normalizeCast([person()], dateText);
    const made = normalizeNpcRecord(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil' }));
    assert.equal(castBadge(made.castFrom), 'Ersveil cast');
    assert.equal(castBadge({}), 'Cast');
    const view = castProjection(castView(made, p));
    assert.deepEqual([view.badge, view.firstMet, view.goal, view.routine], ['Ersveil cast', 'Gw 12 at Bluewatch docks', 'Find out who opened the weir', 'evenings at the ferry']);
    const html = castFromHtml(view);
    assert.match(html, /From the Ersveil cast · first met Gw 12 at Bluewatch docks/);
    assert.match(html, /<b>Their own path:<\/b> Find out who opened the weir/);
    assert.match(html, /<b>Last heard:<\/b> took the ferry upriver to Ashford \(Gw 15\)/);
    assert.match(castFromHtml(castProjection({ ...view, goal: '<img src=x onerror=1>', lastHeard: { text: '<b>x</b>', on: '' } })), /&lt;img src=x onerror=1&gt;[\s\S]*&lt;b&gt;x&lt;\/b&gt;/);
    const alone = castProjection(castView(made, null));
    assert.equal(alone.lastHeard, null);
    assert.equal(alone.goal, 'Find out who opened the weir', 'the starting words the pack gave');
    assert.doesNotMatch(castFromHtml(alone), /Last heard/);
    assert.match(castFromHtml(castProjection({ ...view, lastHeard: null, doing: 'Walks the road. ', where: 'Hollin\'s Reach' })), /<b>Now:<\/b> Walks the road · at Hollin&#039;s Reach|<b>Now:<\/b> Walks the road · at Hollin's Reach/, 'no lastHeard: what they do now and where, no stray full stop');
    assert.equal(castView(createNpcRecord('Mira', []), p), null, 'any other dossier shows none of it');
    assert.equal(castFromHtml(null), '');
    // The projection carries it to the view by dossier id.
    const state = projectDossierState({ npcs: [{ ...made, id: 'npc_fenna' }, { ...createNpcRecord('Mira', []), id: 'npc_mira' }], castViews: { npc_fenna: castView(made, p) } });
    assert.equal(state.npcs.find(npc => npc.id === 'npc_fenna').cast.badge, 'Ersveil cast');
    assert.equal(state.npcs.find(npc => npc.id === 'npc_mira').cast, undefined);
});

test('the twelve Ersveil entries all make a dossier: profile whole, fields, three to five notes, stages in the pack\'s shape with their cue', () => {
    assert.equal(ERSVEIL.length, 12);
    for (const raw of ERSVEIL) {
        const [p] = normalizeCast([{ key: `ersveil:${raw.id}`, pack: 'ersveil', id: raw.id, name: raw.name, aliases: raw.aliases, met: { on: 0, where: raw.start.place }, alive: true, entry: raw }], dateText);
        assert.ok(p?.entry, raw.id);
        const made = normalizeNpcRecord(applyCastEntry(createNpcRecord(raw.name, []), p, { packName: 'Ersveil (open world)' }));
        for (const field of ['look', 'voice', 'personality', 'history']) assert.ok(raw[field].length < 600 && p.entry[field] === raw[field], `${raw.id} ${field} kept whole`);
        assert.equal(made.overallAppearance, raw.look, raw.id);
        assert.equal(resolveNpcAppearance(made), raw.look, raw.id);
        assert.equal(made.speech, raw.voice, raw.id);
        assert.equal(made.personality, raw.personality, raw.id);
        assert.equal(made.background, raw.history, raw.id);
        assert.deepEqual(made.customFields, raw.fields, `${raw.id}: Soul Class and the other fields`);
        assert.ok(made.secrets.length >= 3 && made.secrets.length <= 5, `${raw.id}: ${made.secrets.length} notes`);
        assert.equal(made.secrets.filter(note => note.when && !note.meter).length, raw.secrets.filter(note => note.when).length, 'the story-event notes keep their words');
        assert.equal(made.secrets.map(note => note.text).join('|'), raw.secrets.map(note => note.text).join('|'), 'the texts whole, in order');
        assert.deepEqual(made.meterSetup, { track: raw.meters.preset, limits: {} });
        assert.deepEqual(made.castFrom.stages.map(stage => stage.name), raw.stages.map(stage => stage.name));
        assert.deepEqual(made.castFrom.stages.map(stage => stage.cue), raw.stages.map(stage => stage.milestone), 'the pack\'s milestone line is the stage\'s cue');
        assert.ok(made.castFrom.stages.every(stage => stage.milestone === undefined), 'and is never a milestone the stage needs');
        for (const meter of ['trust', 'affection', 'tension']) assert.equal(made.relationship[meter], raw.meters[meter], `${raw.id} ${meter}`);
    }
});

test('observeCast records each met person with an entry once; nobody is taken out; no answer changes nothing', () => {
    const [p] = normalizeCast([person()], dateText);
    const first = observeCast(undefined, [p, ...normalizeCast([unmet()])]);
    assert.deepEqual(first.fresh.map(item => item.key), ['ersveil:fenna']);
    assert.deepEqual(first.cast, { 'ersveil:fenna': { name: 'Fenna', rungs: 2 } });
    assert.deepEqual(validateNpcSlice({ npcs: {}, problems: [], cast: first.cast }), []);
    const again = observeCast(first.cast, [p]);
    assert.deepEqual(again.fresh, []);
    assert.equal(again.cast, first.cast, 'the same record');
    assert.equal(observeCast(first.cast, []).cast, first.cast, 'a person Story Director no longer lists stays recorded');
    assert.equal(observeCast(first.cast, null).cast, first.cast);
    assert.ok(validateNpcSlice({ npcs: {}, problems: [], cast: { 'bad key!': { name: 'x' } } }).length, 'an unusable key is refused');
    assert.ok(validateNpcSlice({ npcs: {}, problems: [], cast: { 'a:b': { name: 'x', extra: 1 } } }).length, 'and an unknown field');
});

test('parsePeople reads each People form into the shapes the dossier stores', () => {
    const empty = { species: '', gender: '', age: '', apparentAge: '' };
    assert.deepEqual(parsePeople('Dogfolk woman, 21'), { ...empty, species: 'Dogfolk', gender: 'female', age: '21' });
    assert.deepEqual(parsePeople('Dwelf, 58 (looks about 25)'), { ...empty, species: 'Dwelf', age: '58', apparentAge: '~25' });
    assert.deepEqual(parsePeople('Elf, about 240 (looks about 35)'), { ...empty, species: 'Elf', age: 'about 240', apparentAge: '~35' });
    assert.deepEqual(parsePeople('Fairy, about 160'), { ...empty, species: 'Fairy', age: 'about 160' });
    assert.deepEqual(parsePeople('Spiritfolk, formed about 300 years ago (looks about 30)'), { ...empty, species: 'Spiritfolk', age: 'about 300', apparentAge: '~30' });
    assert.deepEqual(parsePeople('Human man, 40'), { ...empty, species: 'Human', gender: 'male', age: '40' });
    assert.equal(parsePeople('Orc, 30').gender, '', 'gender is never inferred');
});

test('parsePeople leaves unparsable text alone: nothing is guessed', () => {
    const none = { species: '', gender: '', age: '', apparentAge: '' };
    for (const text of ['', 'Wanders the marsh at night', 'Elf, ancient', 'Elf, young (looks about 20 or so)', '12, 21', 'Elf']) assert.deepEqual(parsePeople(text), none, text);
});

test('a made dossier takes species, gender and age from People, and keeps People as a custom field', () => {
    const [p] = normalizeCast([person({ entry: { ...FENNA_ENTRY, fields: { People: 'Elf woman, about 240 (looks about 35)' } } })], dateText);
    const made = normalizeProduction(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil' }));
    assert.deepEqual([made.species, made.gender, made.age, made.apparentAge], ['Elf', 'female', 'about 240', '~35']);
    assert.equal(made.customFields.People, 'Elf woman, about 240 (looks about 35)');
    const again = normalizeProduction(applyCastEntry(createNpcRecord('Fenna', []), p, { packName: 'Ersveil' }));
    const { createdAt, updatedAt, ...sameAgain } = again, { createdAt: c0, updatedAt: u0, ...sameMade } = made;
    assert.deepEqual(sameAgain, sameMade, 'the same entry gives the same dossier (replay and import)');
});

test('People never overwrites a value the record already has, and unparsable People changes nothing', () => {
    const [p] = normalizeCast([person({ entry: { ...FENNA_ENTRY, fields: { People: 'Elf woman, 30' } } })], dateText);
    const base = { ...createNpcRecord('Fenna', []), species: 'Human', age: '41' };
    const made = applyCastEntry(base, p, { packName: 'Ersveil' });
    assert.deepEqual([made.species, made.gender, made.age], ['Human', 'female', '41']);
    const [q] = normalizeCast([person({ entry: { ...FENNA_ENTRY, fields: { People: 'Roams the hills' } } })], dateText);
    const plain = applyCastEntry(createNpcRecord('Fenna', []), q, { packName: 'Ersveil' });
    assert.deepEqual([plain.species, plain.gender, plain.age, plain.apparentAge], ['', '', '', '']);
    assert.equal(plain.customFields.People, 'Roams the hills');
});
