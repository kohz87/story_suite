// The narrator's time line shows what a clock time looks like (USER 2 Nov: models wrote `~ time midday`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR } from '../../../../modules/time/tracker/note.js';

test('the time grammar line gives a clock-time example and says the clock never goes back', () => {
    assert.match(GRAMMAR.time, /^~ time 9:30 am \(the clock now, today; never a date, never earlier than the story time\) or ! time \+2h \/ ! time next morning \(time passes; the only way into a later day\), never both for one stretch/);
});
