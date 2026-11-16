// Rewrites the path references that are not imports, from an explicit table of sites (never a blind search and replace).
import path from 'node:path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { scanSpecifiers } from './specifiers.mjs';

// Which files hold path references, and how to read them.
const SITES = [
  { re: /^docs\/codemap\/jobs(-[\w-]+)?\.json$/, mode: 'json-keys' },
  { re: /^docs\/merge\/legacy-oversize\.txt$/, mode: 'text' },
  { re: /^(packages\/[^/]+)\/docs\/dev\/codemap\.md$/, mode: 'text', base: 1 },
  { re: /^docs\/dev\/codemap\.md$/, mode: 'text' },
  { re: /^\.github\/.*\.ya?ml$/, mode: 'text' },
  { re: /^package\.json$/, mode: 'text' },
  { re: /\.m?js$/, mode: 'js' },
];

function siteFor(file) {
  for (const site of SITES) {
    const match = site.re.exec(file);
    if (match) return { mode: site.mode, base: site.base ? match[site.base] : '' };
  }
  return null;
}

// Maps one path-like token that may end in a glob ("tests/v2/**") or a full stop; returns it unchanged when nothing moves.
function mapToken(token, base, mapper) {
  const stop = token.search(/\*/);
  const head = stop < 0 ? token : token.slice(0, stop);
  const dots = /\.+$/.exec(head)?.[0] ?? '';
  const bare = head.slice(0, head.length - dots.length);
  const dirPart = bare.endsWith('/') ? bare.slice(0, -1) : bare;
  const sep = bare.endsWith('/') ? '/' : '';
  if (!dirPart) return token;
  const abs = base ? path.posix.join(base, dirPart) : dirPart;
  const mapped = mapper.map(abs);
  if (mapped === null || mapped === abs) return token;
  const rel = base ? path.posix.relative(base, mapped) : mapped;
  return rel + sep + dots + (stop < 0 ? '' : token.slice(stop));
}

function rewriteText(source, base, mapper) {
  let changed = 0;
  const out = source.replace(/[A-Za-z0-9_.@*-]+(?:\/[A-Za-z0-9_.@*-]*)+/g, token => {
    const next = mapToken(token, base, mapper);
    if (next !== token) changed += 1;
    return next;
  });
  return { source: out, changed };
}

function rewriteJsonKeys(source, mapper) {
  const data = JSON.parse(source);
  let changed = 0;
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    const next = mapper.map(key);
    if (next === null) { changed += 1; continue; }
    if (next !== key) changed += 1;
    out[next] = value;
  }
  return { source: changed ? `${JSON.stringify(out, null, 2)}\n` : source, changed };
}

function existsInTree(abs, files) {
  return files.has(abs) || [...files].some(file => file.startsWith(`${abs}/`));
}

function rewriteJs(source, { oldFile, newFile, files, mapper }) {
  let tree;
  try {
    tree = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowReturnOutsideFunction: true });
  } catch (error) {
    return { source, changed: 0, error: error.message };
  }
  const skip = new Set(scanSpecifiers(source).specs.map(item => item.start));
  const edits = [];
  const oldDir = path.posix.dirname(oldFile);
  const newDir = path.posix.dirname(newFile);
  walk.simple(tree, {
    Literal(node) {
      if (typeof node.value !== 'string' || skip.has(node.start) || /\s/.test(node.value) || !node.value.includes('/') && !/^\.{1,2}$/.test(node.value)) return;
      const value = node.value;
      let next = value;
      if (/^\.{1,2}(\/|$)/.test(value)) {
        const abs = path.posix.normalize(path.posix.join(oldDir, value)).replace(/\/$/, '') || '.';
        if (abs.startsWith('..') || !(abs === '.' || existsInTree(abs, files))) return;
        const mapped = abs === '.' ? '.' : mapper.map(abs);
        if (mapped === null) return;
        next = path.posix.relative(newDir, mapped) || '.';
        if (!next.startsWith('.')) next = `./${next}`;
        if (value.endsWith('/') && !next.endsWith('/')) next += '/';
      } else {
        next = mapToken(value, '', mapper);
      }
      if (next !== value) edits.push({ start: node.start + 1, end: node.end - 1, text: next });
    },
  });
  let out = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return { source: out, changed: edits.length, error: null };
}

/**
 * Rewrites the non-import path references of one file (see SITES): codemap `jobs*.json` keys, path lines in
 * the legacy-oversize list, codemap bullets, CI and package.json paths, and path-like string literals in JS.
 * `files` is the tracked set before the move; `mapper.map(path)` gives the new place. Returns { source, changed, error }.
 */
export function rewriteStrings(source, ctx) {
  const site = siteFor(ctx.oldFile);
  if (!site) return { source, changed: 0, error: null };
  if (site.mode === 'json-keys') return { ...rewriteJsonKeys(source, ctx.mapper), error: null };
  if (site.mode === 'text') return { ...rewriteText(source, site.base, ctx.mapper), error: null };
  return rewriteJs(source, ctx);
}
