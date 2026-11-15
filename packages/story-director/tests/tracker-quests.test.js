import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseChanges } from '../src/changes.js';
import { applyOps, emptyTracker, findRecord, givenUpIn, questsDoneIn, replay, untrackedCorrections } from '../src/tracker.js';
import { ops } from './tracker.helpers.js';
test('a hook taken on becomes a quest: ~ with its own parts (0.8.6)', () => {
    const start = applyOps(emptyTracker(), parseChanges('+ hook Sheep-killer — Beast taking sheep by the drainage ditch\n+ event Market day — stalls on the green\n+ agenda Marrit — now: unloading').ops, { message: 1, time: 0 }).tracker;
    const taken = applyOps(start, parseChanges('~ Sheep-killer — giver: Hobb | reward: 4 silver | difficulty: easy | type: bounty').ops, { message: 3, time: 0 });
    const quest = findRecord(taken.tracker, 'Sheep-killer');
    assert.equal(quest.kind, 'quest');
    assert.equal(quest.fields.type, 'bounty');
    assert.equal(quest.fields.giver, 'Hobb');
    assert.equal(quest.fields.desc, 'Beast taking sheep by the drainage ditch', 'what it was is kept');
    assert.ok(taken.problems.some(problem => problem.kind === 'became-quest'));
    // Done in a later reply, it counts as a finished quest (RPG Battle's quest XP).
    const done = applyOps(taken.tracker, parseChanges('- Hook Sheep-killer — slain at the ditch').ops, { message: 5, time: 0 });
    assert.deepEqual(questsDoneIn(done.tracker, 5).map(entry => [entry.name, entry.difficulty, entry.reward]), [['Sheep-killer', 'easy', '4 silver']]);
    // `type: quest` alone makes one, and says nothing more.
    const typed = applyOps(start, parseChanges('~ Market day — type: quest').ops, { message: 3, time: 0 }).tracker;
    assert.equal(findRecord(typed, 'Market day').kind, 'quest');
    assert.equal(findRecord(typed, 'Market day').fields.type ?? '', '');
    // Plain changes, or someone off-screen, stay what they were.
    const plain = applyOps(start, parseChanges('~ Sheep-killer — shown: tracks by the pen\n~ Marrit — reward: a cut of the cargo').ops, { message: 3, time: 0 }).tracker;
    assert.equal(findRecord(plain, 'Sheep-killer').kind, 'hook');
    assert.equal(findRecord(plain, 'Marrit').kind, 'agenda');
});

test('a quest closed without a - line: step done, status completed, a ! that says so (0.9.1)', () => {
    const start = applyOps(emptyTracker(), ops('+ quest Sheep-killer — kill the wolf | giver: Garrow | step: track it to the den | reward: 2 silver'), { message: 1 }).tracker;
    const after = (line, message = 2) => applyOps(start, ops(line), { message });
    for (const line of [
        '~ Sheep-killer — step: done',
        '~ Sheep-killer — status: completed',
        '~ Sheep-killer — step: completed — the wolf is dead, Garrow paid',
        '! Sheep-killer — the wolf is slain and the reward paid',
        '! Sheep-killer — quest completed',
    ]) {
        const { tracker, problems } = after(line);
        const quest = findRecord(tracker, 'Sheep-killer');
        assert.equal(quest.status, 'resolved', line);
        assert.equal(problems[0].kind, 'closed-by-change', line);
        assert.equal(questsDoneIn(tracker, 2).length, 1, `${line}: counts as done for RPG Battle`);
    }
    // Failure closes it too, but is not a quest done.
    const failed = after('~ Sheep-killer — outcome: failed — the flock is lost').tracker;
    assert.equal(findRecord(failed, 'Sheep-killer').status, 'resolved');
    assert.deepEqual(questsDoneIn(failed, 2), []);
    // A step still to do, or a ! that only moves it on, keeps it open.
    for (const line of ['~ Sheep-killer — step: complete the hunt at dawn', '~ Sheep-killer — step: done tracking, now the den', '! Sheep-killer — tracks found by the river']) {
        assert.equal(findRecord(after(line).tracker, 'Sheep-killer').status, 'active', line);
    }
    // Other kinds close on a status, not on their now.
    const hook = applyOps(emptyTracker(), ops('+ hook River stranger — who pulled Ren out'), { message: 1 }).tracker;
    assert.equal(findRecord(applyOps(hook, ops('~ River stranger — status: resolved'), { message: 2 }).tracker, 'River stranger').status, 'resolved');
    const agenda = applyOps(emptyTracker(), ops('+ agenda Geva — plots | now: waiting'), { message: 1 }).tracker;
    assert.equal(findRecord(applyOps(agenda, ops('~ Geva — now: done.'), { message: 2 }).tracker, 'Geva').status, 'active');
});

