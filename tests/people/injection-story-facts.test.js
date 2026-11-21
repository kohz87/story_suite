// Pack format 4, F3 and F6: the narrator's dossier block carries the built-in story fields as the narrator writes them back: Level only with the RPG
// on, and the ability and keepsake names whole. The runtime's Level switch is the RPG probe, for the lines rules and for the dossier block.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildInjection, normalizeNpcRecord } from '../../modules/people/core/core.js';

// The settings module reads the host's stubs when it loads; a bare mock is enough for the RPG probe.
globalThis.__npcMock ??= { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { setRpgProbe, rpgIsOn } = await import('../../modules/people/settings/runtime-settings-parts/custom-fields.js');

const text = 'Mira: we go at dawn. Oren said so.';
const mira = extra => normalizeNpcRecord({ id: 'npc_mira', name: 'Mira', present: true, role: 'Ferrywoman', personality: 'Calm.', goal: 'Cross the weir.', ...extra });
const FACTS = { level: 5, abilities: [{ name: 'Weirsight', description: 'Reads water.' }, { name: 'Shield wall', description: '' }], keepsakes: [{ name: 'Oar', description: 'Her father\'s.' }] };
const inject = (npcs, options) => buildInjection(npcs, text, 1, 3, undefined, undefined, null, options);

test('the dossier block names the abilities and keepsakes; Level only with the RPG on', () => {
    const off = inject([mira(FACTS)], {});
    assert.match(off, /AGENCY\/BONDS: abilities: Weirsight, Shield wall · keepsakes: Oar; role: Ferrywoman/);
    assert.doesNotMatch(off, /level/i);
    assert.equal(inject([mira(FACTS)], { levelOn: false }), off);
    assert.match(inject([mira(FACTS)], { levelOn: true }), /AGENCY\/BONDS: level: 5 · abilities: Weirsight, Shield wall · keepsakes: Oar; role: Ferrywoman/);
});

test('a person with none of the three: the block is the same with the RPG on or off', () => {
    assert.equal(inject([mira({})], { levelOn: true }), inject([mira({})], {}));
    assert.doesNotMatch(inject([mira({})], { levelOn: true }), /level|abilities|keepsakes/);
});

test('names arrive whole or not at all, even in a tight budget', () => {
    const long = Array.from({ length: 16 }, (_, i) => ({ name: `Ability number ${i} of a long list`, description: 'd' }));
    for (const budget of [400, 1800]) {
        const out = buildInjection([mira({ abilities: long })], text, 1, 3, undefined, budget, null, {});
        const part = /abilities: ([^;·]*)/.exec(out)?.[1] ?? '';
        const names = part.split(', ').filter(Boolean);
        assert.ok(names.length >= 1 && names.length < 16, `${budget}: some, not all`);
        for (const name of names) assert.ok(long.some(row => row.name === name), `${budget}: "${name}" is whole`);
    }
});

test('a mentioned, absent person\'s line carries Level only with the RPG on', () => {
    const oren = normalizeNpcRecord({ id: 'npc_oren', name: 'Oren', present: false, role: 'Smith', level: 8 });
    assert.match(inject([mira({}), oren], { levelOn: true }), /- Oren \(mentioned, not present; Smith; level: 8\)/);
    assert.doesNotMatch(inject([mira({}), oren], {}), /level: 8/);
});

test('the runtime sends Level exactly while the RPG probe says so: the lines rules and the dossier block both read rpgIsOn()', () => {
    const source = fs.readFileSync(new URL('../../modules/people/runtime/runtime-injection.js', import.meta.url), 'utf8');
    const switches = (source.match(/levelOn: [^,}]*/g) ?? []).map(found => found.trim());
    assert.deepEqual(switches, ['levelOn: rpgIsOn()', 'levelOn: rpgIsOn()'], 'the lines rules and the dossier block');
    assert.match(source, /buildLinesParts\(\{ \.\.\.noteOptions, moodWord: true, levelOn: rpgIsOn\(\),/);
    assert.match(source, /buildInjection\([^\n]*levelOn: rpgIsOn\(\) \}\);/);
    assert.match(source, /import \{[^}]*\brpgIsOn\b[^}]*\} from '\.\.\/settings\/runtime-settings\.js';/);
    try {
        assert.equal(rpgIsOn(), false, 'no host: off');
        setRpgProbe(() => true);
        assert.equal(rpgIsOn(), true);
        setRpgProbe(() => 'yes');
        assert.equal(rpgIsOn(), false, 'only true is on');
        setRpgProbe(() => { throw new Error('gone'); });
        assert.equal(rpgIsOn(), false);
    } finally { setRpgProbe(null); }
});
