// NPC State Batch 2 N0: the background prompts NPC State sends today, pinned byte for byte (tests/suite/background-prompts.golden.json).
// The fallback scanner (full scan, relationships on), the backfill, the Refresh and today's one-pass context (the uncached tail the
// one-pass block rides with), each over fixed fixtures: layered secrets on, a watched story event, the stage-4 form rule, the
// birthday rule and the custom-field / Level rule. Regenerate (WRITE_GOLDEN=1) only for an intended, reviewed, owner-approved change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { FIXTURES, PROMPTS } from './background-prompts.fixtures.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.join(HERE, 'background-prompts.golden.json');
const core = await import(pathToFileURL(path.join(HERE, '../../packages/npc-state-delta/core.js')).href);

const actual = {};
for (const [fixture, options] of Object.entries(FIXTURES(core))) {
    actual[fixture] = Object.fromEntries(Object.entries(PROMPTS(core)).map(([kind, build]) => [kind, build(options)]));
}

const firstDiff = (a, b) => {
    const x = a.split('\n'), y = b.split('\n');
    const at = Array.from({ length: Math.max(x.length, y.length) }, (_, i) => i).find(i => x[i] !== y[i]);
    return `line ${at + 1}: expected ${JSON.stringify(x[at] ?? '<EOF>')} !== actual ${JSON.stringify(y[at] ?? '<EOF>')}`;
};

if (process.env.WRITE_GOLDEN === '1') {
    test('write the background prompts golden', () => writeFileSync(GOLDEN_PATH, `${JSON.stringify(actual, null, 2)}\n`, 'utf8'));
} else {
    const golden = existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : {};
    for (const [fixture, prompts] of Object.entries(actual)) {
        for (const [kind, text] of Object.entries(prompts)) {
            test(`background prompt golden: ${fixture} / ${kind}`, () => {
                const expected = golden[fixture]?.[kind];
                assert.equal(typeof expected, 'string', `missing ${fixture}/${kind}; run with WRITE_GOLDEN=1 to generate`);
                if (text !== expected) assert.fail(`${fixture}/${kind} changed at ${firstDiff(expected, text)}`);
            });
        }
    }
    test('the golden holds no fixture or prompt this test no longer builds', () => {
        assert.deepEqual(Object.keys(golden).sort(), Object.keys(actual).sort());
        for (const fixture of Object.keys(actual)) assert.deepEqual(Object.keys(golden[fixture]).sort(), Object.keys(actual[fixture]).sort());
    });
}

test('each fixture exercises the rule it is for', () => {
    assert.match(actual.layered_watched.scanner, /HIDDEN NOTES/);
    assert.match(actual.layered_watched.scanner, /STORY EVENTS/);
    assert.match(actual.layered_watched.onePassContext, /The bridge falls/);
    assert.match(actual.stage4_birthday.scanner, /STAGE 4 APPEARANCE/);
    assert.match(actual.stage4_birthday.scanner, /birthday/i);
    // The fixtures tell the stage-4 branch apart: the detailed text is on wherever a form or a death word is, and off for `bare`.
    for (const fixture of ['plain', 'layered_watched', 'stage4_birthday', 'custom_level']) {
        assert.match(actual[fixture].scanner, /STAGE 4 APPEARANCE/, `${fixture} (a person with forms) carries the detailed stage-4 text`);
        assert.match(actual[fixture].scanner, /STAGE 4 DEATH/, `${fixture} carries the death rule`);
        assert.match(actual[fixture].refresh, /Established Stage 4 appearance forms/, `${fixture} carries the established forms`);
    }
    assert.doesNotMatch(actual.bare.scanner, /STAGE 4 APPEARANCE|STAGE 4 DEATH|Established Stage 4/, 'bare (no forms, no death words) leaves the detailed stage-4 text out');
    assert.doesNotMatch(actual.bare.refresh, /Established Stage 4/);
    assert.doesNotMatch(actual.bare.backfill, /Established Stage 4/);
    assert.ok(actual.custom_level.scanner.includes(core.LEVEL_FIELD_RULE));
    assert.ok(actual.custom_level.backfill.includes(core.LEVEL_FIELD_RULE));
    assert.ok(!actual.plain.scanner.includes('HIDDEN NOTES'));
});
