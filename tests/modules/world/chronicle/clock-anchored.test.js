// Clock faces and skips follow an earlier edit or delete (clock fix step 2b): a `~ time 9:30 pm` face, a `! time next morning` skip and a bare `! time`
// clock time are stored as anchored sets (Story Block rule h), so after an edit or delete of an earlier reply the head clock, the digests, the queries and
// "today so far" equal a fresh telling of the changed chat. Dates and durations are the controls. A rebuild from the stored records equals live.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORY, editAndReread, replyAt, tell } from './note-cursor.helpers.js';
import { equal, quiet, reopened, send, snap } from './clock-anchored.helpers.js';

// Every form a reply may carry for the clock, as the prompt teaches them (and a date and durations as the controls).
const FORMS = ['~ time 9:30 pm', '~ time evening', '! time next morning', '! time tomorrow evening', '! time 9:30 pm', '~ time June 4, 1200, 9:30 pm', '! time +1 hour', '! time +12h'];


for (const form of FORMS) {
    const r3 = [form, '~ place Frostgate'];
    const grown = [...STORY[2], '! time +1 day'];
    test(`R3 = ${form}: an edit that adds +1 day to R2 (Re-read), then one more reply`, async t => {
        quiet(t);
        const live = await tell([...STORY.slice(0, 3), r3]);
        assert.equal((await editAndReread(live, 'R2', grown)).ok, true);
        // R3 is the head and not noted yet: the Journal's "today so far" reads it on the edited clock.
        assert.deepEqual(snap(live), snap(await tell([...STORY.slice(0, 2), grown, r3])), `${form}: right after the Re-read`);
        await send(live, 4, [['~ place Redmoor']]);
        const fresh = await tell([...STORY.slice(0, 2), grown, r3, ['~ place Redmoor']]);
        equal(live, fresh, form);
        await reopened(live, form);
    });
    test(`R3 = ${form}: an edit that takes +1 day out of R2, then one more reply`, async t => {
        quiet(t);
        const live = await tell([STORY[0], STORY[1], grown, r3]);
        assert.equal((await editAndReread(live, 'R2', STORY[2])).ok, true);
        await send(live, 4, [['~ place Redmoor']]);
        const fresh = await tell([STORY[0], STORY[1], STORY[2], r3, ['~ place Redmoor']]);
        equal(live, fresh, form);
    });
    test(`R3 = ${form}: a middle delete of R2 (+1 day), then one more reply`, async t => {
        quiet(t);
        const live = await tell([...STORY.slice(0, 2), grown, r3]);
        const at = replyAt(live, 'R2');
        await live.st.deleteMessage(at);
        await live.st.deleteMessage(at - 1);
        await send(live, 4, [['~ place Redmoor']]);
        const fresh = await tell([...STORY.slice(0, 2), r3, ['~ place Redmoor']]);
        equal(live, fresh, form);
    });
}
