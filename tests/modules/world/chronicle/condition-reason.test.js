// The World tab's "because": never the id of the event or template that set a condition, also for entries already stored with one.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reasonReader } from '../../../../modules/world/chronicle/conditions/reason.js';

const PACK = {
    worldEvents: [{ id: 'toll-war', summary: 'The tolls are fought over.' }, { id: 'quiet-one' }],
    templates: [{ template: 'bad-harvest', summary: 'The harvest fails.' }, { template: 'market-fire', summary: 'Fire takes the market of {place}.' }, { template: 'mute-one' }],
};
const query = (name, args) => (name === 'packs.content' ? PACK[args.kind] ?? [] : null);
const entry = (by, why, extra = {}) => ({ by, why, since: 1440, scope: 'place', ref: 'Highmark', ...extra });
const read = (e, events = []) => reasonReader(query, events)(e);

test('a template\'s stored id reads as that day\'s happening, else the pack summary, else nothing', () => {
    const news = { by: 'event:world.template.market-fire', since: 1440, place: 'Highmark', summary: 'Fire takes the market of Highmark.' };
    assert.equal(read(entry('code', 'market-fire'), [news]), 'Fire takes the market of Highmark');
    assert.equal(read(entry('code', 'market-fire'), [{ ...news, place: 'Bluewatch' }]), '');
    assert.equal(read(entry('code', 'market-fire'), [{ ...news, since: 2880 }]), '');
    assert.equal(read(entry('code', 'bad-harvest')), 'The harvest fails');
    assert.equal(read(entry('code', 'mute-one')), '');
});

test('an event\'s stored id reads as its summary or nothing', () => {
    assert.equal(read(entry('event:toll-war', 'toll-war')), 'The tolls are fought over');
    assert.equal(read(entry('event:quiet-one', 'quiet-one')), '');
    assert.equal(read(entry('event:quiet-one', 'quiet-one'), [{ by: 'event:world.quiet-one', since: 1440, summary: 'quiet-one' }]), '');
});

test('words the story or the pack gave are kept', () => {
    assert.equal(read(entry('code', 'the story begins so')), 'the story begins so');
    assert.equal(read(entry('narrator', 'bad-harvest')), 'bad-harvest');
    assert.equal(read(entry('event:toll-war', 'The Toll War')), 'The Toll War');
    assert.equal(read(entry('event:gone', 'The Old War')), 'The Old War');
});
