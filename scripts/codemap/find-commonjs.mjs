import { full } from 'acorn-walk';

const CJS_NAMES = new Set(['module', 'exports', 'require', '__filename', '__dirname']);

function bindingNames(pattern, into) {
  if (!pattern) return;
  switch (pattern.type) {
    case 'Identifier': into.add(pattern.name); break;
    case 'ObjectPattern': pattern.properties.forEach(p => bindingNames(p.type === 'RestElement' ? p.argument : p.value, into)); break;
    case 'ArrayPattern': pattern.elements.forEach(e => bindingNames(e, into)); break;
    case 'RestElement': bindingNames(pattern.argument, into); break;
    case 'AssignmentPattern': bindingNames(pattern.left, into); break;
    default: break;
  }
}

/**
 * True if the program uses CommonJS: a reference to the free name `module`, `exports`, `require`,
 * `__filename` or `__dirname` (module.exports, exports.x, require(...), Object.assign(exports, ...)).
 * A property access (`receipt.module`), an object key, and a name the file itself declares (a local
 * variable, parameter, function, class, catch or import binding called `module`) are not CommonJS.
 * Declarations are collected for the whole file, not per scope: a file that declares the name anywhere
 * is treated as using its own, which never flags a local variable but may miss a shadowed real use.
 */
export function findCommonJs(ast) {
  const declared = new Set();
  const referenced = new Set();
  const params = node => node.params.forEach(p => bindingNames(p, declared));
  full(ast, node => {
    switch (node.type) {
      case 'VariableDeclarator': bindingNames(node.id, declared); break;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
        params(node); if (node.id) declared.add(node.id.name); break;
      case 'ClassDeclaration': case 'ClassExpression': if (node.id) declared.add(node.id.name); break;
      case 'CatchClause': bindingNames(node.param, declared); break;
      case 'ImportSpecifier': case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': declared.add(node.local.name); break;
      default: break;
    }
  });
  const isReference = (node, parent) => {
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return false;
    if ((parent.type === 'Property' || parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition') && parent.key === node && !parent.computed && !parent.shorthand) return false;
    if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') return false;
    return true;
  };
  const walk = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier' && CJS_NAMES.has(node.name) && parent && isReference(node, parent)) referenced.add(node.name);
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(c => walk(c, node));
      else if (child && typeof child.type === 'string') walk(child, node);
    }
  };
  walk(ast, null);
  return [...referenced].some(name => !declared.has(name));
}
