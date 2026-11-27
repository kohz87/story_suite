// The step's card names lapsed and replaced events by their words, never their id, and says nothing of a branch that never opened.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dailySummary } from '../../../../modules/world/chronicle/world-daily/summary.js';
import { runner, world } from './helpers.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', where: ['Highmark Empire'], ends_when: 'instant', window: { after: 'start', within: '3 days' }, ...extra });
const cards = events => {
    const run = runner(world({ events })).to(8);
    return { run, text: run.reports.map(dailySummary).join(' ') };
};

test('a lapse or replacement says the title, else the summary, else nothing', () => {
    const { run, text } = cards([
        ev('titled-one', { title: 'The Toll War', summary: 'Tolls rise.' }),
        ev('summed-one', { summary: 'The ferry guild splits.' }),
        ev('bare-one'),
        ev('vote-one', { summary: 'The Watchhouse votes: {outcome}.' }),
        ev('holed-one', { summary: 'Riots in {place}.' }),
        ev('swapped-one', { title: 'swapped-one', summary: 'A truce is sworn.', pre_empted_by: ['start'] }),
    ]);
    assert.match(text, /Lapsed: The Toll War\./);
    assert.match(text, /Lapsed: The ferry guild splits\./);
    assert.match(text, /Replaced: A truce is sworn\./);
    assert.match(text, /Lapsed: The Watchhouse votes\./);
    assert.doesNotMatch(text, /-one|\.\.|Riots|\{/);
    assert.equal(run.log('lapsed', 'bare-one').length, 1);
});

test('a lapse of a branch that never opened stays off the card and in the log', () => {
    const { run, text } = cards([
        ev('late-any', { title: 'Any Road', requires_any: ['fact:never-a', 'fact:never-b'] }),
        ev('late-all', { title: 'All Road', requires: ['fact:never-a'] }),
        ev('late-next', { title: 'Next Road', window: { after: 'start', within: '5 days' }, requires_any: ['stage:late-any'] }),
        // A condition can hold and stop holding: that cannot be told, so it is listed.
        ev('maybe', { title: 'Maybe Road', requires_any: ['fact:never-a', 'unrest@Highmark Capital'] }),
    ]);
    assert.doesNotMatch(text, /Any Road|All Road|Next Road/);
    assert.match(text, /Lapsed: Maybe Road\./);
    for (const id of ['late-any', 'late-all', 'late-next']) assert.equal(run.log('lapsed', id)[0]?.unopened, true, id);
});
