const REGEX_AFTER_WORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await',
]);
const REGEX_AFTER_CHARS = '(,=:[!&|?{};+-*%<>~^';

function previousToken(out, from) {
  let i = from - 1;
  while (i >= 0 && /\s/.test(out[i])) i -= 1;
  if (i < 0) return { ch: '', word: '' };
  const ch = out[i];
  let start = i;
  while (start >= 0 && /[\w$]/.test(out[start])) start -= 1;
  return { ch, word: start < i ? out.slice(start + 1, i + 1).join('') : '' };
}

function regexAllowed(out, at) {
  const { ch, word } = previousToken(out, at);
  if (!ch) return true;
  if (word) return REGEX_AFTER_WORDS.has(word);
  return REGEX_AFTER_CHARS.includes(ch);
}

/** Returns the index after the regex literal starting at `at`, or -1 if it does not close on its line. */
function regexEnd(src, at) {
  let inClass = false;
  for (let i = at + 1; i < src.length; i += 1) {
    const c = src[i];
    if (c === '\n') return -1;
    if (c === '\\') i += 1;
    else if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      let end = i + 1;
      while (/[a-z]/i.test(src[end] ?? '')) end += 1;
      return end;
    }
  }
  return -1;
}

/**
 * Returns the source with comments and the insides of strings, templates and regex literals
 * replaced by spaces (line breaks and `${}` expressions kept), so text scans see only code.
 * The result has the same length and offsets as the input.
 */
export function blankLiterals(src) {
  const out = src.split('');
  const n = src.length;
  const templateDepths = [];
  let depth = 0;
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  const templateText = () => {
    const start = i;
    while (i < n) {
      const c = src[i];
      if (c === '\\') i += 2;
      else if (c === '`') { blank(start, i); i += 1; return; }
      else if (c === '$' && src[i + 1] === '{') { blank(start, i); i += 2; templateDepths.push(depth); return; }
      else i += 1;
    }
    blank(start, n);
  };

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      blank(i, stop);
      i = stop;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      blank(i + 1, Math.min(j, n));
      i = j + 1;
    } else if (c === '`') {
      i += 1;
      templateText();
    } else if (c === '/' && regexAllowed(out, i)) {
      const end = regexEnd(src, i);
      if (end < 0) { i += 1; continue; }
      let close = end - 1;
      while (src[close] !== '/') close -= 1;
      blank(i + 1, close);
      i = end;
    } else if (c === '{') {
      depth += 1;
      i += 1;
    } else if (c === '}') {
      if (templateDepths.length > 0 && templateDepths[templateDepths.length - 1] === depth) {
        templateDepths.pop();
        i += 1;
        templateText();
      } else {
        depth -= 1;
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return out.join('');
}