test('a step that opens with the ending and confirms it closes the quest; one that goes on to more work does not (0.9.42)', () => {
    const start = applyOps(emptyTracker(), ops('+ quest EastBluffWolves — hunt the crag wolves | giver: Fenna | step: find the pack | reward: 2 gold'), { message: 1 }).tracker;
    const after = line => applyOps(start, ops(line), { message: 2 });
    for (const line of [
        '~ EastBluffWolves — goal: Hunt starved crag wolf pack | reward: Claimed 2 gold | step: Completed and turned in to Fenna',
        '~ EastBluffWolves — step: Completed and turned in to Fenna',
        '~ EastBluffWolves — step: Done — bounty paid by Fenna',
        '~ EastBluffWolves — step: Finished and the reward collected',
        '~ EastBluffWolves — step: Completed and reported | reward: Claimed 2 gold',
        '~ EastBluffWolves — step: cleared and turned in for 60 copper',
    ]) {
        const { tracker, problems } = after(line);
        const quest = findRecord(tracker, 'EastBluffWolves');
        assert.equal(quest.status, 'resolved', line);
        assert.equal(problems[0].kind, 'closed-by-change', line);
        assert.equal(questsDoneIn(tracker, 2).length, 1, line);
    }
    // Still work to do, or a reward only promised: open.
    for (const line of [
        '~ EastBluffWolves — step: done tracking, now the den',
        '~ EastBluffWolves — step: Completed and heading back to Fenna',
        '~ EastBluffWolves — step: Completed and heading back | reward: 2 gold, paid on return',
        '~ EastBluffWolves — step: Finished the hunt, pelts to skin',
        '~ EastBluffWolves — step: cleared and heading back to Fenna | reward: 60 copper, paid on return',
    ]) {
        assert.equal(findRecord(after(line).tracker, 'EastBluffWolves').status, 'active', line);
    }
});

test('progress on a plain thread or a beat is not a quest; progress on an offered job is (0.9.2, 0.9.4)', () => {
    const start = applyOps(emptyTracker(), ops([
        '+ hook River stranger — who pulled Ren out',
        '+ beat Toll riders — reach the ford | on: Goldwane 19',
        '+ event Market day — stalls on the green',
        '+ hook Wolf pelts — the tanner pays for pelts | reward: 2 silver each | difficulty: hard',
        '+ hook Courier run — a sealed letter for Brightwater | type: contract',
    ].join('\n')), { message: 1 }).tracker;
    const after = line => applyOps(start, ops(line), { message: 2 }).tracker;
    // A plain thread: progress is not taking on a job.
    assert.equal(findRecord(after('~ River stranger — step: asked around at the inn'), 'River stranger').kind, 'hook');
    assert.equal(findRecord(after('~ River stranger — goal: find her | difficulty: hard'), 'River stranger').kind, 'hook');
    assert.equal(findRecord(after('~ River stranger — shown: wet footprints'), 'River stranger').kind, 'hook');
    // Beats are the world's.
    assert.equal(findRecord(after('~ Toll riders — giver: the Reeve | reward: 5 silver'), 'Toll riders').kind, 'beat');
    // An offered job moved on: the planner's bounty with its reward, a contract by its type.
    const pelts = findRecord(after('~ Wolf pelts — step: tracking the pack'), 'Wolf pelts');
    assert.equal(pelts.kind, 'quest');
    assert.equal(pelts.fields.reward, '2 silver each', 'its parts are kept');
    assert.equal(findRecord(after('~ Courier run — step: on the road north'), 'Courier run').kind, 'quest');
    assert.equal(findRecord(after('~ Wolf pelts — shown: a pelt hung at the tannery'), 'Wolf pelts').kind, 'hook', 'a change that does not move it on');
    // Taking on with a giver or reward, or naming it a quest, as before.
    assert.equal(findRecord(after('~ River stranger — giver: Lyra | reward: a favour owed'), 'River stranger').kind, 'quest');
    assert.equal(findRecord(after('~ Market day — reward: a free pie'), 'Market day').kind, 'quest');
    assert.equal(findRecord(after('~ Market day — type: bounty'), 'Market day').kind, 'quest');
    // An untracked key written with a giver or reward is a quest, not a hook.
    const untracked = applyOps(start, ops('~ Kettle Jack bounty — giver: Warden Hale | reward: 40 crowns'), { message: 2 }).tracker;
    assert.equal(findRecord(untracked, 'Kettle Jack bounty').kind, 'quest');
    assert.equal(findRecord(applyOps(start, ops('~ Odd lights — now: over the marsh'), { message: 2 }).tracker, 'Odd lights').kind, 'hook');
});

