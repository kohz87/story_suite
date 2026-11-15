// Whole-suite static prompt golden test (B2 merge tripwire).
// Pins every `story_suite_static*` prompt key across the real three-module suite (Story Block + Story Director + NPC State Delta)
// and enforces the reply-to-reply byte-identity rule (packages/story-block/CLAUDE.md).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadSuite, suiteHost } from '../../packages/story-block/tests/v2/break/helpers/suite.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.join(HERE, 'static-prompt.golden.json');
const WRITE_GOLDEN = process.env.WRITE_GOLDEN === '1';

const loaded = await loadSuite();
const skip = loaded.skip ?? false;

// Three fixed short replies using core Story Block <Changes> grammar (from e2e-playthrough.test.js),
// valid whether Story Director or NPC State Delta features are on or off.
const REPLIES = [
    ['We look around the guild office.', 'Dust hangs in the lamplight of the Guild office.', ['~ you rank: unregistered | wearing: oilskin coat, boots | condition: rested', '+ item Bedroll | qty: 1', '+ present Sister Temiwa']],
    ['We take the key.', 'The key is cold and heavy.', ['+ item Rusty Knife | qty: 1', '~ place Bluewatch Village | kind: settlement']],
    ['I buy bread.', 'Bread, hot and heavy, for two coppers.', ['+ coin 3 silver | from: Rika', '+ item Bread | qty: 2']],
];

// Scenarios:
// - default: suiteHost(loaded, { seed: 1 }) with default settings (note: story-block.rpg defaults to false).
// - lean_rpg_on: sets 'story-block.rpg' = true (CORE_FEATURE.leanRpg in src/v2/features.js;
//   LEAN_RPG_FEATURE in src/v2/lean-rpg/names.js; gear-inventory.test.js turns it on the same way). Off is the default.
// - story_director_off: turns off all 'story-director.*' features from host.sdk.features()
//   (defined in packages/story-director/src/v2/*/index.js; suiteHost always registers SD with no module-off flag).
// - npc_state_delta_off: turns off all 'npc-state-delta.*' features from host.sdk.features()
//   (defined in packages/npc-state-delta/src/storysuite-v2.js; suiteHost hardcodes delta.isEnabled() => true).
const SCENARIOS = [
    {
        id: 'default',
        title: 'default settings',
        configure: () => {},
    },
    {
        id: 'lean_rpg_on',
        title: 'Lean RPG feature on (story-block.rpg = true)',
        configure: host => {
            host.features.set('story-block.rpg', true);
        },
    },
    {
        id: 'story_director_off',
        title: 'Story Director features off (all story-director.* features = false)',
        configure: host => {
            for (const f of host.sdk.features()) {
                if (f.moduleId === 'story-director') host.features.set(f.id, false);
            }
        },
    },
    {
        id: 'npc_state_delta_off',
        title: 'NPC State Delta features off (all npc-state-delta.* features = false)',
        configure: host => {
            for (const f of host.sdk.features()) {
                if (f.moduleId === 'npc-state-delta') host.features.set(f.id, false);
            }
        },
    },
];

function collectStaticKeys(promptLog) {
    const map = {};
    for (const entry of promptLog) {
        if (typeof entry?.key === 'string' && entry.key.startsWith('story_suite_static') && entry.value) {
            map[entry.key] = String(entry.value);
        }
    }
    return Object.fromEntries(Object.keys(map).sort().map(k => [k, map[k]]));
}

function firstDiffLine(expected, actual) {
    const expLines = expected.split('\n');
    const actLines = actual.split('\n');
    const max = Math.max(expLines.length, actLines.length);
    for (let i = 0; i < max; i += 1) {
        if (expLines[i] !== actLines[i]) {
            return `line ${i + 1}: expected ${JSON.stringify(expLines[i] ?? '<EOF>')} !== actual ${JSON.stringify(actLines[i] ?? '<EOF>')}`;
        }
    }
    return 'lengths differ';
}

function assertMatchesGolden(scenarioId, actual) {
    assert.ok(existsSync(GOLDEN_PATH), `missing golden file ${GOLDEN_PATH}; run with WRITE_GOLDEN=1 to generate`);
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
    const expected = golden[scenarioId];
    assert.ok(expected && typeof expected === 'object', `missing scenario "${scenarioId}" in ${GOLDEN_PATH}`);
    const expKeys = Object.keys(expected).sort();
    const actKeys = Object.keys(actual).sort();
    assert.deepEqual(actKeys, expKeys, `${scenarioId}: static key set mismatch`);
    for (const key of expKeys) {
        if (actual[key] !== expected[key]) {
            assert.fail(`${scenarioId} [${key}] mismatch at ${firstDiffLine(expected[key], actual[key])}`);
        }
    }
}

const written = {};
const firstStatic = {};

for (const scenario of SCENARIOS) {
    test(`static prompt golden (${scenario.title})`, { skip }, async t => {
        t.mock.method(console, 'warn', () => {});
        const host = await suiteHost(loaded, { seed: 1 });
        t.after(() => host.close());
        scenario.configure(host);

        const snapshots = [];
        for (const [player, story, lines] of REPLIES) {
            const res = await host.send(player, host.reply(story, lines));
            assert.ok(res.index >= 0, `${scenario.id}: reply should be written`);
            const statics = collectStaticKeys(host.st.promptLog);
            assert.ok(Object.keys(statics).length > 0, `${scenario.id}: at least one story_suite_static* key should be sent`);
            snapshots.push(statics);
        }

        // Assertion (1): reply-to-reply byte-identity across all 3 replies.
        const first = snapshots[0];
        for (let i = 1; i < snapshots.length; i += 1) {
            assert.deepEqual(Object.keys(snapshots[i]), Object.keys(first), `${scenario.id}: static keys changed on reply ${i + 1}`);
            for (const key of Object.keys(first)) {
                if (snapshots[i][key] !== first[key]) {
                    assert.fail(`${scenario.id} [${key}] changed between reply 1 and reply ${i + 1} at ${firstDiffLine(first[key], snapshots[i][key])}`);
                }
            }
        }

        // Assertion (2): match golden (or stage for WRITE_GOLDEN=1).
        firstStatic[scenario.id] = first;
        if (WRITE_GOLDEN) written[scenario.id] = first;
        else assertMatchesGolden(scenario.id, first);
    });
}

// A scenario that changes nothing is a broken scenario: every static text must differ from `default`.
test('every non-default scenario changes the static prompt', { skip }, () => {
    const base = firstStatic.default;
    assert.ok(base, 'default scenario must run first');
    for (const scenario of SCENARIOS) {
        if (scenario.id === 'default') continue;
        const got = firstStatic[scenario.id];
        assert.ok(got, `${scenario.id}: scenario did not run`);
        assert.notDeepEqual(got, base, `${scenario.id}: static text identical to default`);
    }
});

after(() => {
    if (!WRITE_GOLDEN || skip || Object.keys(written).length === 0) return;
    const base = existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : {};
    for (const [id, data] of Object.entries(written)) base[id] = data;
    const ordered = Object.fromEntries(Object.keys(base).sort().map(id => [id, base[id]]));
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
});
