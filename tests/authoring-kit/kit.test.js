import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPack, report } from '../../authoring-kit/check.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const raw = name => readFileSync(new URL(`../../authoring-kit/reference/data-modules/${name}.pack.json`, import.meta.url), 'utf8');
// The reference examples are still written in format 3 (the kit's files are not tests); the same pack as a format 4 game pack is what the checker is given here.
const data = name => JSON.stringify({ ...JSON.parse(raw(name)), format: 4, kind: 'game' });

test('the data-module examples pass the same checker as the host', () => {
    for (const name of ['faction-standing', 'survival-meters']) {
        const result = checkPack(data(name));
        assert.equal(result.ok, true, report(name, result));
    }
});

test('the tiny world example is a valid format 4 world pack', () => {
    const input = readFileSync(new URL('../../authoring-kit/examples/tiny-world/pack.json', import.meta.url), 'utf8');
    const result = checkPack(input);
    assert.equal(result.ok, true, report('tiny-world', result));
});

test('the checker refuses a pack that names a format 3 gate and says why', () => {
    const result = checkPack({ id: 'old', version: '1.0.0', requires: { storyBlock: '^2' }, content: {} });
    assert.equal(result.ok, false);
    assert.match(report('pack.json', result), /format 4 only/);
});

test('the command-line checker reports a valid pack and an invalid one', () => {
    const file = path.join(tempDir('kit-'), 'faction-standing.pack.json');
    writeFileSync(file, data('faction-standing'));
    const output = execFileSync(process.execPath, ['authoring-kit/check.mjs', file], { cwd: root, encoding: 'utf8' });
    assert.match(output, /^OK .*faction-standing\.pack\.json/);
    assert.equal(checkPack('{ invalid').errors[0].code, 'not-json');
    const input = JSON.parse(data('faction-standing'));
    input.requires.capabilities.push('other-module');
    assert.equal(checkPack(input).ok, false);
    assert.equal(checkPack(input, { withCapabilities: ['other-module'] }).ok, true);
});

test('the limits reference is generated from the host exports', () => {
    const output = execFileSync(process.execPath, ['authoring-kit/scripts/limits.mjs'], { cwd: root, encoding: 'utf8' });
    assert.equal(output, readFileSync(new URL('../../authoring-kit/reference/LIMITS.md', import.meta.url), 'utf8'));
});
