// Checks a value against a plain shape spec and lists mismatches by path.

export const SHAPE_TYPES = Object.freeze({
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  NULL: 'null',
  ANY: 'any',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function joinPath(base, segment) {
  if (!base) return segment;
  return segment.startsWith('[') ? `${base}${segment}` : `${base}.${segment}`;
}

function formatPath(path) {
  return path || '(root)';
}

function describeActual(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
  return typeof value;
}

function isDescriptor(spec) {
  return isPlainObject(spec) && Object.keys(spec).some(key => key.startsWith('$'));
}

function checkStringSpec(value, bounds, path) {
  if (typeof value !== 'string') {
    return [`${formatPath(path)}: expected string, got ${describeActual(value)}`];
  }
  const errors = [];
  if (typeof bounds.minLength === 'number' && value.length < bounds.minLength) {
    errors.push(`${formatPath(path)}: string length ${value.length} < minLength ${bounds.minLength}`);
  }
  if (typeof bounds.maxLength === 'number' && value.length > bounds.maxLength) {
    errors.push(`${formatPath(path)}: string length ${value.length} > maxLength ${bounds.maxLength}`);
  }
  return errors;
}

function checkDescriptor(value, spec, path) {
  if ('$optional' in spec) {
    return value === undefined ? [] : checkNode(value, spec.$optional, path);
  }
  if ('$nullable' in spec) {
    return value === null ? [] : checkNode(value, spec.$nullable, path);
  }
  if ('$string' in spec) {
    return checkStringSpec(value, spec.$string, path);
  }
  if ('$enum' in spec) {
    if (spec.$enum.includes(value)) return [];
    return [`${formatPath(path)}: expected one of [${spec.$enum.join(', ')}], got ${JSON.stringify(value)}`];
  }
  if ('$oneOf' in spec) {
    for (const option of spec.$oneOf) {
      if (checkNode(value, option, path).length === 0) return [];
    }
    return [`${formatPath(path)}: did not match any allowed shape (got ${describeActual(value)})`];
  }
  if ('$objectOf' in spec) {
    if (!isPlainObject(value)) {
      return [`${formatPath(path)}: expected object, got ${describeActual(value)}`];
    }
    const errors = [];
    for (const key of Object.keys(value)) {
      errors.push(...checkNode(value[key], spec.$objectOf, joinPath(path, key)));
    }
    return errors;
  }
  return [`${formatPath(path)}: unknown shape descriptor`];
}

function checkPrimitive(value, spec, path) {
  if (spec === SHAPE_TYPES.ANY) return [];
  if (spec === SHAPE_TYPES.NULL) {
    return value === null ? [] : [`${formatPath(path)}: expected null, got ${describeActual(value)}`];
  }
  if (spec === SHAPE_TYPES.NUMBER) {
    return typeof value === 'number' && Number.isFinite(value)
      ? []
      : [`${formatPath(path)}: expected number, got ${describeActual(value)}`];
  }
  if (spec === SHAPE_TYPES.STRING || spec === SHAPE_TYPES.BOOLEAN) {
    return typeof value === spec
      ? []
      : [`${formatPath(path)}: expected ${spec}, got ${describeActual(value)}`];
  }
  return [`${formatPath(path)}: unknown shape type ${JSON.stringify(spec)}`];
}

function checkNode(value, spec, path) {
  if (typeof spec === 'string') {
    return checkPrimitive(value, spec, path);
  }
  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) {
      return [`${formatPath(path)}: expected array, got ${describeActual(value)}`];
    }
    if (spec.length === 0) return [];
    const itemSpec = spec[0];
    const errors = [];
    for (let i = 0; i < value.length; i += 1) {
      errors.push(...checkNode(value[i], itemSpec, joinPath(path, `[${i}]`)));
    }
    return errors;
  }
  if (isDescriptor(spec)) {
    return checkDescriptor(value, spec, path);
  }
  if (isPlainObject(spec)) {
    if (!isPlainObject(value)) {
      return [`${formatPath(path)}: expected object, got ${describeActual(value)}`];
    }
    const errors = [];
    for (const key of Object.keys(spec)) {
      errors.push(...checkNode(value[key], spec[key], joinPath(path, key)));
    }
    return errors;
  }
  return [`${formatPath(path)}: invalid shape spec`];
}

export function checkShape(value, spec, path = '') {
  return checkNode(value, spec, path);
}
