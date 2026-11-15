import { parse } from 'acorn';

/**
 * True if an extensionless file's text is JavaScript: a shebang line naming node, or (with no
 * shebang) source that parses as an ES module and has an import or export. Plain text does not parse
 * with an import or export, so licences and dotfiles stay unmapped.
 */
export function isExtensionlessJs(source) {
  if (source.startsWith('#!')) return /^#!.*\bnode\b/.test(source.split('\n', 1)[0]);
  try {
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    return ast.body.some(node => /^(?:Import|Export)/.test(node.type));
  } catch {
    return false;
  }
}
