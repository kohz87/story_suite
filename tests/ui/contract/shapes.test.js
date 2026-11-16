import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape, SHAPE_TYPES } from '../../../ui/contract/shapes.js';

describe('SHAPE_TYPES', () => {
  it('exposes primitive type constants', () => {
    assert.deepEqual(SHAPE_TYPES, {
      STRING: 'string',
      NUMBER: 'number',
      BOOLEAN: 'boolean',
      NULL: 'null',
      ANY: 'any',
    });
  });
});

describe('checkShape', () => {
  it('validates primitive types and rejects NaN or wrong types', () => {
    assert.deepEqual(checkShape('hello', SHAPE_TYPES.STRING), []);
    assert.deepEqual(checkShape(42, SHAPE_TYPES.NUMBER), []);
    assert.deepEqual(checkShape(false, SHAPE_TYPES.BOOLEAN), []);
    assert.deepEqual(checkShape(null, SHAPE_TYPES.NULL), []);
    assert.deepEqual(checkShape({ anything: 1 }, SHAPE_TYPES.ANY), []);

    assert.equal(checkShape(Number.NaN, SHAPE_TYPES.NUMBER).length, 1);
    assert.equal(checkShape(null, SHAPE_TYPES.STRING).length, 1);
    assert.match(checkShape(123, SHAPE_TYPES.STRING, 'name')[0], /^name: expected string, got number$/);
  });

  it('validates nested objects and arrays and reports exact mismatch paths', () => {
    const spec = {
      title: SHAPE_TYPES.STRING,
      items: [{ id: SHAPE_TYPES.NUMBER, tags: [SHAPE_TYPES.STRING] }],
    };

    assert.deepEqual(
      checkShape({ title: 'Ok', items: [{ id: 1, tags: ['a', 'b'] }] }, spec),
      [],
    );

    const errors = checkShape(
      { title: 99, items: [{ id: 'bad', tags: ['ok', 42] }] },
      spec,
    );
    assert.deepEqual(errors, [
      'title: expected string, got number',
      'items[0].id: expected number, got string',
      'items[0].tags[1]: expected string, got number',
    ]);
  });

  it('handles $nullable, $optional, $enum, $oneOf, $string, and $objectOf', () => {
    const spec = {
      note: { $nullable: SHAPE_TYPES.STRING },
      extra: { $optional: SHAPE_TYPES.NUMBER },
      tone: { $enum: ['buff', 'debuff'] },
      target: { $oneOf: [SHAPE_TYPES.STRING, { id: SHAPE_TYPES.NUMBER }] },
      where: { $string: { minLength: 1, maxLength: 10 } },
      flags: { $objectOf: SHAPE_TYPES.BOOLEAN },
    };

    assert.deepEqual(
      checkShape(
        {
          note: null,
          tone: 'buff',
          target: { id: 7 },
          where: 'counter',
          flags: { a: true, b: false },
        },
        spec,
      ),
      [],
    );

    const errors = checkShape(
      {
        note: 5,
        extra: 'no',
        tone: 'neutral',
        target: false,
        where: 'way too long here',
        flags: { a: 'yes' },
      },
      spec,
    );
    assert.equal(errors.length, 6);
    assert.match(errors[0], /^note: expected string/);
    assert.match(errors[1], /^extra: expected number/);
    assert.match(errors[2], /^tone: expected one of \[buff, debuff\]/);
    assert.match(errors[3], /^target: did not match any allowed shape/);
    assert.match(errors[4], /^where: string length 17 > maxLength 10/);
    assert.match(errors[5], /^flags\.a: expected boolean/);
  });

  it('reports invalid specs and non-object/non-array roots', () => {
    assert.match(checkShape('x', { a: SHAPE_TYPES.STRING })[0], /^\(root\): expected object, got string$/);
    assert.match(checkShape({}, [SHAPE_TYPES.STRING])[0], /^\(root\): expected array, got object$/);
    assert.match(checkShape('x', { $bogus: true })[0], /^\(root\): unknown shape descriptor$/);
    assert.match(checkShape('x', 'wat')[0], /^\(root\): unknown shape type "wat"$/);
  });
});
