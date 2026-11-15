import { blankLiterals } from './blank-literals.mjs';
import { declaredNames, splitTopLevel } from './split-declarators.mjs';

const IMPORT_RE =
  /\bimport\s*\(\s*(['"])([^'"]*)\1\s*\)|\bimport\s*(['"])([^'"]*)\3|\b(?:import|export)\s+(?:(?!\b(?:import|export)\b)[^;])*?\bfrom\s*(['"])([^'"]*)\5/gd;

/** Returns the [start, end) offsets of the text inside the parentheses opening at openIdx. */
function balancedParens(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return [openIdx + 1, i];
    }
  }
  return [openIdx + 1, openIdx + 1];
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

function commonJsUnknown(text) {
  return { name: '?', kind: 'unknown', signature: text.replace(/\s+/g, ' ').trim().slice(0, 60) };
}

function parseExportAt(clean, source, startIdx) {
  const rest = clean.slice(startIdx);

  if (/^\s+default\b/.test(rest)) {
    return [{ name: 'default', kind: 'default', signature: 'default' }];
  }

  const fnMatch = rest.match(/^\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/);
  if (fnMatch) {
    const openIdx = startIdx + fnMatch[0].length - 1;
    const [from, to] = balancedParens(clean, openIdx);
    const params = source.slice(from, to).replace(/\s+/g, ' ').trim();
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

  const starMatch = rest.match(/^\s*\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*(['"])[^'"]*\2/);
  if (starMatch) {
    const name = starMatch[1] ?? '*';
    return [{ name, kind: 'reexport', signature: name }];
  }

  const listMatch = rest.match(/^\s*\{([^}]*)\}(\s*from\s*(['"])[^'"]*\3)?/);
  if (listMatch) {
    return parseNamedList(listMatch[1], listMatch[2] ? 'reexport' : 'binding');
  }

  return [unknownExport(rest)];
}

function commonJsExports(clean) {
  const found = [];
  const moduleRe = /(?<![.\w$])module\s*\.\s*exports\b(\s*=\s*\{)?/g;
  for (let m; (m = moduleRe.exec(clean)) !== null; ) {
    if (!m[1]) { found.push(commonJsUnknown('module.exports')); continue; }
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = clean.length;
    for (let i = open; i < clean.length && close === clean.length; i += 1) {
      if ('([{'.includes(clean[i])) depth += 1;
      else if (')]}'.includes(clean[i])) { depth -= 1; if (depth === 0) close = i; }
    }
    const items = splitTopLevel(clean.slice(open + 1, close), ',').filter(item => item.trim());
    for (const item of items.length ? items : ['']) found.push(commonJsUnknown(`module.exports ${item}`));
  }
  const exportsRe = /(?<![.\w$])exports\s*(?:\.\s*[\w$]+|\[[^\]]*\])\s*=(?!=)/g;
  for (const m of clean.matchAll(exportsRe)) found.push(commonJsUnknown(m[0]));
  return found;
}

/**
 * Extracts exported declarations (ES and CommonJS) and imported specifiers from module source text.
 */
export function parseModule(source) {
  const clean = blankLiterals(source);
  const exports = [];
  const exportRe = /(?<![.\w$])export(?![\w$])(?!\s*[:=,)(])/g;
  for (let m; (m = exportRe.exec(clean)) !== null; ) {
    if (/\?\.\s*$/.test(clean.slice(0, m.index))) continue;
    exports.push(...parseExportAt(clean, source, m.index + m[0].length));
  }
  exports.push(...commonJsExports(clean));

  const imports = [];
  IMPORT_RE.lastIndex = 0;
  for (let m; (m = IMPORT_RE.exec(clean)) !== null; ) {
    const group = [2, 4, 6].find(g => m[g] !== undefined);
    const [from, to] = m.indices[group];
    if (to > from) imports.push(source.slice(from, to));
  }

  return { exports, imports };
}
