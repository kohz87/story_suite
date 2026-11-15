/** Returns every name a binding pattern (identifier, object, array, rest, default) declares. */
export function collectNames(pattern) {
  switch (pattern.type) {
    case 'Identifier': return [pattern.name];
    case 'ObjectPattern':
      return pattern.properties.flatMap(p => collectNames(p.type === 'RestElement' ? p.argument : p.value));
    case 'ArrayPattern': return pattern.elements.filter(Boolean).flatMap(collectNames);
    case 'AssignmentPattern': return collectNames(pattern.left);
    case 'RestElement': return collectNames(pattern.argument);
    default: return [];
  }
}
