import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lineKey } from '../src/changes.js';
import { applyOps, emptyTracker, findRecord, keyWords, nearMatches, questsDoneIn, replay, untrackedCorrections } from '../src/tracker.js';
import { BLUEWATCH, WOLF_HUNT, after, deepFreeze, ops } from './tracker.helpers.js';
test('keyWords drops case, punctuation, a leading article and small connective words', () => {
    assert.deepEqual(keyWords('Footing in Bluewatch'), ['footing', 'bluewatch']);
    assert.deepEqual(keyWords('**The** footing, at BLUEWATCH!'), ['footing', 'bluewatch']);
    assert.deepEqual(keyWords('A Fall of the Weir'), ['fall', 'weir']);
    // Only a leading article goes; "a" inside a key stays.
    assert.deepEqual(keyWords('Plan a Heist'), ['plan', 'a', 'heist']);
    assert.deepEqual(keyWords('The'), []);
});

test('a ~ on a near key is applied to the one record it means', () => {
    for (const key of ['Footing in Bluewatch', 'FOOTING IN BLUEWATCH', 'The Footing, Bluewatch', 'Footing for Bluewatch!']) {
        const { tracker, problems } = after(`~ ${key} — now: a room at the inn`);
        assert.equal(findRecord(tracker, 'Footing at Bluewatch').fields.now, 'a room at the inn', key);
        assert.equal(tracker.records.length, 3, key);
        assert.deepEqual(problems.map(({ kind, severity, text }) => ({ kind, severity, text })), [
            { kind: 'near-key', severity: 'info', text: `"${key}" read as "Footing at Bluewatch".` },
        ], key);
        assert.deepEqual(findRecord(tracker, 'Footing at Bluewatch').history.at(-1), { message: 1, op: '~', text: `~ ${key} — now: a room at the inn`, time: 10 });
    }
});

test('near keys: containment of two words or more, word overlap, and ! and -', () => {
    // The shorter key's words inside the longer's (two words or more).
    let result = after('~ Senior Listener Geva of the Court — then: files the warrant');
    assert.equal(findRecord(result.tracker, 'Senior Listener Geva').fields.then, 'files the warrant');
    result = after('! Weir Fall — the river floods | now: flooded fields');
    assert.equal(findRecord(result.tracker, 'The Fall of the Weir').fields.now, 'flooded fields');
    // One word is not enough to be contained: Geva alone is not a match.
    result = after('~ Geva — then: files the warrant');
    assert.equal(findRecord(result.tracker, 'Senior Listener Geva').fields.then, '');
    assert.equal(findRecord(result.tracker, 'Geva').kind, 'hook');
    // A `-` on a near key resolves it.
    result = after('- Fall of Weir — rebuilt');
    assert.equal(findRecord(result.tracker, 'The Fall of the Weir').status, 'resolved');
    assert.equal(result.problems[0].kind, 'near-key');
    // Jaccard 3/4: three of four words shared.
    const four = replay([{ message: 0, time: 0, ops: ops('+ hook Smugglers under Shorn docks tunnel — rumours') }]).tracker;
    assert.deepEqual(nearMatches(four.records, 'Smugglers Shorn tunnel').map(entry => entry.record.key), ['Smugglers under Shorn docks tunnel']);
    assert.deepEqual(nearMatches(four.records, 'Smugglers Shorn harbour tunnel'), []);
});

test('two near records are never guessed between', () => {
    const base = ops('+ hook Footing at Bluewatch — a foothold\n+ hook Footing on Bluewatch — another');
    const { tracker, problems } = replay([
        { message: 0, time: 0, ops: base },
        { message: 1, time: 10, ops: ops('~ Footing in Bluewatch — now: a room at the inn') },
    ]);
    assert.equal(tracker.records.length, 2);
    assert.ok(tracker.records.every(record => record.fields.now === ''));
    assert.deepEqual(problems.map(({ kind, severity, key, op, candidates }) => ({ kind, severity, key, op, candidates })), [
        { kind: 'unknown-key', severity: 'warn', key: 'Footing in Bluewatch', op: '~', candidates: ['Footing at Bluewatch', 'Footing on Bluewatch'] },
    ]);
    assert.equal(problems[0].text, '"Footing in Bluewatch" is not tracked (it could be "Footing at Bluewatch" or "Footing on Bluewatch"); the ~ line was ignored.');
    assert.deepEqual(untrackedCorrections(problems), [
        '"Footing in Bluewatch" is not tracked: use its exact key ("Footing at Bluewatch" or "Footing on Bluewatch") or add it with "+ kind Footing in Bluewatch — …".',
    ]);
});

