// The places that carry the suite's one version number: reads them, lists the ones that disagree, rewrites them all.
import fs from 'node:fs';
import path from 'node:path';

const jsonField = (text, pick) => pick(JSON.parse(text));
// Rewrites with the file's own indent and final newline, so a version bump changes only the version lines.
const setJson = (text, apply) => { const data = JSON.parse(text); apply(data); return JSON.stringify(data, null, /\n( +)\S/.exec(text)?.[1] ?? 2) + (text.endsWith('\n') ? '\n' : ''); };
const swap = (re, text, version) => text.replace(re, (all, head, _old, tail = '') => `${head}${version}${tail}`);

const TITLE = /^(# Story Suite )(\d+\.\d+\.\d+)()/m;
const HEAD = /^(## )(\d+\.\d+\.\d+)()/m;
const BANNER = /(SUITE_VERSION = ')(\d+\.\d+\.\d+)(')/;
const manifest = {
  read: text => jsonField(text, data => data.version),
  write: (text, version) => setJson(text, data => { data.version = version; }),
};

// A file that is not in the tree yet (the root manifest and banner arrive with the one-entry work) is skipped, not failed.
export const VERSION_SITES = [
  { file: 'package.json', ...manifest },
  { file: 'package-lock.json', read: text => jsonField(text, data => data.packages?.['']?.version ?? data.version), write: (text, version) => setJson(text, data => { data.version = version; if (data.packages?.['']) data.packages[''].version = version; }) },
  { file: 'manifest.json', ...manifest },
  { file: 'ui/manifest.json', ...manifest },
  { file: 'core/version.js', read: text => text.match(BANNER)?.[2] ?? null, write: (text, version) => swap(BANNER, text, version) },
  { file: 'README.md', read: text => text.match(TITLE)?.[2] ?? null, write: (text, version) => swap(TITLE, text, version) },
  { file: 'CHANGELOG.md', read: text => text.match(HEAD)?.[2] ?? null, write: (text, version) => swap(HEAD, text, version) },
];

/** Every site present in `root` with the version it carries (null when the file has no version line). */
export function readVersions(root) {
  return VERSION_SITES.filter(site => fs.existsSync(path.join(root, site.file))).map(site => ({ file: site.file, version: site.read(fs.readFileSync(path.join(root, site.file), 'utf8')) }));
}

/** One sentence per site whose version differs from `expected`; a site whose line is missing counts as different. */
export function versionProblems(root, expected) {
  return readVersions(root).filter(row => row.version !== expected).map(row => `${row.file} version is ${row.version ?? 'missing'}, package.json says ${expected}`);
}

/** Writes `version` into every site present; throws, with nothing written, on a malformed version or a site with no version line to replace. */
export function writeVersions(root, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`release: "${version}" is not a version like 0.1.0`);
  const planned = VERSION_SITES.filter(site => fs.existsSync(path.join(root, site.file))).map(site => {
    const text = fs.readFileSync(path.join(root, site.file), 'utf8');
    if (site.read(text) === null) throw new Error(`release: ${site.file} has no version line to update`);
    return { file: path.join(root, site.file), text: site.write(text, version) };
  });
  for (const item of planned) fs.writeFileSync(item.file, item.text);
}