test('giving up: forfeit, quit and walked away close a quest as a failure; "quite" does not (0.9.6)', () => {
    const start = applyOps(emptyTracker(), ops('+ quest Sheep-killer — kill the wolf | giver: Garrow | reward: 2 silver'), { message: 1 }).tracker;
    for (const line of ['~ Sheep-killer — outcome: forfeit', '~ Sheep-killer — status: quit', '! Sheep-killer — Ren walked away from the hunt', '- Sheep-killer — called off after the flood']) {
        const tracker = applyOps(start, ops(line), { message: 2 }).tracker;
        assert.equal(findRecord(tracker, 'Sheep-killer').status, 'resolved', line);
        assert.deepEqual(questsDoneIn(tracker, 2), [], `${line}: a failure, no quest XP`);
    }
    const done = applyOps(start, ops('- Sheep-killer — turned in, quite a haul'), { message: 2 }).tracker;
    assert.equal(questsDoneIn(done, 2).length, 1, '"quite" is not "quit"');
});

test('givenUpIn: the open quests a message says are given up, by key or giver; negations do not count (0.9.6)', () => {
    const tracker = applyOps(emptyTracker(), ops('+ quest Sheep-killer — kill the wolf | giver: Garrow | reward: 2 silver\n+ quest Herb run — moonleaf | giver: Mother Ysolde | reward: 5 copper'), { message: 1 }).tracker;
    assert.deepEqual(givenUpIn(tracker, 'I give up on the Sheep-killer bounty. It is not worth my neck.'), ['Sheep-killer']);
    assert.deepEqual(givenUpIn(tracker, 'Tell Garrow I quit.'), ['Sheep-killer'], 'by the giver');
    assert.deepEqual(givenUpIn(tracker, "I won't give up on the Sheep-killer."), [], 'a negation');
    assert.deepEqual(givenUpIn(tracker, 'I give up. The rain wins.'), [], 'no quest named');
    assert.deepEqual(givenUpIn(tracker, 'We pick moonleaf for the Herb run. Ren gives up on sleep.'), [], 'the quest and the giving up in different sentences');
    assert.deepEqual(givenUpIn(tracker, 'I walk away from the Herb run and Mother Ysolde.'), ['Herb run']);
});

test('closing a closed quest again changes nothing: it stays finished in the reply that first closed it (0.9.7)', () => {
    let tracker = applyOps(emptyTracker(), ops('+ quest Wolves at the weir — the pack | giver: Kael | reward: 4 silver'), { message: 1 }).tracker;
    tracker = applyOps(tracker, ops('- Wolves at the weir — the pack is dead'), { message: 3 }).tracker;
    assert.equal(questsDoneIn(tracker, 3).length, 1);
    for (const line of ['- Wolves at the weir — the pack is dead', '~ Wolves at the weir — status: completed', '! Wolves at the weir — reward paid']) {
        const again = applyOps(tracker, ops(line), { message: 7 });
        assert.deepEqual(questsDoneIn(again.tracker, 7), [], `${line}: not finished a second time`);
        assert.equal(findRecord(again.tracker, 'Wolves at the weir').resolved.message, 3);
        assert.equal(again.problems[0].kind, 'already-closed');
    }
    // Reopened with a +, it can be finished again.
    const reopened = applyOps(tracker, ops('+ quest Wolves at the weir — a second pack | giver: Kael | reward: 4 silver'), { message: 5 }).tracker;
    assert.equal(questsDoneIn(applyOps(reopened, ops('- Wolves at the weir — done'), { message: 7 }).tracker, 7).length, 1);
});

test('"+ quest Key" on a hook or event already tracked makes it the quest (0.9.9)', () => {
    const start = applyOps(emptyTracker(), ops('+ hook Sheepfold Wolves — wolves at the east fold | reward: 2 silver per ear\n+ beat Toll riders — reach the ford | on: Goldwane 19\n+ agenda Geva — now: Bailiff Court'), { message: 1 }).tracker;
    const { tracker, problems } = applyOps(start, ops('+ quest Sheepfold Wolves — Cull up to 4 timber wolves | type: contract, giver: Nelke/Herders, goal: return right wolf ears, reward: 2 silver per head, due: Goldwane 12'), { message: 2 });
    const quest = findRecord(tracker, 'Sheepfold Wolves');
    assert.equal(quest.kind, 'quest');
    assert.equal(quest.fields.type, 'contract');
    assert.equal(quest.fields.giver, 'Nelke/Herders');
    assert.equal(problems[0].kind, 'became-quest');
    // Beats and agendas stay what they are; a + of the same kind is a change, as before.
    assert.equal(findRecord(applyOps(start, ops('+ quest Toll riders — escort them'), { message: 2 }).tracker, 'Toll riders').kind, 'beat');
    assert.equal(findRecord(applyOps(start, ops('+ quest Geva — follow her'), { message: 2 }).tracker, 'Geva').kind, 'agenda');
    assert.equal(applyOps(start, ops('+ hook Sheepfold Wolves — again'), { message: 2 }).problems[0].kind, 'duplicate-add');
});

