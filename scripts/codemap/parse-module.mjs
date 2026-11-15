import { declaredNames } from './split-declarators.mjs';

const COMMENT_OR_STRING_RE =
  /(['"`])(?:\\.|(?!\1)[\s\S])*?\1|\/\*[\s\S]*?\*\/|\/\/.*$/gm;

const IMPORT_RE =
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)|\bimport\s*(['"])([^'"]+)\3|\b(?:import|export)\s+(?:(?!\b(?:import|export)\b)[^;])*?\bfrom\s*(['"])([^'"]+)\5/g;

function stripComments(source) {
  return source.replace(COMMENT_OR_STRING_RE, (match, quote) => (quote ? match : ' '));
}

function readBalancedParens(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return '';
}

function parseNamedList(body, kind) {
  const results = [];
  for (const raw of body.split(',')) {
    const item = raw.trim();
    if (!item) continue;
    const asMatch = item.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
    const name = asMatch ? asMatch[2] : item;
    results.push({ name, kind, signature: name });
  }
  return results;
}

function unknownExport(rest) {
  const signature = `export ${rest}`.replace(/\s+/g, ' ').trim().slice(0, 60);
  return { name: '?', kind: 'unknown', signature };
}

function parseExportAt(clean, startIdx) {
  const rest = clean.slice(startIdx);

  if (/^\s+default\b/.test(rest)) {
    return [{ name: 'default', kind: 'default', signature: 'default' }];
  }

  const fnMatch = rest.match(/^\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/);
  if (fnMatch) {
    const openIdx = startIdx + fnMatch[0].length - 1;
    const params = readBalancedParens(clean, openIdx).replace(/\s+/g, ' ').trim();
    const name = fnMatch[1];
    return [{ name, kind: 'function', signature: `${name}(${params})` }];
  }

  const classMatch = rest.match(/^\s+class\s+([A-Za-z_$][\w$]*)/);
  if (classMatch) {
    const name = classMatch[1];
    return [{ name, kind: 'class', signature: `class ${name}` }];
  }

  const varMatch = rest.match(/^\s+(?:const|let|var)\s+/);
  if (varMatch) {
    const names = declaredNames(rest.slice(varMatch[0].length));
    if (names.length) return names.map(name => ({ name, kind: 'const', signature: name }));
  }

  const starMatch = rest.match(/^\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*(['"])[^'"]+\2/);
  if (starMatch) {
    const name = starMatch[1] ?? '*';
    return [{ name, kind: 'reexport', signature: name }];
  }

  const listMatch = rest.match(/^\s*\{([^}]*)\}(\s*from\s*(['"])[^'"]+\3)?/);
  if (listMatch) {
    return parseNamedList(listMatch[1], listMatch[2] ? 'reexport' : 'binding');
  }

  return [unknownExport(rest)];
}

/**
 * Extracts exported declarations and imported specifiers from an ES module source.
 */
export function parseModule(source) {
  const clean = stripComments(source);
  const exports = [];
  const exportRe = /^[ \t]*export\b/gm;
  for (let m; (m = exportRe.exec(clean)) !== null; ) {
    exports.push(...parseExportAt(clean, m.index + m[0].length));
  }

  const imports = [];
  IMPORT_RE.lastIndex = 0;
  for (let m; (m = IMPORT_RE.exec(clean)) !== null; ) {
    imports.push(m[2] ?? m[4] ?? m[6]);
  }

  return { exports, imports };
}
