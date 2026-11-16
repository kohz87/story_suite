const MAX_JOB_LENGTH = 200;
// A full stop after one of these does not end the sentence.
const ABBREVIATIONS = /(?:e\.g|i\.e|etc|vs|approx|incl|cf|no)$/i;

function lineComment(lines, start) {
  const parts = [];
  for (let i = start; i < lines.length && lines[i].trimStart().startsWith('//'); i += 1) {
    parts.push(lines[i].replace(/^\s*\/\/\s*\*?\s?/, ''));
  }
  return parts.join(' ');
}

function blockComment(lines, start) {
  const rest = lines.slice(start).join('\n');
  const close = rest.indexOf('*/');
  if (close === -1) return null;
  return rest.slice(rest.indexOf('/*') + 2, close).split('\n').map(line => line.replace(/^\s*\*+\s?/, '')).join(' ');
}

function openingComment(source) {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  let i = 0;
  const skipBlank = () => { while (i < lines.length && lines[i].trim() === '') i += 1; };
  skipBlank();
  if (i < lines.length && lines[i].startsWith('#!')) { i += 1; skipBlank(); }
  if (i >= lines.length) return null;
  const first = lines[i].trimStart();
  const text = first.startsWith('//') ? lineComment(lines, i) : first.startsWith('/*') ? blockComment(lines, i) : null;
  return text === null ? null : text.replace(/\s+/g, ' ').trim();
}

function firstSentence(text) {
  const pattern = /[.?!](?=\s|$)/g;
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    if (!ABBREVIATIONS.test(text.slice(0, m.index))) return text.slice(0, m.index + 1);
  }
  return text;
}

/**
 * The first sentence of a file's opening comment (capped at 200 characters), or null if it has none.
 */
export function headerJob(source) {
  const comment = openingComment(source);
  if (!comment) return null;
  const sentence = firstSentence(comment);
  return sentence.length <= MAX_JOB_LENGTH ? sentence : `${sentence.slice(0, MAX_JOB_LENGTH - 1).trimEnd()}…`;
}