test('a "- … accepted" line takes a job on, it does not finish it (0.9.13)', () => {
    const start = applyOps(emptyTracker(), ops('+ hook Sheepfold Wolves — wolves at the east fold | giver: Nelke'), { message: 1 }).tracker;
    // As written: the quest, then the hook "closed" because it was accepted.
    const reply = '+ quest Sheepfold Wolves — Cull four timber wolves | type: contract | giver: Nelke | reward: 8 silver | due: Goldwane 13, 08:00 am | difficulty: easy\n- Hook Sheepfold Wolves — accepted by Wessel';
    const { tracker, problems } = applyOps(start, ops(reply), { message: 2 });
    const quest = findRecord(tracker, 'Sheepfold Wolves');
    assert.equal(quest.kind, 'quest');
    assert.equal(quest.status, 'active');
    assert.deepEqual(questsDoneIn(tracker, 2), []);
    assert.ok(problems.some(problem => problem.kind === 'taken-on'));
    // On a hook alone, the - makes it the quest.
    const taken = applyOps(start, ops('- Sheepfold Wolves — taken on by Wessel'), { message: 2 }).tracker;
    assert.equal(findRecord(taken, 'Sheepfold Wolves').kind, 'quest');
    assert.equal(findRecord(taken, 'Sheepfold Wolves').status, 'active');
    // Pay, an ending or a refusal still close it.
    const quested = applyOps(start, ops('+ quest Sheepfold Wolves — cull them | giver: Nelke'), { message: 2 }).tracker;
    for (const reason of ['reward accepted, 8 silver paid', 'done, Nelke accepted the ears and the job is finished', 'declined the job', 'cleared']) {
        assert.equal(findRecord(applyOps(quested, ops(`- Sheepfold Wolves — ${reason}`), { message: 3 }).tracker, 'Sheepfold Wolves').status, 'resolved', reason);
    }
});

test('"- hook Key — <what the hook was>" beside "+ quest Key" does not finish the quest (0.9.20)', () => {
    const start = applyOps(emptyTracker(), ops('+ hook Lone Grey Wolf — Hunt the lone wolf killing sheep past the western ditch | giver: Verna'), { message: 1 }).tracker;
    // As written in a reply: the quest, then the hook it came from "closed" with its old text.
    const reply = "+ quest Lone Grey Wolf — Hunt the wolf pack preying on Gerrick's sheepfold | type: bounty | giver: Verna | reward: 1 gold | difficulty: ordinary\n- hook Lone Grey Wolf — Hunt the lone wolf killing sheep past the western ditch";
    const { tracker, problems } = applyOps(start, ops(reply), { message: 2, said: "I'll take the wolf bounty." });
    const quest = findRecord(tracker, 'Lone Grey Wolf');
    assert.equal(quest.kind, 'quest');
    assert.equal(quest.status, 'active');
    assert.deepEqual(questsDoneIn(tracker, 2), []);
    assert.ok(problems.some(problem => problem.kind === 'taken-on'));
    assert.deepEqual(quest.aliases ?? [], [], 'the kind word is not remembered as a name');
    // Not accepted: the offer stays an offer, not closed by the hook's line.
    const offer = findRecord(applyOps(start, ops(reply), { message: 2, said: 'I look around the square.' }).tracker, 'Lone Grey Wolf');
    assert.equal(offer.status, 'active');
    // With no hook tracked before, the same pair still leaves the quest open.
    assert.equal(findRecord(applyOps(emptyTracker(), ops(reply), { message: 2, said: "I'll take the wolf bounty." }).tracker, 'Lone Grey Wolf').status, 'active');
    // A reason that says the job is over still ends it, in the same reply or later.
    assert.equal(findRecord(applyOps(tracker, ops('- hook Lone Grey Wolf — the wolf is slain and the bounty paid out'), { message: 3 }).tracker, 'Lone Grey Wolf').status, 'resolved');
    assert.equal(findRecord(applyOps(start, ops("+ quest Lone Grey Wolf — hunt it | giver: Verna\n- Lone Grey Wolf — done, Verna paid"), { message: 2, said: "I'll take the wolf bounty." }).tracker, 'Lone Grey Wolf').status, 'resolved');
    // A later plain "- Key — the wolf is dead" on the quest still closes it, as before.
    assert.equal(findRecord(applyOps(tracker, ops('- Lone Grey Wolf — cleared'), { message: 3 }).tracker, 'Lone Grey Wolf').status, 'resolved');
});

