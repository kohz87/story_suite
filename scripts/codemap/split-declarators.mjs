import { blankLiterals } from './blank-literals.mjs';

const OPEN = '([{';
const CLOSE = ')]}';

/** Walks text, calling visit(char, index, depth) for chars outside strings. Stops if visit returns true. */
function walk(text, visit) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i += 1;
      while (i < text.length && text[i] !== ch) i += text[i] === '\\' ? 2 : 1;
      continue;
    }
    if (OPEN.includes(ch)) depth += 1;
    else if (CLOSE.includes(ch)) depth -= 1;
    if (visit(ch, i, depth) === true) return i;
  }
  return -1;
}

/** Splits text at top-level occurrences of sep (outside brackets and strings). */
export function splitTopLevel(text, sep) {
  const parts = [];
  let last = 0;
  walk(text, (ch, i, depth) => {
    if (ch === sep && depth === 0) {
      parts.push(text.slice(last, i));
      last = i + 1;
    }
  });
  parts.push(text.slice(last));
  return parts;
}

/** Returns the statement at the start of text: up to a top-level `;` or a newline that ends it. */
export function readStatement(text) {
  const end = walk(text, (ch, i, depth) => {
    if (depth !== 0) return false;
    if (ch === ';') return true;
    if (ch !== '\n') return false;
    const before = text.slice(0, i).trimEnd().slice(-1);
    const after = text.slice(i).trimStart()[0] ?? '';
    return !(/[,=+\-*/%&|?:<>!(.]/.test(before) || /[,.?:+\-*/%&|=<>]/.test(after));
  });
  return end < 0 ? text : text.slice(0, end);
}

function patternNames(pattern) {
  const p = pattern.trim();
  const isObject = p.startsWith('{');
  if (!isObject && !p.startsWith('[')) return /^[A-Za-z_$][\w$]*$/.test(p) ? [p] : [];
  const names = [];
  for (let item of splitTopLevel(p.slice(1, -1), ',')) {
    item = item.trim().replace(/^\.\.\./, '');
    if (!item) continue;
    item = splitTopLevel(item, '=')[0];
    if (isObject && splitTopLevel(item, ':').length > 1) item = splitTopLevel(item, ':')[1];
    names.push(...patternNames(item));
  }
  return names;
}

/** Names bound by the declarators of a `const`/`let`/`var` statement body (text after the keyword). */
export function declaredNames(body) {
  const code = blankLiterals(body);
  return splitTopLevel(readStatement(code), ',').flatMap(d => patternNames(splitTopLevel(d, '=')[0]));
}
