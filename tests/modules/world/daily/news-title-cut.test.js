// W23: a world happening's title is cut at a word end (never mid-word, no dangling colon), with "…" saying it was cut.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeHappenings } from '../../../../modules/world/chronicle/world-daily/news-entries.js';
import { part } from '../../../../modules/world/chronicle/index.js';
import { buildGeo } from '../../../../modules/world/daily/geo.js';
import { world } from './helpers.js';

const geo = buildGeo(world());
const nameFor = (text, date = 'CY 611, November 14') => {
    const chronicle = part.domains.chronicle.initial();
    const { written } = writeHappenings({ ifThere: () => {} }, chronicle, [{ day: 5, text, by: 'x', fired: true, reach: 'local', where: [] }], { geo, rev: 1, dateOf: () => date });
    return chronicle.events[written[0]].name;
};

test('W23: a long title ends on a whole word, with no dangling colon, and fits 80 characters', () => {
    const name = nameFor('The Ashen Veil and the Inquest struggle in Shornmarch: a long quarrel over the old toll roads and the grain tithe');
    assert.ok(name.length <= 80, name);
    assert.match(name, /^The Ashen Veil and the Inquest struggle in… · CY 611, November 14$/);
    assert.ok(!/:…|:\s·/.test(name));
});

test('W23: a short title is untouched', () => {
    assert.equal(nameFor('The lord calls a levy.', 'day 5'), 'The lord calls a levy · day 5');
});
