// The two Ersveil add-ons (job C2), converted to pack format 4: game packs that hold only data modules. They install beside the Ersveil pair, are never selected
// and never displace the selected game (pack format 4 D5), and their trackers are offered in every chat under the same ids as before (`pack.<id>/<slug>`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPack, report } from '../../authoring-kit/check.mjs';
import { createInstalled } from '../../packs/installed.js';
import { fakeSettings } from './helpers/fake-settings.js';

const text = id => readFileSync(new URL(`../../examples/packs/${id}/pack.json`, import.meta.url), 'utf8');
const ADD_ONS = { 'ersveil-factions': 'reputation', 'ersveil-survival': 'survival' };

test('each add-on is a format 4 game pack of data modules only, with its old id and module slug, and passes the checker', () => {
    for (const [id, slug] of Object.entries(ADD_ONS)) {
        const pack = JSON.parse(text(id));
        assert.deepEqual([pack.id, pack.format, pack.kind, pack.version], [id, 4, 'game', '3.0.0'], id);
        assert.deepEqual(Object.keys(pack.content), ['dataModules'], `${id}: trackers only`);
        assert.deepEqual(pack.content.dataModules.map(module => module.slug), [slug], id);
        assert.equal(pack.requires.storyBlock, undefined, id);
        const result = checkPack(text(id));
        assert.equal(result.ok, true, report(id, result));
        assert.deepEqual(result.notes, [], `${id}: nothing ignored`);
    }
});

test('beside the Ersveil pair: neither add-on is selected or displaces the selected game, and both offer their trackers', async () => {
    const installed = createInstalled({ settings: fakeSettings() });
    for (const id of ['ersveil', 'ersveil-game', ...Object.keys(ADD_ONS)]) assert.equal((await installed.install(text(id))).ok, true, id);
    assert.deepEqual(installed.selected(), { world: 'ersveil', game: 'ersveil-game' });
    for (const id of Object.keys(ADD_ONS)) assert.equal(await installed.select('game', id), false, `${id} is an add-on: never selected`);
    assert.deepEqual(installed.selected(), { world: 'ersveil', game: 'ersveil-game' });
    const modules = installed.packs().flatMap(pack => (pack.content?.dataModules ?? []).map(module => `pack.${pack.id}/${module.slug}`));
    assert.deepEqual(modules.sort(), ['pack.ersveil-factions/reputation', 'pack.ersveil-game/fame', 'pack.ersveil-game/guild-membership', 'pack.ersveil-game/holding', 'pack.ersveil-game/standing', 'pack.ersveil-survival/survival'], 'the selected game\'s own modules, then each add-on\'s');
});
