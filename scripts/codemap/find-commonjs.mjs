import { simple } from 'acorn-walk';

const CJS_NAMES = new Set(['module', 'exports', 'require', '__filename', '__dirname']);

/**
 * True if the program uses the identifier `module`, `exports`, `require`, `__filename` or `__dirname` anywhere (a reference, a declaration,
 * a parameter or an import binding). Member properties and object keys are not identifiers in this
 * sense. No scope analysis: the checker cannot tell a shadow from CommonJS with certainty, so the
 * names are simply reserved.
 */
export function findCommonJs(ast) {
  let found = false;
  const visit = node => { if (CJS_NAMES.has(node.name)) found = true; };
  simple(ast, {
    Identifier: visit,
    VariablePattern: visit,
    ImportDeclaration(node) { node.specifiers.forEach(s => visit(s.local)); },
  });
  return found;
}