test('an exact word match wins over looser ones, and resolved records are not matched', () => {
    const { tracker, problems } = replay([
        { message: 0, time: 0, ops: ops('+ hook Footing at Bluewatch — a foothold\n+ hook Footing at Bluewatch docks — another\n+ hook Old Mill fire — smoke') },
        { message: 1, time: 5, ops: ops('- Old Mill fire — out') },
        { message: 2, time: 10, ops: ops('~ Footing in Bluewatch — now: a room\n! The Old Mill Fire — rekindled') },
    ]);
    assert.equal(findRecord(tracker, 'Footing at Bluewatch').fields.now, 'a room');
    assert.equal(findRecord(tracker, 'Footing at Bluewatch docks').fields.now, '');
    // Only active records are matched: the resolved fire is not fired again.
    assert.equal(findRecord(tracker, 'Old Mill fire').status, 'resolved');
    assert.deepEqual(problems.filter(problem => problem.message === 2).map(problem => problem.kind), ['near-key', 'unknown-key']);
});

test('a ~ with something to say on a key that is not tracked adds a hook', () => {
    const { tracker, problems } = after('~ Lantern Guild dues — now: two silver owed | people: Brann');
    const added = findRecord(tracker, 'Lantern Guild dues');
    assert.equal(added.kind, 'hook');
    assert.equal(added.status, 'active');
    assert.equal(added.fields.now, 'two silver owed');
    assert.equal(added.fields.people, 'Brann');
    assert.deepEqual(added.created, { message: 1, time: 10 });
    assert.deepEqual(added.history, [{ message: 1, op: '~', text: '~ Lantern Guild dues — now: two silver owed | people: Brann', time: 10 }]);
    assert.deepEqual(problems.map(({ kind, severity, key, text }) => ({ kind, severity, key, text })), [
        { kind: 'untracked-added', severity: 'info', key: 'Lantern Guild dues', text: '"Lantern Guild dues" was not tracked; added as a hook (write "+ kind Key" to set its kind).' },
    ]);
    assert.deepEqual(untrackedCorrections(problems), []);
    // A later ~ finds it by its key.
    const next = replay([{ message: 2, time: 20, ops: ops('~ Lantern Guild dues — then: paid') }], { seed: tracker });
    assert.deepEqual(next.problems, []);
    assert.equal(findRecord(next.tracker, 'Lantern Guild dues').fields.then, 'paid');
});

test('a type: that names a kind sets the added record\'s kind', () => {
    let { tracker, problems } = after('~ Bell tower collapse — type: clock | due: Haywane 20');
    assert.equal(findRecord(tracker, 'Bell tower collapse').kind, 'clock');
    assert.equal(findRecord(tracker, 'Bell tower collapse').fields.type, '');
    assert.match(problems[0].text, /added as a clock/);
    ({ tracker, problems } = after('~ Wolf pelts — type: bounty | reward: 10 crowns'));
    assert.equal(findRecord(tracker, 'Wolf pelts').kind, 'quest');
    assert.equal(findRecord(tracker, 'Wolf pelts').fields.type, 'bounty');
    ({ tracker, problems } = after('~ Ashen pact — type: agenda | now: waits'));
    assert.match(problems[0].text, /added as an agenda/);
    // A type that is no kind is a hook's part like any other.
    ({ tracker } = after('~ Side work — type: errand | now: open'));
    assert.equal(findRecord(tracker, 'Side work').kind, 'hook');
    assert.equal(findRecord(tracker, 'Side work').fields.type, 'errand');
});

