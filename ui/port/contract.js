// Defines the UI-to-engine port method contract and validates port implementations.

export const PORT_METHODS = Object.freeze([
  'view',
  'command',
  'preview',
  'commit',
  'on',
]);

export function checkPort(port) {
  const errors = [];
  const missing = [];

  if (!port || typeof port !== 'object') {
    return {
      ok: false,
      missing: [...PORT_METHODS],
      errors: ['port must be a non-null object'],
    };
  }

  for (const method of PORT_METHODS) {
    if (typeof port[method] !== 'function') {
      missing.push(method);
      errors.push(`port.${method} must be a function`);
    }
  }

  return {
    ok: errors.length === 0,
    missing,
    errors,
  };
}
