// Encounters, the pure engine: the pack's backdrop list checks, the table (place, time, conditions, cast, the scene, promotions),
// the seeded roll, the proposed note line, the ledger and promotion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackdrops, encounterTable, rollEncounter, sceneKey, encounterLine, ledgerOf, withResult, withBinding, ledgerErrors, promotionOf } from '../../../../modules/world/encounters/index.js';
import { DEFAULT_BACKDROPS, QUIET_WEIGHTS } from '../../../../modules/world/encounters/index-parts/defaults.js';

const FERRY = { id: 'ferryman', who: 'the ferryman', look: 'a lean man poling the barge', at: ['bluewatch-village'], weight: 3 };
const LOCK = { id: 'lock-boy', who: "a lock-keeper's boy", kinds: ['village'], when: ['morning'], likelier_if: ['flood'], less_if: ['curfew'] };
const PLACE = { key: 'bluewatch-village', name: 'Bluewatch Village', aliases: [], kind: 'village', klass: 'village', group: 'town' };
const pack = normalizeBackdrops([FERRY, LOCK]).rows;

test('backdrops: a bad entry is dropped with a Problem naming it and the field; the rest load', () => {
    const { rows, problems } = normalizeBackdrops([FERRY, { id: 'Bad Id', who: 'x', at: ['a'] }, { id: 'no-where', who: 'a man' }, { id: 'late', who: 'an owl', at: ['a'], when: ['midnight'] }, { ...FERRY }, { id: 'heavy', who: 'a giant', at: ['a'], weight: 11 }]);
    assert.deepEqual(rows.map(row => row.id), ['ferryman']);
    assert.equal(problems.length, 5);
    assert.match(problems[0], /Bad Id: id/);
    assert.match(problems[1], /no-where: at or kinds/);
    assert.match(problems[2], /late: when takes only/);
    assert.match(problems[3], /ferryman: id is used twice/);
    assert.match(problems[4], /heavy: weight/);
    assert.deepEqual(normalizeBackdrops(undefined), { rows: [], problems: [] });
    assert.deepEqual(normalizeBackdrops({}).problems, ['backdrops must be a list.']);
    assert.equal(rows[0].recurring, true, 'a pack backdrop is one person unless it says otherwise');
});

test('table: quiet by class first, then pack rows that belong here (by place or kind, time of day), then the group defaults, then the met cast', () => {
    const rows = encounterTable({ place: PLACE, pack, cast: [{ key: 'temiwa', name: 'Temiwa' }], time: 'morning' });
    assert.equal(rows[0].kind, 'quiet');
    assert.equal(rows[0].weight, QUIET_WEIGHTS.village);
    assert.deepEqual(rows.slice(1, 3).map(row => row.ref), ['ferryman', 'lock-boy@bluewatch-village'], 'by name: one person everywhere; by kind: one per place');
    assert.ok(rows.some(row => row.ref === 'default-town-hawker@bluewatch-village'));
    assert.equal(rows.at(-1).ref, 'cast:temiwa');
    const evening = encounterTable({ place: PLACE, pack, time: 'evening' });
    assert.ok(!evening.some(row => row.ref.startsWith('lock-boy')), 'a row for the morning is not there in the evening');
    assert.ok(!evening.some(row => row.ref.startsWith('default-town-hawker')));
    const elsewhere = encounterTable({ place: { ...PLACE, key: 'highmark', name: 'Highmark', kind: 'city', klass: 'city', group: 'town' }, pack, time: 'morning' });
    assert.ok(!elsewhere.some(row => row.source === 'pack'), 'neither the ferryman (another place) nor the lock boy (another kind)');
    assert.equal(elsewhere[0].weight, QUIET_WEIGHTS.city);
});

test('table: conditions that hold here weigh a row up or down; the scene and promotions change who is a row', () => {
    const weight = conditions => encounterTable({ place: PLACE, pack, time: 'morning', conditions }).find(row => row.ref.startsWith('lock-boy')).weight;
    assert.equal(weight([]), 1);
    assert.equal(weight(['flood']), 2);
    assert.equal(weight(['flood', 'curfew']), 1);
    assert.equal(weight(['curfew']), 0.5);
    const ledger = { seen: { ferryman: { n: 2, at: 4 } }, bound: { ferryman: { key: 'npc_oskar', name: 'Oskar', at: 6 } } };
    const ferry = encounterTable({ place: PLACE, pack, ledger }).find(row => row.ref === 'ferryman');
    assert.deepEqual([ferry.seen, ferry.name, ferry.npc], [2, 'Oskar', 'npc_oskar']);
    assert.ok(!encounterTable({ place: PLACE, pack, ledger, present: new Set(['oskar']) }).some(row => row.ref === 'ferryman'), 'Oskar is in the scene already');
    assert.ok(!encounterTable({ place: PLACE, pack, cast: [{ key: 'temiwa', name: 'Temiwa' }], present: new Set(['temiwa']) }).some(row => row.kind === 'cast'));
    for (const row of DEFAULT_BACKDROPS) assert.equal(row.recurring, false, `${row.id}: a built-in backdrop is anonymous`);
});