test('~ with nothing to say and ! on a key that is not tracked are ignored and corrected; - stays a note', () => {
    const { tracker, problems } = after('~ Lantern Guild dues\n~ Lantern Guild dues — now:\n! Harbour riot — it broke out | now: fires\n- Ghost of Shorn — gone');
    assert.equal(tracker.records.length, 3);
    assert.deepEqual(problems.map(({ kind, severity, key, op }) => ({ kind, severity, key, op })), [
        { kind: 'unknown-key', severity: 'warn', key: 'Lantern Guild dues', op: '~' },
        { kind: 'unknown-key', severity: 'warn', key: 'Lantern Guild dues', op: '~' },
        { kind: 'unknown-key', severity: 'warn', key: 'Harbour riot', op: '!' },
        { kind: 'unknown-key', severity: 'info', key: 'Ghost of Shorn', op: '-' },
    ]);
    assert.equal(problems[2].text, '"Harbour riot" is not tracked; the ! line was ignored.');
    // Once per key; a `-` needs no correction.
    assert.deepEqual(untrackedCorrections(problems), [
        '"Lantern Guild dues" is not tracked: add it with "+ kind Lantern Guild dues — …" before changing it.',
        '"Harbour riot" is not tracked: add it with "+ kind Harbour riot — …" before changing it.',
    ]);
});

test('untrackedCorrections: at most three, only unknown ~ and ! lines', () => {
    const problem = (key, op = '~', kind = 'unknown-key') => ({ kind, severity: 'warn', key, op, message: 4, text: '' });
    const lines = untrackedCorrections([
        problem('One'), problem('one'), problem('Two', '!'), problem('Gone', '-'), problem('Near', '~', 'near-key'),
        problem('Three'), problem('Four'),
    ]);
    assert.deepEqual(lines.map(line => line.split('"')[1]), ['One', 'Two', 'Three']);
    assert.deepEqual(untrackedCorrections([problem('One')], { limit: 0 }), []);
    assert.deepEqual(untrackedCorrections(null), []);
});

test('corrections come only from the latest reply', () => {
    const { problems } = replay([
        { message: 0, time: 0, ops: BLUEWATCH },
        { message: 1, time: 5, ops: ops('! Harbour riot — it broke out') },
        { message: 2, time: 6, text: 'The player speaks.', ops: null },
        { message: 3, time: 10, ops: ops('~ Lantern Guild dues') },
        { message: 5, time: 20, ops: ops('~ Footing at Bluewatch — now: settled') },
    ]);
    assert.deepEqual(untrackedCorrections(problems, { message: 3 }), [
        '"Lantern Guild dues" is not tracked: add it with "+ kind Lantern Guild dues — …" before changing it.',
    ]);
    // The newest reply changed only what is tracked: nothing to correct, nothing repeated.
    assert.deepEqual(untrackedCorrections(problems, { message: 5 }), []);
    assert.equal(untrackedCorrections(problems).length, 2);
});

test('a made-up name for a tracked job still finds it: plurals, compounds, job words, its description (0.9.16)', () => {
    const rec = (key, fields = {}) => ({ key, id: key.toLowerCase(), status: 'active', kind: 'quest', fields: { desc: '', goal: '', ...fields } });
    const sheep = [rec('Sheepfold Wolves'), rec('Rat Culling', { desc: 'Kill granary rats' })];
    assert.deepEqual(nearMatches(sheep, 'Fold Wolf Contract').map(m => m.record.key), ['Sheepfold Wolves']);
    const ridge = [rec('Wolf Hunt', { desc: 'Kill ridge wolves threatening the sheep fold' }), rec('Rat Culling', { desc: 'Kill granary rats' })];
    assert.deepEqual(nearMatches(ridge, 'Fold Wolf Contract').map(m => m.record.key), ['Wolf Hunt']);
    assert.deepEqual(nearMatches(ridge, 'Granary Rats').map(m => m.record.key), ['Rat Culling']);
    // A job word alone says nothing; two that fit are both named, neither taken.
    assert.deepEqual(nearMatches(ridge, 'The Contract'), []);
    const two = [rec('Sheepfold Wolves'), rec('Wolves of the Fold')];
    assert.equal(nearMatches(two, 'Fold Wolf Bounty').length, 2);
    // Applied: the ! goes to the one it means.
    const start = applyOps(emptyTracker(), ops('+ quest Wolf Hunt — Kill ridge wolves threatening the sheep fold | giver: Danique | reward: 4 silver'), { message: 1 }).tracker;
    const { problems } = applyOps(start, ops('! Fold Wolf Contract — the pack broke the hurdles again'), { message: 2 });
    assert.equal(problems[0].kind, 'near-key');
});

