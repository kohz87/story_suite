// Final review L2: an anchor in ends_when ends the event when it happens after the firing, a recurring one included. A `fired:` anchor already
// true on the firing day ends it on its next occurrence (before, never: it was read in first mode against the firing day for ever); with an
// offset, when the later occurrence's offset has passed; a season the event fired in ends it when that season comes round again.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, makeCalendar } from '../../../../modules/time/calendar.js';
import { makeStepCalendar } from '../../../../modules/world/daily/cal.js';
import { drawWith, runner, world } from './helpers.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', ends_when: { for: '100 days' }, summary: id, severity: 'minor', where: ['Oakhollow'], ...extra });
const pulse = ev('pulse', { kind: 'recurring', cooldown: '2 days per place', ends_when: 'instant' });
const watch = ends => ev('watch', { window: { after: 'start', within: '10 days' }, ends_when: { any_of: [ends] } });

test('a recurring fired: anchor that happened before the firing ends the event when it happens again', () => {
    const run = runner(world({ events: [pulse, watch('fired:pulse')] }), { draw: drawWith({ hits: { pulse: [1, 6], watch: [3] } }) }).to(5);
    assert.deepEqual([run.row('watch').state, run.row('watch').fired], ['active', 3], 'pulse fired on day 1, before watch: not an end');
    run.to(6);
    assert.equal(run.row('watch').state, 'active', 'pulse fires again on day 6, after watch is checked that day');
    run.to(7);
    assert.equal(run.row('watch').state, 'ended', 'ended the day after pulse happened again (before: still Active on day 20, until its 100 days)');
});

test('with an offset: the later occurrence ends it once its offset has passed; an earlier one whose offset passes after the firing does too', () => {
    const late = runner(world({ events: [pulse, watch('fired:pulse + 5 days')] }), { draw: drawWith({ hits: { pulse: [1, 6], watch: [7] } }) }).to(10);
    assert.equal(late.row('watch').state, 'active', 'day 1 + 5 = 6 was before the firing on day 7; day 6 + 5 = 11 not yet');
    late.to(12);
    assert.equal(late.row('watch').state, 'ended');
    const early = runner(world({ events: [pulse, watch('fired:pulse + 5 days')] }), { draw: drawWith({ hits: { pulse: [1], watch: [3] } }) }).to(5);
    assert.equal(early.row('watch').state, 'active');
    early.to(7);
    assert.equal(early.row('watch').state, 'ended', 'day 1 + 5 = 6, after the firing on day 3 (as before the fix)');
});

test('a season anchor: an event that fired in winter is not ended by that winter, and is by the next', () => {
    const cal = makeCalendar(PRESETS.gregorian);
    const D = (year, month, day) => cal.dayIndex(cal.toAbs({ year, month: month - 1, day }));
    const fire = D(611, 1, 10);
    const w = world({ events: [ev('frost', { where: ['Oakhollow'], window: { after: 'start', within: '5 days' }, ends_when: { any_of: ['winter'] } })] });
    // The next winter's first day, by the step's own calendar (its day count starts one later than the date's index).
    const steps = makeStepCalendar(null);
    let next = fire + 1;
    while (!(steps.seasonOf(next) === 'winter' && steps.stretch(next).start === next)) next += 1;
    assert.equal(steps.seasonOf(fire), 'winter');
    const run = runner(w, { start: fire, draw: drawWith({ hits: { frost: [fire] } }) }).to(next - 1);
    assert.deepEqual([run.row('frost').fired, run.row('frost').state], [fire, 'active'], 'still Active through the rest of that winter, spring, summer and autumn');
    run.to(next);
    assert.equal(run.row('frost').state, 'ended', 'the next winter began after the firing');
});
