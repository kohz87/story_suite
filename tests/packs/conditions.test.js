// A pack's declared world conditions (`content.conditions`): a format-3 optional section, kept only when given.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';
import { CONTENT_KINDS, OPTIONAL_KINDS } from '../../packs/limits.js';
import { pack } from './helpers/fixtures.js';

const good = { name: 'grain-dear', scope: 'region', fades: '1 season', means: 'Bread costs far more than usual.' };
const withConditions = list => validatePack(pack({ content: { conditions: list } }));

test('conditions: a good list is kept with its slug and pack; a pack without the section keeps its old bytes; the default fade is until cleared', () => {
    assert.ok(CONTENT_KINDS.includes('conditions') && OPTIONAL_KINDS.includes('conditions'));
    const result = withConditions([good, { name: 'unrest', scope: 'place', means: 'Crowds.' }]);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.pack.content.conditions.map(c => [c.name, c.scope, c.fades, c.slug]), [['grain-dear', 'region', '1 season', 'grain-dear'], ['unrest', 'place', 'until cleared', 'unrest']]);
    assert.equal('conditions' in validatePack(pack()).pack.content, false);
});

test('conditions: a bad name, scope, fade, means, an unknown field or a duplicate is a Problem and the record is left out', () => {
    for (const [change, code] of [
        [{ name: 'Grain Dear' }, 'BAD_RECORD'], [{ name: 'grain--dear' }, 'BAD_RECORD'], [{ scope: 'city' }, 'BAD_RECORD'], [{ fades: 'soonish' }, 'BAD_RECORD'],
        [{ means: '' }, 'BAD_RECORD'], [{ means: 4 }, 'BAD_RECORD'], [{ means: 'x'.repeat(301) }, 'BAD_RECORD'], [{ weight: 1 }, 'UNKNOWN_FIELD'],
    ]) {
        const result = withConditions([{ ...good, ...change }]);
        assert.equal(result.ok, false, JSON.stringify(change));
        assert.ok(result.errors.some(error => error.code === code), JSON.stringify([change, result.errors]));
    }
    assert.ok(withConditions([good, good]).errors.some(error => error.code === 'DUPLICATE'));
    assert.equal(validatePack(pack({ content: { conditions: 'x' } })).ok, false);
});