test('a line keyed by a label ("! Encounter — …") is skipped quietly and never asked to be added (0.9.14)', () => {
    const start = applyOps(emptyTracker(), ops('+ hook Sheepfold Wolves — wolves at the east fold'), { message: 1 }).tracker;
    const { tracker, problems } = applyOps(start, ops('! Encounter — 4 timber wolves attack at the fold\n~ Combat — wolves engaged\n~ Quest — step: fight\n- Scene — over'), { message: 2 });
    assert.equal(tracker.records.length, 1, 'nothing added');
    assert.deepEqual(problems.map(problem => [problem.kind, problem.severity]), [['label-key', 'info'], ['label-key', 'info'], ['label-key', 'info'], ['label-key', 'info']]);
    assert.deepEqual(untrackedCorrections(problems, { message: 2 }), []);
    // A record that is really called so is still changed.
    const named = applyOps(emptyTracker(), ops('+ event Encounter — a stranger at the gate'), { message: 1 }).tracker;
    assert.equal(findRecord(applyOps(named, ops('! Encounter — the stranger speaks'), { message: 2 }).tracker, 'Encounter').fields.now, '');
    assert.equal(applyOps(named, ops('! Encounter — the stranger speaks'), { message: 2 }).problems.length, 0);
});

test('choices are the reader\'s: a + quest counts only when their message took the job on (0.9.15)', async () => {
    const { isOffer, offersChosenIn } = await import('../src/tracker.js');
    const offerLines = '+ quest Rat Culling — Kill granary rats | type: side | giver: Danique | reward: 8 copper a sack\n+ quest Wolf Hunt — Kill ridge wolves | type: side | giver: Danique | reward: 4 silver';
    // Danique only offered them: both stay offers, not quests.
    const offeredOnly = applyOps(emptyTracker(), ops(offerLines), { message: 1, said: 'I pay the fee and ask what work there is.' });
    assert.deepEqual(offeredOnly.tracker.records.map(r => [r.key, r.kind, isOffer(r)]), [['Rat Culling', 'hook', true], ['Wolf Hunt', 'hook', true]]);
    assert.ok(offeredOnly.problems.every(p => p.kind === 'offered'));
    // Taking one on by name: only that one is a quest.
    const took = applyOps(emptyTracker(), ops(offerLines), { message: 1, said: 'Accept the sheep-fold wolf hunt contract and head past the ditch.' });
    assert.deepEqual(took.tracker.records.map(r => r.kind), ['hook', 'quest']);
    // One job offered: "I'll take it" is enough. A refusal or a negation is not acceptance.
    const single = '+ quest Wolf Hunt — Kill ridge wolves | giver: Danique | reward: 4 silver';
    assert.equal(applyOps(emptyTracker(), ops(single), { message: 1, said: 'Fine. I\'ll take it.' }).tracker.records[0].kind, 'quest');
    assert.equal(applyOps(emptyTracker(), ops(single), { message: 1, said: 'I won\'t take it.' }).tracker.records[0].kind, 'hook');
    assert.equal(applyOps(emptyTracker(), ops(single), { message: 1, said: null }).tracker.records[0].kind, 'hook', 'no message: an offer');
    // A main quest is the story's to give.
    assert.equal(applyOps(emptyTracker(), ops('+ quest The bond — pay it off | type: main'), { message: 1, said: null }).tracker.records[0].kind, 'quest');
    // Later: the reader accepts, and the model's + quest (or "- … accepted") now counts.
    const later = applyOps(offeredOnly.tracker, ops('+ quest Wolf Hunt — Kill ridge wolves'), { message: 3, said: 'I\'ll do the wolf job.' }).tracker;
    assert.equal(findRecord(later, 'Wolf Hunt').kind, 'quest');
    assert.equal(findRecord(applyOps(offeredOnly.tracker, ops('- Wolf Hunt — accepted by Wessel'), { message: 3, said: 'What does it pay?' }).tracker, 'Wolf Hunt').kind, 'hook');
    // The story moving it on means the character is doing it; "0/1" is not under way.
    assert.equal(findRecord(applyOps(offeredOnly.tracker, ops('~ Wolf Hunt — step: tracking the pack past the ditch'), { message: 3, said: 'I head out.' }).tracker, 'Wolf Hunt').kind, 'quest');
    assert.equal(findRecord(applyOps(offeredOnly.tracker, ops('~ Wolf Hunt — step: 0/1'), { message: 3, said: 'Hm.' }).tracker, 'Wolf Hunt').kind, 'hook');
    // Without the gate (no reader message given), the old behaviour.
    assert.equal(applyOps(emptyTracker(), ops(single), { message: 1 }).tracker.records[0].kind, 'quest');
    // offersChosenIn reads a message for the note.
    assert.deepEqual(offersChosenIn(offeredOnly.tracker, 'I accept the rat work.'), ['Rat Culling']);
    assert.deepEqual(offersChosenIn(offeredOnly.tracker, 'No thanks to the wolves.', 'refuse'), ['Wolf Hunt']);
});

