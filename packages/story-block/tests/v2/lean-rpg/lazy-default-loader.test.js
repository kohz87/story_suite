// The RPG loader's own default `load` (no loader injected, as the runtime does unless rpgLoad is given) fetches the real library.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRpgLoader, rpgLib, setRpgLib } from '../../../src/v2/rpg-lazy.js';

test('the default loader, with no load injected, loads the RPG library', async () => {
    setRpgLib(null);
    const problems = [];
    const loader = createRpgLoader({ featureOn: () => true, problem: entry => problems.push(entry) });
    await loader.ensure();
    assert.deepEqual(problems, [], 'no RPG_LOAD problem');
    assert.ok(rpgLib(), 'the library is set');
    assert.equal(typeof rpgLib().createLeanRpgPart, 'function', 'it is lean-rpg/index.js\'s exports');
    assert.equal(loader.loaded(), true);
});
