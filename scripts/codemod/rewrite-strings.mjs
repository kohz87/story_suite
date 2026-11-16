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
// With `exists(abs)`, a token is rewritten only when the path it names is in the tracked tree.
function mapToken(token, base, mapper, exists = null) {
  const stop = token.search(/\*/);
  const head = stop < 0 ? token : token.slice(0, stop);
  const dots = /\.+$/.exec(head)?.[0] ?? '';
  const bare = head.slice(0, head.length - dots.length);
  const dirPart = bare.endsWith('/') ? bare.slice(0, -1) : bare;
  const sep = bare.endsWith('/') ? '/' : '';
  if (!dirPart) return token;
  const abs = base ? path.posix.join(base, dirPart) : dirPart;
  if (exists && !exists(abs)) return token;
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

/** The package folder a file lives in ("packages/x"), or null: package-relative strings ("src/v2/x.js") are read against it. */
function packageRoot(file) {
  return /^packages\/[^/]+(?=\/)/.exec(file)?.[0] ?? null;
}

// A string that is only dots and slashes ('.', '..', './', '../') is a separator or a bare folder name, never a file reference.
const BARE_DOTS = /^\.{1,2}\/?$/;

// The new text of one string literal's value, or null to leave it (and a `stale` entry when a package-relative path cannot follow).
function mapValue(value, { oldFile, newFile, files, mapper }, stale) {
  if (/\s/.test(value) || BARE_DOTS.test(value) || !value.includes('/')) return null;
  const oldDir = path.posix.dirname(oldFile);
  const newDir = path.posix.dirname(newFile);
  if (/^\.{1,2}\//.test(value)) {
    const abs = path.posix.normalize(path.posix.join(oldDir, value)).replace(/\/$/, '');
    if (!abs || abs.startsWith('..') || !existsInTree(abs, files)) return null;
    const mapped = mapper.map(abs);
    if (mapped === null) return null;
    let next = path.posix.relative(newDir, mapped) || '.';
    if (!next.startsWith('.')) next = `./${next}`;
    if (value.endsWith('/') && !next.endsWith('/')) next += '/';
    return next;
  }
  const exists = abs => existsInTree(abs, files);
  const root = mapToken(value, '', mapper, exists);
  if (root !== value) return root;
  const pkg = packageRoot(oldFile);
  if (!pkg) return null;
  const next = mapToken(value, pkg, mapper, exists);
  if (next === value) return null;
  if (packageRoot(newFile) !== pkg || next.startsWith('..')) { stale.push(value); return null; }
  return next;
}

function rewriteJs(source, ctx) {
  let tree;
  try {
    tree = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, allowReturnOutsideFunction: true });
  } catch (error) {
    return { source, changed: 0, stale: [], error: error.message };
  }
  const skip = new Set(scanSpecifiers(source).specs.map(item => item.start));
  const edits = [];
  const stale = [];
  const visit = node => {
    if (node?.type !== 'Literal' || typeof node.value !== 'string' || skip.has(node.start)) return;
    const next = mapValue(node.value, ctx, stale);
    if (next !== null && next !== node.value) edits.push({ start: node.start + 1, end: node.end - 1, text: next });
  };
  // acorn-walk skips a key unless it is computed, so plain keys are visited here.
  const visitKey = node => { if (!node.computed) visit(node.key); };
  walk.simple(tree, { Literal: visit, Property: visitKey, PropertyDefinition: visitKey, MethodDefinition: visitKey });
  let out = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return { source: out, changed: edits.length, stale, error: null };
}

/**
 * Rewrites the non-import path references of one file (see SITES): codemap `jobs*.json` keys, path lines in
 * the legacy-oversize list, codemap bullets, CI and package.json paths, and path-like string literals in JS.
 * `files` is the tracked set before the move; `mapper.map(path)` gives the new place. A bare `.`/`..`/`./`/`../` string is never rewritten; object keys are visited like values; a package-relative
 * string ("src/v2/x.js", read against `packages/<name>`) is rewritten when it can stay package-relative, else listed in
 * `stale`. Returns { source, changed, stale, error }.
 */
export function rewriteStrings(source, ctx) {
  const site = siteFor(ctx.oldFile);
  if (!site) return { source, changed: 0, stale: [], error: null };
  if (site.mode === 'json-keys') return { ...rewriteJsonKeys(source, ctx.mapper), stale: [], error: null };
  if (site.mode === 'text') return { ...rewriteText(source, site.base, ctx.mapper), stale: [], error: null };
  return rewriteJs(source, ctx);
}