test('a name read as a record once is remembered, and later lines with it apply quietly (0.9.19)', () => {
    const entries = [
        { message: 1, time: 0, text: '', ops: ops(WOLF_HUNT) },
        { message: 3, time: 10, text: '', ops: ops('! Fold Wolf Contract — the pack broke the hurdles again\n~ Fold Wolf Contract — step: tracking the pack') },
        { message: 5, time: 20, text: '', ops: ops('~ **Fold Wolf Contract** — step: at the den') },
    ];
    const { tracker, problems } = replay(entries);
    // Matched once, in the first line; the second line of that reply and the next reply find it by its alias.
    assert.deepEqual(problems.map(problem => [problem.kind, problem.message]), [['near-key', 3]]);
    const hunt = findRecord(tracker, 'Wolf Hunt');
    assert.deepEqual(hunt.aliases, ['fold wolf contract']);
    assert.equal(hunt.fields.step, 'at the den');
    assert.deepEqual(hunt.history.map(entry => entry.message), [1, 3, 3, 5], 'each line leaves its trace on the record');
    assert.equal(tracker.records.length, 1);
    // Closed by its alias, it is a quest done; closing it again by that name changes nothing.
    const done = applyOps(tracker, ops('- Fold Wolf Contract — ears delivered, Danique paid'), { message: 7 });
    assert.deepEqual(done.problems, []);
    assert.deepEqual(questsDoneIn(done.tracker, 7).map(quest => quest.name), ['Wolf Hunt']);
    const again = applyOps(done.tracker, ops('- Fold Wolf Contract — done\n~ Fold Wolf Contract — reward: 4 silver and a ham'), { message: 9 });
    assert.equal(again.problems[0].kind, 'already-closed');
    assert.equal(again.tracker.records.length, 1, 'no new hook for a name it already has');
    assert.deepEqual(questsDoneIn(again.tracker, 9), []);
    // Nothing is remembered from an ambiguous key, a new hook or an exact key.
    const two = replay([
        { message: 1, time: 0, ops: ops('+ hook Footing at Bluewatch — a foothold\n+ hook Footing on Bluewatch — another') },
        { message: 2, time: 0, ops: ops('~ Footing in Bluewatch — now: a room\n~ Lantern Guild dues — now: owed\n~ Footing at Bluewatch — now: settled') },
    ]).tracker;
    assert.ok(two.records.every(record => record.aliases.length === 0));
});

