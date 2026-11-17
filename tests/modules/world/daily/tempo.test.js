// World events daily step: tempo scaling (acceptance test 36). Drift (its k and inactivity period) is not part of the daily step built here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dailyChance } from '../../../../modules/world/daily/chance.js';
import { scaleDays, scaledDays, seasonDays } from '../../../../modules/world/daily/durations.js';
import { runDays } from '../../../../modules/world/daily/step.js';
import { runner, world } from './helpers.js';

test('test 36: tempo 2 doubles windows, seasons, cooldowns, fades and the 45-day timer; tempo 0.25 rounds up; 1 day stays 1; outside 0.25-4 is refused', () => {
    assert.equal(scaledDays('10 days', 2), 20);
    assert.equal(seasonDays(2), 180);
    assert.equal(scaledDays('1 season', 2), 180);
    assert.equal(scaleDays(45, 2), 90);
    assert.equal(scaledDays('10 days', 0.25), 3, '2.5 → 3');
    assert.equal(scaledDays('1 day', 0.25), 1);
    const p = dailyChance({ certainty: 'possible', chance: { percent: 30, per: 'season' } }, { days: seasonDays(2), m: 1 }).p;
    assert.ok(Math.abs(p - (1 - 0.7 ** (1 / 180))) < 1e-12);
    const w = world({ events: [
        { id: 'first', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark Empire'], window: { after: 'start', within: '1 day' }, ends_when: 'instant', effects: { set: ['unrest@Town'] } },
        { id: 'second', kind: 'one-off', certainty: 'likely', where: ['Highmark Empire'], window: { after: 'start', within: '10 days' }, ends_when: 'instant' },
    ] });
    const run = runner(w, { tempo: 2, draw: () => 0 }).to(21);
    assert.equal(run.table['unrest@Town'], undefined, 'the event hold ended with the instant event');
    assert.equal(run.row('second').state, 'lapsed', 'the 90-day timer (45 × 2) blocks it through its 20-day window');
    assert.equal(run.row('second').closed, 21, 'a 10-day window is 20 days at tempo 2');
    const refused = runDays({ world: w, today: 1, seed: 's', tempo: 5 });
    assert.ok(refused.report.warnings.some(text => /Tempo 5 is outside 0.25-4/.test(text)));
});
