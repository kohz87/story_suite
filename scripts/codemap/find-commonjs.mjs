import { ancestor, recursive } from 'acorn-walk';
import { collectNames } from './pattern-names.mjs';

const CJS_NAMES = new Set(['module', 'exports']);
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const LOOPS = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement']);

// let/const/class/function declared directly in a statement list (export wrappers unwrapped).
function directNames(statements) {
  const names = [];
  for (const raw of statements) {
    const stmt = raw.type.startsWith('Export') && raw.declaration ? raw.declaration : raw;
    if (stmt.type === 'VariableDeclaration' && stmt.kind !== 'var') {
      stmt.declarations.forEach(d => names.push(...collectNames(d.id)));
    } else if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') {
      if (stmt.id) names.push(stmt.id.name);
    } else if (stmt.type === 'ImportDeclaration') {
      stmt.specifiers.forEach(s => names.push(s.local.name));
    }
  }
  return names;
}

// `var` declarations anywhere below the node, without crossing into nested functions.
function varNames(node) {
  const names = [];
  recursive(node, null, {
    Function() {},
    VariableDeclaration(decl, state, c) {
      if (decl.kind === 'var') decl.declarations.forEach(d => names.push(...collectNames(d.id)));
      decl.declarations.forEach(d => { if (d.init) c(d.init, state, 'Expression'); });
    },
  });
  return names;
}

function declaredBy(node) {
  if (node.type === 'Program') return [...directNames(node.body), ...varNames(node)];
  if (FUNCTIONS.has(node.type) || node.type === 'FunctionExpression') {
    const own = node.params.flatMap(collectNames);
    if (node.type === 'FunctionExpression' && node.id) own.push(node.id.name);
    return node.body.type === 'BlockStatement' ? [...own, ...varNames(node.body)] : own;
  }
  if (node.type === 'BlockStatement' || node.type === 'StaticBlock') return directNames(node.body);
  if (node.type === 'SwitchStatement') return directNames(node.cases.flatMap(c => c.consequent));
  if (node.type === 'CatchClause') return node.param ? collectNames(node.param) : [];
  if (node.type === 'ClassExpression') return node.id ? [node.id.name] : [];
  if (LOOPS.has(node.type)) {
    const head = node.init ?? node.left;
    return head?.type === 'VariableDeclaration' && head.kind !== 'var' ? directNames([head]) : [];
  }
  return [];
}

/**
 * True if the program refers to a free (undeclared in any enclosing scope) `module` or `exports`.
 * ES modules have neither, so any such reference is CommonJS. Computed access counts too.
 */
export function findCommonJs(ast) {
  const cache = new WeakMap();
  const scopeNames = node => {
    if (!cache.has(node)) cache.set(node, new Set(declaredBy(node)));
    return cache.get(node);
  };
  let found = false;
  const visit = (node, _state, parents) => {
    if (found || !CJS_NAMES.has(node.name)) return;
    if (!parents.some(parent => scopeNames(parent).has(node.name))) found = true;
  };
  ancestor(ast, { Identifier: visit, VariablePattern: visit });
  return found;
}