test('a + on a remembered name is that record: a change, the quest taken on, or still an offer (0.9.19)', () => {
    const start = replay([
        { message: 1, time: 0, ops: ops('+ hook Sheepfold Wolves — wolves at the east fold | reward: 2 silver per ear') },
        { message: 2, time: 0, ops: ops('~ Fold Wolf Contract — shown: tracks by the pen') },
    ]).tracker;
    assert.deepEqual(findRecord(start, 'Sheepfold Wolves').aliases, ['fold wolf contract']);
    assert.equal(findRecord(start, 'Sheepfold Wolves').kind, 'hook');
    // A + of the same kind: applied as a change, saying which record it is.
    const plain = applyOps(start, ops('+ hook Fold Wolf Contract — now: the pack circles'), { message: 3 });
    assert.equal(plain.tracker.records.length, 1);
    assert.deepEqual(plain.problems.map(problem => [problem.kind, problem.message]), [
        ['duplicate-add', '"Fold Wolf Contract" is already tracked as "Sheepfold Wolves"; the + was applied as a change.'],
    ]);
    assert.equal(findRecord(plain.tracker, 'Sheepfold Wolves').fields.now, 'the pack circles');
    // + quest: the job taken on only on the reader's word (0.9.15), never a second record.
    const offered = applyOps(start, ops('+ quest Fold Wolf Contract — cull the pack | giver: Nelke'), { message: 3, said: 'What does it pay?' });
    assert.equal(offered.tracker.records.length, 1);
    assert.equal(findRecord(offered.tracker, 'Sheepfold Wolves').kind, 'hook');
    assert.equal(offered.problems[0].kind, 'offered');
    const taken = applyOps(start, ops('+ quest Fold Wolf Contract — cull the pack | giver: Nelke'), { message: 3, said: 'Fine, I\'ll take it.' });
    assert.equal(taken.tracker.records.length, 1);
    assert.equal(findRecord(taken.tracker, 'Sheepfold Wolves').kind, 'quest');
    assert.equal(findRecord(taken.tracker, 'Sheepfold Wolves').fields.giver, 'Nelke');
    assert.equal(taken.problems[0].kind, 'became-quest');
    // With two jobs in the reply, the reader names this one by the name the story gave it.
    const both = '+ quest Fold Wolf Contract — cull the pack | giver: Nelke\n+ quest Rat Culling — rats | giver: Danique | reward: 8 copper';
    const named = applyOps(start, ops(both), { message: 3, said: 'I accept the fold wolf contract.' }).tracker;
    assert.deepEqual(named.records.map(record => [record.key, record.kind]), [['Sheepfold Wolves', 'quest'], ['Rat Culling', 'hook']]);
    // Closed, a + on the name reopens it, as one on its key would.
    const closed = applyOps(start, ops('- Sheepfold Wolves — the pack moved on'), { message: 3 }).tracker;
    const reopened = applyOps(closed, ops('+ hook Fold Wolf Contract — the pack is back'), { message: 4 });
    assert.equal(reopened.problems[0].kind, 'reopened');
    assert.equal(reopened.tracker.records.length, 1);
    assert.equal(findRecord(reopened.tracker, 'Sheepfold Wolves').status, 'active');
    assert.deepEqual(findRecord(reopened.tracker, 'Sheepfold Wolves').aliases, ['fold wolf contract'], 'its names are identity, kept');
});

