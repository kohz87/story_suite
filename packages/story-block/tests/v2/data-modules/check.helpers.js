import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../../src/v2/packs/validate.js';

export const read = name => JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), 'utf8'));
export const integer = (min = 0, max = 100, value = 0) => ({ type: 'int', min, max, default: value });
export const change = () => ({ op: 'add', path: ['points'], value: 1, bounds: 'clamp' });
export const definition = () => ({ slug: 'counter', name: 'Counter', schema: 1, stateVersion: 1, scope: 'chat',
    state: { points: integer() }, kinds: { gain: { op: '+', labels: {}, effects: [change()] } } });
export const pack = (definitions = [definition()]) => ({ id: 'dm-test', version: '1.0.0', requires: { storyBlock: '^2', capabilities: ['data-modules-v1'] }, content: { dataModules: definitions } });
export const ok = value => {
    const checked = validatePack(value);
    assert.equal(checked.ok, true, JSON.stringify(checked.errors));
    return checked;
};
export const refuse = (value, code = 'DM_SCHEMA', path) => {
    const result = validatePack(value);
    assert.equal(result.ok, false, JSON.stringify(value));
    assert.ok(result.errors.length <= 20);
    const found = result.errors.find(e => e.code === code && (path === undefined || e.path === path));
    assert.ok(found, `Expected ${code} ${path ?? ''}: ${JSON.stringify(result.errors)}`);
    return found;
};
export const edit = fn => { const d = definition(); fn(d); return pack([d]); };
export const set = (value, path, next) => { let cursor = value; for (const key of path.slice(0, -1)) cursor = cursor[key]; cursor[path.at(-1)] = structuredClone(next); };
export const reward = () => ({ bindings: {}, values: { amount: { min: 1, max: 5, pick: 'midpoint' } }, effects: [{ ...change(), value: ['reward', 'amount'] }] });
export const timer = () => ({ id: 'clock', clock: 'clock', every: 60, effects: [{ ...change(), value: ['mul', ['timer', 'periods'], 2] }] });
export const clock = () => ({ query: 'director.time', mode: 'prefix', projection: ['minutes'] });