test('roll: the same seed, day and scene give the same row; the draw follows the weights', () => {
    const rows = encounterTable({ place: PLACE, pack, time: 'morning' });
    const key = sceneKey(PLACE, 'morning');
    assert.equal(key, 'encounter|bluewatch-village|morning');
    const one = rollEncounter(rows, { seed: 'abc', day: 12, key });
    assert.deepEqual(rollEncounter(rows, { seed: 'abc', day: 12, key }), one);
    const counts = {};
    for (let day = 0; day < 400; day += 1) { const { row } = rollEncounter(rows, { seed: 'abc', day, key }); counts[row.kind] = (counts[row.kind] ?? 0) + 1; }
    const quietShare = rows[0].weight / rows.reduce((sum, row) => sum + row.weight, 0);
    assert.ok(Math.abs(counts.quiet / 400 - quietShare) < 0.1, `quiet ${counts.quiet}/400 near ${quietShare}`);
    assert.deepEqual(rollEncounter([], { seed: 'abc', day: 1, key }).row, null);
});

test('line (proposed wording): first sighting, seen before, promoted, cast; nothing for quiet', () => {
    const base = { kind: 'backdrop', who: 'the ferryman', look: 'a lean man poling the barge', place: 'Bluewatch Village', seen: 0 };
    assert.equal(encounterLine(base), 'Encounter this reply: the ferryman (Bluewatch Village) — a lean man poling the barge. Show them in passing; they need not speak, and they decide nothing for you.');
    assert.match(encounterLine({ ...base, seen: 1 }), /Seen here before: keep them the same person\./);
    assert.equal(encounterLine({ ...base, name: 'Oskar' }), 'Encounter this reply: Oskar, the ferryman (Bluewatch Village). Show them in passing; they need not speak, and they decide nothing for you.');
    assert.match(encounterLine({ kind: 'cast', who: 'Temiwa', place: 'Bluewatch Village' }), /^Encounter this reply: Temiwa crosses your path \(Bluewatch Village\)/);
    assert.equal(encounterLine({ kind: 'quiet', who: '' }), '');
    assert.ok(encounterLine({ ...base, look: 'x'.repeat(400) }).length <= 320);
});

test('ledger: one result a reply, a sighting counted once a reply, a binding kept; the validator', () => {
    let ledger = ledgerOf({});
    const entry = { at: 4, day: 1, key: 'k', kind: 'backdrop', ref: 'ferryman', recurring: true };
    ledger = withResult(ledger, entry);
    ledger = withResult(ledger, entry);
    assert.deepEqual(ledger.seen, { ferryman: { n: 1, at: 4 } }, 'a Re-read of the same reply counts once');
    ledger = withResult(ledger, { ...entry, at: 6 });
    assert.equal(ledger.seen.ferryman.n, 2);
    ledger = withResult(ledger, { at: 8, day: 1, key: 'k2', kind: 'backdrop', ref: 'default-town-hawker@x', recurring: false });
    assert.equal(ledger.seen['default-town-hawker@x'], undefined, 'an anonymous backdrop is never counted');
    for (let at = 10; at < 30; at += 2) ledger = withResult(ledger, { at, day: 2, key: `k${at}`, kind: 'quiet', ref: 'quiet' });
    assert.equal(ledger.results.length, 6);
    ledger = withBinding(ledger, { ref: 'ferryman', key: 'npc_oskar', name: 'Oskar', at: 6 });
    assert.deepEqual(ledgerErrors({ encounters: [ledger] }), []);
    assert.deepEqual(ledgerErrors({}), []);
    assert.equal(ledgerErrors({ encounters: [{ results: 'x' }] }).length, 1);
    assert.deepEqual(ledgerOf({ encounters: [ledger] }).bound.ferryman.name, 'Oskar');
});

test('promotion: the one dossier the reply names whose role fits who the backdrop is; never a pack person, a second binding or a guess', () => {
    const entry = { kind: 'backdrop', ref: 'ferryman', who: 'the ferryman', recurring: true };
    const oskar = { id: 'npc_oskar', name: 'Oskar', role: 'ferryman' };
    const text = '"Oskar," he says, tapping his chest.';
    assert.deepEqual(promotionOf({ entry, npcs: { npc_oskar: oskar }, text }), { ref: 'ferryman', key: 'npc_oskar', name: 'Oskar' });
    assert.equal(promotionOf({ entry, npcs: { npc_oskar: oskar }, text: 'The ferryman nods.' }), null, 'not named in the reply');
    assert.equal(promotionOf({ entry, npcs: { npc_oskar: { ...oskar, role: 'smith' } }, text }), null, 'a role that does not fit');
    assert.equal(promotionOf({ entry, npcs: { npc_oskar: { ...oskar, castFrom: { key: 'oskar' } } }, text }), null, 'a pack person is the cast part\'s');
    assert.equal(promotionOf({ entry, npcs: { npc_oskar: oskar }, text, bound: { 'lock-boy@x': { key: 'npc_oskar' } } }), null, 'already another backdrop');
    const two = { npc_oskar: oskar, npc_ilse: { id: 'npc_ilse', name: 'Ilse', role: 'relief ferryman' } };
    assert.equal(promotionOf({ entry, npcs: two, text: 'Oskar and Ilse wave.' }), null, 'two fit: no guessing');
    assert.equal(promotionOf({ entry: { ...entry, recurring: false }, npcs: { npc_oskar: oskar }, text }), null, 'an anonymous backdrop is never promoted');
    assert.equal(promotionOf({ entry: { ...entry, name: 'Oskar' }, npcs: { npc_oskar: oskar }, text }), null, 'already promoted');
});