test('aliases: a record\'s own id wins, the first record keeps a name two claim, the newest eight are kept (0.9.19)', () => {
    const base = applyOps(emptyTracker(), ops('+ hook Sheepfold Wolves — wolves at the fold\n+ hook Wolves of the Fold — the other pack\n+ hook Fold Wolf Contract — a real record by that name'), { message: 1 }).tracker;
    // Built by hand: both packs claim the same name, and one claims another record's key.
    const claimed = { ...base, records: base.records.map((record, index) => ({ ...record, aliases: index < 2 ? ['the fold pack', 'fold wolf contract'] : [] })) };
    const { tracker, problems } = applyOps(claimed, ops('~ The Fold Pack — now: howling\n~ Fold Wolf Contract — now: signed'), { message: 2 });
    assert.deepEqual(problems, [], 'neither line is matched afresh, so neither is ambiguous');
    assert.deepEqual(tracker.records.map(record => record.fields.now), ['howling', '', 'signed']);
    assert.equal(findRecord(claimed, 'the fold pack').key, 'Sheepfold Wolves');
    assert.equal(findRecord(claimed, 'Fold Wolf Contract').key, 'Fold Wolf Contract');
    // A name already held is not taken by another record: the first keeps it.
    const once = replay([
        { message: 1, time: 0, ops: ops('+ hook Sheepfold Wolves — wolves at the fold') },
        { message: 2, time: 0, ops: ops('~ Fold Wolf Bounty — now: tracks') },
        { message: 3, time: 0, ops: ops('+ hook Wolves of the Fold — the other pack') },
        { message: 4, time: 0, ops: ops('~ Fold Wolf Bounty — now: howling') },
    ]);
    assert.deepEqual(once.tracker.records.map(record => [record.key, record.fields.now, record.aliases]), [
        ['Sheepfold Wolves', 'howling', ['fold wolf bounty']], ['Wolves of the Fold', '', []],
    ]);
    assert.deepEqual(once.problems.map(problem => problem.kind), ['near-key'], 'two records fit now, but the name is already the first one\'s');
    // At most eight names, the newest kept.
    const names = ['Footing in Bluewatch', 'Footing on Bluewatch', 'Footing for Bluewatch', 'Footing to Bluewatch', 'Footing from Bluewatch', 'The Footing at Bluewatch', 'Footing, Bluewatch', 'A Footing in Bluewatch', 'Footing of Bluewatch', 'Footing and Bluewatch'];
    let many = applyOps(emptyTracker(), ops('+ hook Footing at Bluewatch — a foothold'), { message: 0 }).tracker;
    many = applyOps(many, ops(names.map((name, index) => `~ ${name} — now: room ${index}`).join('\n')), { message: 1 }).tracker;
    const footing = findRecord(many, 'Footing at Bluewatch');
    assert.equal(footing.aliases.length, 8);
    assert.deepEqual(footing.aliases, names.slice(2).map(name => lineKey(name)));
    assert.equal(footing.fields.now, 'room 9');
    assert.equal(findRecord(many, 'Footing in Bluewatch'), null, 'the oldest names are let go');
});

test('aliases replay deterministically, roll back with the reply, and need nothing from older trackers (0.9.19)', () => {
    const entries = [
        { message: 1, time: 0, text: '', ops: ops(WOLF_HUNT) },
        { message: 3, time: 10, text: '', ops: ops('! Fold Wolf Contract — the pack attacks') },
        { message: 5, time: 20, text: '', ops: ops('~ Fold Wolf Contract — step: at the den') },
    ];
    assert.deepEqual(replay(entries), replay(entries));
    // The reply that made the alias swiped away: the name is gone with it.
    const rolled = replay(entries.slice(0, 1)).tracker;
    assert.deepEqual(findRecord(rolled, 'Wolf Hunt').aliases, []);
    assert.equal(findRecord(rolled, 'Fold Wolf Contract'), null);
    const later = replay([entries[0], entries[2]]);
    assert.equal(later.problems[0].kind, 'near-key', 'without it, the next line is matched afresh');
    // A tracker saved before 0.9.19 has no aliases at all, and inputs stay untouched.
    const old = applyOps(emptyTracker(), ops(WOLF_HUNT), { message: 1 }).tracker;
    const seed = deepFreeze({ ...old, records: old.records.map(({ aliases: _a, ...record }) => record) });
    const { tracker } = replay(entries.slice(1), { seed });
    assert.equal(seed.records[0].aliases, undefined);
    assert.deepEqual(findRecord(tracker, 'Wolf Hunt').aliases, ['fold wolf contract']);
    assert.equal(findRecord(tracker, 'Wolf Hunt').fields.step, 'at the den');
    assert.equal(findRecord(seed, 'Fold Wolf Contract'), null);
});

test('findRecord finds a record by a name it was reached by (0.9.19)', () => {
    const { tracker } = replay([
        { message: 1, time: 0, ops: ops(WOLF_HUNT) },
        { message: 2, time: 0, ops: ops('~ Fold Wolf Contract — step: tracking') },
    ]);
    assert.equal(findRecord(tracker, 'Fold Wolf Contract').key, 'Wolf Hunt');
    assert.equal(findRecord(tracker, '**fold wolf contract!**').key, 'Wolf Hunt');
    assert.equal(findRecord(tracker, 'wolf hunt').key, 'Wolf Hunt');
    assert.equal(findRecord(tracker, 'Fold Wolf'), null, 'an alias is matched whole');
});
