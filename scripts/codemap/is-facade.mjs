// A file that only forwards other modules' exports: re-exports, and imports used just by export lists.
function isForwarder(node) {
  if (node.type === 'ExportAllDeclaration') return true;
  if (node.type === 'ExportNamedDeclaration') return !node.declaration;
  return node.type === 'ExpressionStatement' && typeof node.directive === 'string';
}

/**
 * True if the program body holds nothing but re-exports, `export { … }` lists, directives, and
 * imports whose bindings are used only by those lists. Any other statement means it is not a facade.
 */
export function isFacade(ast) {
  const listed = new Set();
  for (const node of ast.body) {
    if (node.type === 'ExportNamedDeclaration' && !node.source) node.specifiers.forEach(s => listed.add(s.local.name));
  }
  const importsOk = node => node.type === 'ImportDeclaration'
    && node.specifiers.length > 0 && node.specifiers.every(s => listed.has(s.local.name));
  return ast.body.length > 0 && ast.body.every(node => isForwarder(node) || importsOk(node));
}