test('giving a job up or turning it down needs the reader\'s word; failing it is the story\'s (0.9.15)', () => {
    const start = applyOps(emptyTracker(), ops('+ quest Wolf Hunt — Kill ridge wolves | giver: Danique | reward: 4 silver'), { message: 1, said: 'I take the wolf hunt.' }).tracker;
    const kept = applyOps(start, ops('- Wolf Hunt — abandoned'), { message: 3, said: 'I look around the fold.' });
    assert.equal(findRecord(kept.tracker, 'Wolf Hunt').status, 'active');
    assert.equal(kept.problems[0].kind, 'not-chosen');
    assert.equal(findRecord(applyOps(start, ops('~ Wolf Hunt — status: abandoned'), { message: 3, said: 'Onward.' }).tracker, 'Wolf Hunt').status, 'active');
    // The reader said so (in words, or with the Abandon button's line).
    assert.equal(findRecord(applyOps(start, ops('- Wolf Hunt — abandoned'), { message: 3, said: 'I give up on the wolf hunt, it is hopeless.' }).tracker, 'Wolf Hunt').status, 'resolved');
    // The Abandon flag: the reader's choice stamped on the reply, whatever their message says.
    assert.equal(findRecord(applyOps(start, ops('- Wolf Hunt — abandoned'), { message: 3, said: 'Onward.', chosen: ['wolf hunt'] }).tracker, 'Wolf Hunt').status, 'resolved');
    const replayed = replay([{ message: 3, ops: ops('- Wolf Hunt — abandoned'), text: '', time: null, said: 'Onward.', chosen: ['wolf hunt'] }], { seed: start });
    assert.equal(findRecord(replayed.tracker, 'Wolf Hunt').status, 'resolved');
    // Outcomes stay the story's.
    for (const reason of ['failed, the wolves scattered the flock', 'expired at sundown', 'done, ears delivered']) {
        assert.equal(findRecord(applyOps(start, ops(`- Wolf Hunt — ${reason}`), { message: 3, said: 'Hm.' }).tracker, 'Wolf Hunt').status, 'resolved', reason);
    }
    // An offer turned down only on the reader's word too.
    const offer = applyOps(emptyTracker(), ops('+ quest Rat Culling — rats | giver: Danique | reward: 8 copper'), { message: 1, said: 'Tell me more.' }).tracker;
    assert.equal(findRecord(applyOps(offer, ops('- Rat Culling — declined'), { message: 3, said: 'Okay.' }).tracker, 'Rat Culling').status, 'active');
    assert.equal(findRecord(applyOps(offer, ops('- Rat Culling — declined'), { message: 3, said: 'I decline the rat job.' }).tracker, 'Rat Culling').status, 'resolved');
});

test('an offer the story says is done closes as the quest {{user}} finished, when they spoke of it (0.9.27)', () => {
    const offer = '+ hook Barrow-Viper Clearing — clear the viper pit by the barrow | giver: Verna | reward: 2 silver';
    const start = applyOps(emptyTracker(), ops(offer), { message: 1, said: 'I ask Verna for work.' }).tracker;
    assert.equal(findRecord(start, 'Barrow-Viper Clearing').kind, 'hook');
    // The reader went and did it, never saying "I accept".
    const went = applyOps(start, ops('~ Barrow-Viper Clearing — now: at the pit'), { message: 3, said: 'I head out to the barrow and clear the vipers.' }).tracker;
    assert.ok(findRecord(went, 'Barrow-Viper Clearing').engaged, 'naming the job marks it spoken of');
    const { tracker, problems } = applyOps(went, ops('! Barrow-Viper Clearing — cleared pit, 10 skins turned in to Verna'), { message: 5, said: 'I hand Verna the skins.' });
    const done = findRecord(tracker, 'Barrow-Viper Clearing');
    assert.equal(done.kind, 'quest');
    assert.equal(done.status, 'resolved');
    assert.deepEqual(questsDoneIn(tracker, 5).map(quest => quest.name), ['Barrow-Viper Clearing']);
    assert.ok(problems.some(problem => problem.kind === 'done-offer'));
    // `~ … step: completed` and `- … — done` say the same.
    assert.equal(findRecord(applyOps(went, ops('~ Barrow-Viper Clearing — step: completed, voucher paid'), { message: 5, said: 'I collect my pay.' }).tracker, 'Barrow-Viper Clearing').kind, 'quest');
    assert.equal(questsDoneIn(applyOps(went, ops('- Barrow-Viper Clearing — skins handed in, bounty paid'), { message: 5, said: 'I wait.' }).tracker, 5).length, 1);
    // Never spoken of: the offer still closes (it is off the Offered list), but it was no quest of theirs.
    const elsewhere = applyOps(start, ops('! Barrow-Viper Clearing — completed by the Hollin brothers'), { message: 3, said: 'I sleep in.' }).tracker;
    assert.equal(findRecord(elsewhere, 'Barrow-Viper Clearing').status, 'resolved');
    assert.equal(findRecord(elsewhere, 'Barrow-Viper Clearing').kind, 'hook');
    assert.deepEqual(questsDoneIn(elsewhere, 3), []);
    // Failed, given up or lapsed is no quest done; a `!` that is only news changes nothing.
    assert.equal(findRecord(applyOps(went, ops('- Barrow-Viper Clearing — offer lapsed'), { message: 5 }).tracker, 'Barrow-Viper Clearing').kind, 'hook');
    assert.equal(findRecord(applyOps(went, ops('- Barrow-Viper Clearing — the job failed, the pit collapsed'), { message: 5, said: 'I look.' }).tracker, 'Barrow-Viper Clearing').kind, 'hook');
    assert.equal(findRecord(applyOps(went, ops('! Barrow-Viper Clearing — the guide withdrew'), { message: 5, said: 'I look.' }).tracker, 'Barrow-Viper Clearing').status, 'active', 'a `!` on an offer closes it only when it says done');
    assert.equal(findRecord(applyOps(went, ops('! Barrow-Viper Clearing — a viper bites the guide'), { message: 5, said: 'I look.' }).tracker, 'Barrow-Viper Clearing').status, 'active');
});

