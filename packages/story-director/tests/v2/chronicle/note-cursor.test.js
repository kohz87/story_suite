// The chronicle's note reads from the last note's own receipt (`noted.through`), not from a revision, on the real host:
// an edited Re-read that gives a reply more lines no longer makes the next note log a step twice, push a quest's first
// lines out of its history, or file a later reply's facts under the next reply. Compared with a fresh telling, the chat
// now differs only by the known limit: what the edit added is not kept by the note (the Re-read keeps that reply's
// note as stored). Swipe, middle delete, rewind and reload give what a fresh telling gives, as before.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NEXT, STORY, chronicleOf, dayCounts, duplicates, editAndReread, pad, questLines, reloadSame, replyAt, said, tell, views } from './note-cursor.helpers.js';

const quiet = t => t.mock.method(console, 'warn', () => {});

for (const [tag, lines] of [['R0', 3], ['R0', 8], ['R1', 8], ['R2', 8]]) {
    test(`an edited Re-read of ${tag} with ${lines} more lines: nothing is noted twice or late (only the added lines are missing)`, async t => {
        quiet(t);
        const i = Number(tag.slice(1));
        const live = await tell(STORY);
        const res = await editAndReread(live, tag, [...STORY[i], ...pad(lines)]);
        assert.equal(res.ok, true);
        assert.equal(reloadSame(live), true);
        await live.send('On.', said('R4.', NEXT));
        // The known limit: the edited reply's added lines are not kept, so the chat reads as the unedited one told fresh.
        const told = await tell(STORY);
        await told.send('On.', said('R4.', NEXT));
        assert.deepEqual(views(live), views(told));
        assert.deepEqual(duplicates(questLines(live)), []);
        assert.equal(questLines(live).some(line => line.startsWith('P')), false);
        assert.equal(reloadSame(live), true);
        live.close(); told.close();
    });
}

test('the R2 +8 Re-read files no late notes under the next reply (its day entry counts only its own lines)', async t => {
    quiet(t);
    const live = await tell(STORY);
    await editAndReread(live, 'R2', [...STORY[2], ...pad(8)]);
    await live.send('On.', said('R4.', NEXT));
    const told = await tell(STORY);
    await told.send('On.', said('R4.', NEXT));
    assert.deepEqual(dayCounts(live), dayCounts(told));
    assert.equal(questLines(live).filter(line => line.startsWith('Q:') && line.includes('done')).length, 1);
    live.close(); told.close();
});

test('a Re-read that grows a reply and ends quest K there keeps "+ quest Q — go" in Q\'s history and logs no step twice', async t => {
    quiet(t);
    const base = [['~ time June 3, 1200, 06:00 pm', '+ quest Q — go | giver: A', '+ quest K — kill | giver: B'], ['~ quest Q | step: one'], ['~ quest Q | step: two', '~ quest Q | step: three'], ['~ quest Q | step: four'], ['~ quest Q | step: five']];
    const live = await tell(base);
    const res = await editAndReread(live, 'R1', [...base[1], ...pad(8), '~ quest K | done']);
    assert.equal(res.ok, true);
    await live.send('On.', said('R5.', ['~ quest Q | step: six']));
    const told = await tell(base);
    await told.send('On.', said('R5.', ['~ quest Q | step: six']));
    assert.deepEqual(views(live), views(told));
    assert.equal(views(live).details.Q[0], '+ quest Q — go | giver: A');
    assert.deepEqual(duplicates(questLines(live)), []);
    live.close(); told.close();
});

test('an edited Re-read, then a swipe of the last reply: the same as the unedited chat with that swipe', async t => {
    quiet(t);
    const live = await tell(STORY);
    await editAndReread(live, 'R0', [...STORY[0], ...pad(8)]);
    const swiped = ['~ quest Q | step: three'];
    await live.swipe(said('R3 again.', swiped));
    assert.equal(reloadSame(live), true);
    await live.send('On.', said('R4.', NEXT));
    const told = await tell([...STORY.slice(0, 3), swiped]);
    await told.send('On.', said('R4.', NEXT));
    assert.deepEqual(views(live), views(told));
    assert.deepEqual(duplicates(questLines(live)), []);
    live.close(); told.close();
});

test('an unchanged Re-read changes nothing', async t => {
    quiet(t);
    const live = await tell(STORY);
    await editAndReread(live, 'R0', STORY[0]);
    const told = await tell(STORY);
    assert.deepEqual(views(live), views(told));
    await live.send('On.', said('R4.', NEXT)); await told.send('On.', said('R4.', NEXT));
    assert.deepEqual(views(live), views(told));
    live.close(); told.close();
});

test('swipe, middle delete and rewind give what a fresh telling gives, and reload equals live', async t => {
    quiet(t);
    const cases = {
        async swipe(host) { const lines = ['! time +1 hour', '~ quest Q | step: three', ...pad(4, 'S')]; await host.swipe(said('R3 again.', lines)); return [...STORY.slice(0, 3), lines]; },
        async delete(host) { const at = replyAt(host, 'R1'); await host.st.deleteMessage(at); await host.st.deleteMessage(at - 1); return [STORY[0], STORY[2], STORY[3]]; },
        async rewind(host) {
            const at = replyAt(host, 'R3');
            const first = host.sdk.receipts().find(entry => entry.index === at);
            assert.equal((await host.sdk.rewind({ index: at, beforeRev: first.receipt.rev })).ok, true);
            return [...STORY.slice(0, 3), []];
        },
    };
    for (const [name, act] of Object.entries(cases)) {
        const live = await tell(STORY);
        const story = await act(live);
        const told = await tell(story);
        assert.deepEqual(views(live), views(told), name);
        assert.equal(reloadSame(live), true, name);
        await live.send('On.', said('R4.', NEXT)); await told.send('On.', said('R4.', NEXT));
        assert.deepEqual(views(live), views(told), `${name} +1`);
        assert.equal(reloadSame(live), true, `${name} +1`);
        live.close(); told.close();
    }
});

test('the cursor names the last note\'s own receipt and a kept note keeps it through a Re-read', async t => {
    quiet(t);
    const live = await tell(STORY);
    const noted = () => chronicleOf(live).noted[0];
    const notes = () => live.sdk.receipts().filter(entry => entry.receipt.type === 'chronicle.note').map(entry => entry.receipt.id);
    assert.equal(noted().through, notes().at(-1));
    const before = noted().through;
    await editAndReread(live, 'R1', [...STORY[1], ...pad(8)]);
    assert.equal(noted().through, before);
    assert.equal(notes().includes(before), true);
    live.close();
});

test('the known limit, both ways: a Re-read that drops lines leaves that reply\'s kept facts as they were (the later replies are kept right)', async t => {
    quiet(t);
    const live = await tell(STORY);
    const short = ['~ quest Q | step: two'];
    assert.equal((await editAndReread(live, 'R2', short)).ok, true);
    await live.send('On.', said('R4.', NEXT));
    const told = await tell([...STORY.slice(0, 2), short, STORY[3]]);
    await told.send('On.', said('R4.', NEXT));
    const unedited = await tell(STORY);
    await unedited.send('On.', said('R4.', NEXT));
    // R2's entry still counts its place and time (2), told fresh it counts 1; every other entry and the history match.
    assert.deepEqual(views(live), views(unedited));
    assert.deepEqual(views(live).quests, views(told).quests);
    assert.deepEqual(dayCounts(live).filter((_, i) => i !== 2), dayCounts(told).filter((_, i) => i !== 2));
    assert.equal(reloadSame(live), true);
    live.close(); told.close(); unedited.close();
});
