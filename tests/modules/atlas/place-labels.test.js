// B1.9 reads these two queries for a marked `~ place`: the list rows carry no aliases, the one-place query resolves a name or alias; a landmark's region wins over a pack's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lines, makeState, query } from './helpers/fake-ctx.js';

const PACK = { places: [{ name: 'Bluewatch Village', region: 'River', kind: 'settlement', x: 64, y: 110 }], routes: [] };

test('atlas.places rows have no aliases; atlas.place resolves an alias to the landmark\'s own region', () => {
    const { state } = lines(makeState(), '+ landmark Bluewatch Village — a market town | region: Lakeshire | aka: Bluewatch');
    const rows = query(state, 'atlas.places', {}, { pack: PACK });
    const row = rows.find(place => place.name === 'Bluewatch Village');
    assert.equal(row.region, 'Lakeshire');
    assert.equal('aliases' in row, false);
    const detail = query(state, 'atlas.place', { name: 'Bluewatch' }, { pack: PACK });
    assert.equal(detail.name, 'Bluewatch Village');
    assert.equal(detail.region, 'Lakeshire');
    assert.deepEqual(detail.aliases, ['bluewatch']);
});