test('a `~` reading as over on nothing tracked makes no record (0.9.27)', () => {
    const { tracker, problems } = applyOps(emptyTracker(), ops('~ Quests: North Levee Vipers — step: completed, voucher paid'), { message: 2, said: 'I collect.' });
    assert.equal(tracker.records.length, 0);
    assert.ok(problems.some(problem => problem.kind === 'unknown-key' && problem.severity === 'info'));
    // One that is not over still adds a hook, as before.
    assert.equal(applyOps(emptyTracker(), ops('~ Levee Vipers — step: hunting'), { message: 2 }).tracker.records.length, 1);
});

test('taking a job: "we" as well as "I", joining, and a plain yes to the one new quest (0.9.27)', () => {
    const hook = '+ hook Wolfhound Hunt — run down the wolfhounds | giver: Burl | reward: 1 gold';
    const start = applyOps(emptyTracker(), ops(hook), { message: 1, said: 'Hello.' }).tracker;
    const take = (said, line = '+ quest Wolfhound Hunt — run down the wolfhounds | giver: Burl | reward: 1 gold') => findRecord(applyOps(start, ops(line), { message: 3, said }).tracker, 'Wolfhound Hunt').kind;
    assert.equal(take("We'll join the wolfhound hunt."), 'quest');
    assert.equal(take('Count us in, Burl.'), 'quest');
    assert.equal(take("Sure, I'm up for it."), 'quest');
    assert.equal(take('Yes.'), 'quest', 'a plain yes to the reply\'s one new quest');
    assert.equal(take('I look at the map.'), 'hook');
    assert.equal(take("I won't join the hunt."), 'hook');
    // A plain yes with two new quests in the reply says which one only by name.
    assert.equal(take('Yes.', '+ quest Wolfhound Hunt — run down the wolfhounds | giver: Burl\n+ quest Ferry Run — row the ferry | giver: Ola'), 'hook');
});

test('a quest with only its pay left is not failed for the hour passing (0.9.28)', () => {
    const start = applyOps(emptyTracker(), ops('+ quest Lone Grey Wolf — hunt the pack | giver: Verna | reward: 1 gold\n~ Lone Grey Wolf — step: turn in voucher at bailiff hatch on Friday noon | due: Goldwane 14, 12:00 pm'), { message: 1 }).tracker;
    for (const line of ['- Lone Grey Wolf — failed: deadline passed', '- Lone Grey Wolf — voucher expired, too late', '~ Lone Grey Wolf — status: failed (missed the window)']) {
        const { tracker, problems } = applyOps(start, ops(line), { message: 3, said: 'I wait.' });
        assert.equal(findRecord(tracker, 'Lone Grey Wolf').status, 'active', line);
        assert.ok(problems.some(problem => problem.kind === 'pay-waiting'), line);
    }
    // Done is done, and a failure that is not about time still ends it.
    assert.deepEqual(questsDoneIn(applyOps(start, ops('- Lone Grey Wolf — voucher cashed, 1 gold paid'), { message: 3 }).tracker, 3).map(quest => quest.name), ['Lone Grey Wolf']);
    assert.equal(findRecord(applyOps(start, ops('- Lone Grey Wolf — failed: the bailiff tore up the voucher'), { message: 3 }).tracker, 'Lone Grey Wolf').status, 'resolved');
    // While the work is still to do, a passed deadline fails it as before.
    const hunting = applyOps(emptyTracker(), ops('+ quest Wolves — hunt the pack | giver: Verna | step: track the pack | due: Goldwane 14'), { message: 1 }).tracker;
    assert.equal(findRecord(applyOps(hunting, ops('- Wolves — failed: deadline passed'), { message: 3 }).tracker, 'Wolves').status, 'resolved');
});

