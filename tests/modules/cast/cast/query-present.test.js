// SFF4 #1: `director.cast` with `{ present: true }` also lists the living people not yet met whom the reply's own scene has present (the story named them),
// with `met: null` and their pack entry, so NPC State can make the dossier of a pack person a line names before the meeting is recorded. Without the
// argument, or for anyone the scene does not have, an unmet person is never named (as before).
import test from 'node:test';
import assert from 'node:assert/strict';
import { castQuery } from '../../../../modules/cast/cast/queries.js';

const person = (id, name, extra = {}) => ({ pack: 'ersveil', eid: id, name, aliases: [], where: 'Bluewatch Village', doing: '', alive: true, met: null, ...extra });
const state = present => ({ domains: {
    scene: { present },
    cast: { people: {
        'ersveil:torka': person('torka', 'Torka', { aliases: ['Bloodsong'] }),
        'ersveil:temiwa': person('temiwa', 'Sister Temiwa', { met: { on: 10, where: 'Bluewatch Village' } }),
        'ersveil:rika': person('rika', 'Rika'),
        'ersveil:dead': person('dead', 'Old Brann', { alive: false }),
    } },
} });
const entries = ['torka', 'temiwa', 'rika', 'dead'].map(id => ({ pack: 'ersveil', id, name: id, look: 'x', start: { place: 'bluewatch-village', goal: 'g' } }));
const tools = present => ({ query: (name) => (name === 'packs.content' ? entries : name === 'scene.present' ? present : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil' }] : null), feature: () => true, settings: () => ({}) });

test('without the argument only the met are listed', () => {
    const out = castQuery(state(['Torka']), {}, tools(['Torka']));
    assert.deepEqual(out.map(row => row.key), ['ersveil:temiwa']);
});

test('{ present: true } adds the unmet the scene has present (by name or alias), with met null and the entry; never one the scene lacks, never the dead', () => {
    const out = castQuery(state(['Bloodsong', 'Old Brann']), { present: true }, tools(['Bloodsong', 'Old Brann']));
    assert.deepEqual(out.map(row => [row.key, row.met]), [['ersveil:temiwa', { on: 10, where: 'Bluewatch Village' }], ['ersveil:torka', null]]);
    assert.equal(out[1].entry.id, 'torka');
    assert.doesNotMatch(JSON.stringify(out), /Rika|Old Brann/);
});
