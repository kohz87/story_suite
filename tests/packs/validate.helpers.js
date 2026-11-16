import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';
import { pack } from './helpers/fixtures.js';

export const codes = result => (result.ok ? [] : result.errors.map(error => error.code));
export const refused = (input, code, options) => {
    const result = validatePack(input, options);
    assert.equal(result.ok, false, `expected ${code}`);
    assert.ok(codes(result).includes(code), `expected ${code}, got ${JSON.stringify(result.errors)}`);
    for (const error of result.errors) assert.equal(typeof error.message, 'string');
    return result;
};
export const withItem = item => pack({ content: { items: [item] } });