test('"- Key — failed: deadline passed" is a failure, not a quest done (0.9.28)', () => {
    const start = applyOps(emptyTracker(), ops('+ quest Wolves — hunt the pack | giver: Verna | step: track the pack'), { message: 1 }).tracker;
    const failed = applyOps(start, ops('- Wolves — failed: the pack fled north'), { message: 3 }).tracker;
    assert.equal(findRecord(failed, 'Wolves').resolved.reason, 'failed: the pack fled north');
    assert.deepEqual(questsDoneIn(failed, 3), []);
    const done = applyOps(start, ops('- Wolves — done: pack slain'), { message: 3 }).tracker;
    assert.equal(questsDoneIn(done, 3).length, 1);
});

test('"took down all three contracts" takes on the three offers shown last; turning them all down does not (0.9.32)', () => {
    const old = applyOps(emptyTracker(), ops('+ hook Mill Pond Eel — drive off the eel | giver: Miller Bram | reward: 4 silver'), { message: 1 }).tracker;
    const board = [
        '+ hook Wicker Bed Hogs — drive the hogs off the wicker beds | giver: Reeve Hollis | reward: 6 silver',
        '+ hook Granary Rats — clear the second granary | giver: Factor Dunn | reward: 5 silver',
        '+ hook Lost Ledger — find the tithe ledger | giver: Brother Aldo | reward: 3 silver',
    ].join('\n');
    const start = applyOps(old, ops(board), { message: 3 }).tracker;
    const said = 'I nodded and took down all three contracts and head south to the wicker beds with a rented handcart, it wasn\'t hard to spot when the hogs are still digging there.';
    const taken = ['~ Wicker Bed Hogs — accepted | type: bounty', '~ Granary Rats — accepted | type: bounty', '~ Lost Ledger — accepted | type: bounty', '~ Mill Pond Eel — accepted'].join('\n');
    const { tracker } = applyOps(start, ops(taken), { message: 5, said });
    for (const key of ['Wicker Bed Hogs', 'Granary Rats', 'Lost Ledger']) assert.equal(findRecord(tracker, key).kind, 'quest', key);
    // The older offer was not among the three on the board.
    assert.notEqual(findRecord(tracker, 'Mill Pond Eel').kind, 'quest');
    // "Both jobs" is the two shown last; no word for taking them on is still no choice.
    const two = applyOps(start, ops(taken), { message: 5, said: 'I take both jobs.' }).tracker;
    assert.deepEqual(['Wicker Bed Hogs', 'Granary Rats', 'Lost Ledger'].map(key => findRecord(two, key).kind === 'quest').filter(Boolean).length, 2);
    const looked = applyOps(start, ops(taken), { message: 5, said: 'I read all three contracts twice.' }).tracker;
    assert.ok(['Wicker Bed Hogs', 'Granary Rats', 'Lost Ledger'].every(key => findRecord(looked, key).kind !== 'quest'));
    assert.ok(['Wicker Bed Hogs', 'Granary Rats'].every(key => findRecord(applyOps(start, ops(taken), { message: 5, said: "I don't take any of them; I turned them all down." }).tracker, key).kind !== 'quest'));
});

test('an offer taken on with the button is a quest on the reply\'s "~ Key — accepted", whatever the message said (0.9.33)', () => {
    const start = applyOps(emptyTracker(), ops('+ hook Lime Kiln Bats — clear the bats | giver: Elke | reward: 5 silver\n+ hook Drake Shallows — kill the drake | giver: Elke | reward: 2 gold'), { message: 1 }).tracker;
    const reply = '~ Lime Kiln Bats — accepted\n- Drake Shallows — declined';
    const { tracker } = applyOps(start, ops(reply), { message: 3, said: 'I head for the Stray Oar.', taken: ['lime kiln bats'], chosen: ['drake shallows'] });
    assert.equal(findRecord(tracker, 'Lime Kiln Bats').kind, 'quest');
    assert.equal(findRecord(tracker, 'Drake Shallows').status, 'resolved');
    // Without the stamps the same lines change nothing: the message chose neither.
    const plain = applyOps(start, ops(reply), { message: 3, said: 'I head for the Stray Oar.' }).tracker;
    assert.notEqual(findRecord(plain, 'Lime Kiln Bats').kind, 'quest');
    assert.equal(findRecord(plain, 'Drake Shallows').status, 'active');
});
