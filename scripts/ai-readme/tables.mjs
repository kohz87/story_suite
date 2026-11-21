// The generated tables of AI-README.md: each is read from the code (never typed), so it cannot go stale.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// What a change-line mark means (the marks themselves come from the parser's OPS).
const OP_MEANING = { '+': 'new or gained', '-': 'gone or lost', '~': 'changed', '!': 'happened', '?': 'asks code to decide' };
// What each top-level folder is for. A folder missing here fails the build, so a new one gets a sentence.
const FOLDER_ROLES = {
  '.github': 'CI workflows.',
  assets: 'Images and fonts the extension serves.',
  'authoring-kit': 'The kit a pack author runs: the checker and limits.',
  core: 'The host: store, persist, replay, commands, prompt, SDK, boot, settings.',
  docs: 'Developer docs and the generated code maps.',
  examples: 'Example packs and modules.',
  modules: 'One folder per module (scene, inventory, rpg, time, atlas, world, cast, arc, people and the rest).',
  packs: 'Pack validation, import, limits and the pack card.',
  scripts: 'Checks, code map, release build and CI helpers.',
  studio: 'The Pack Studio page for writing packs.',
  testkit: 'Test helpers modules and packs share.',
  tests: 'Every test, by area.',
  ui: 'The view: shell, tabs, sheets, settings, themes.',
};

const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const list = values => values.map(v => `\`${v}\``).join(', ');
const load = (root, rel) => import(pathToFileURL(path.join(root, rel)).href);
const describe = value => (typeof value === 'function' ? 'function' : Array.isArray(value) ? 'list' : typeof value === 'object' && value ? 'object' : typeof value);

async function sdkTable(root) {
  const rows = [];
  for (const rel of ['core/sdk.js', 'core/public-api.js']) {
    const ns = await load(root, rel);
    for (const name of Object.keys(ns).sort()) rows.push([`\`${name}\``, describe(ns[name]), `\`${rel}\``]);
  }
  return table(['Export', 'Kind', 'From'], rows);
}

async function commandsTable(root) {
  const { OPS } = await load(root, 'core/capture/lines-parts/parse-line.js');
  const { MAX_CHANGE_LINES } = await load(root, 'core/sdk/constants-parts/limits.js');
  const { CAUSES, MAX_DEPTH } = await load(root, 'core/commands/shared-parts/limits.js');
  const marks = table(['Mark', 'Meaning'], OPS.map(op => [`\`${op}\``, OP_MEANING[op] ?? '(undocumented: add it to OP_MEANING in tables.mjs)']));
  return `${marks}\n\nOne reply holds at most ${MAX_CHANGE_LINES} change lines. A command's cause is one of ${list(CAUSES)}; commands may call commands to a depth of ${MAX_DEPTH}.`;
}

const rowsOf = obj => Object.entries(obj).map(([k, v]) => [`\`${k}\``, typeof v === 'number' ? v : JSON.stringify(v)]);

async function packTables(root) {
  const lim = await load(root, 'packs/limits.js');
  const fmt = await load(root, 'packs/limits-parts/format.js');
  const kinds = `Format read: ${fmt.PACK_FORMAT} (an older format, or none, is refused and named for the converter; a newer one is refused too).\n\nKinds: ${list(lim.PACK_KINDS)}.\n\nTop-level fields of \`pack.json\`: ${list(lim.PACK_FIELDS_V4)}.\n\nContent keys of a world pack: ${list(lim.CONTENT_KEYS.world)}.\n\nContent keys of a game pack: ${list(lim.CONTENT_KEYS.game)}.`;
  return { 'pack-kinds': kinds, limits: table(['Limit', 'Value'], rowsOf(lim.LIMITS)), 'zip-limits': table(['Zip limit', 'Value'], rowsOf(lim.ZIP_LIMITS)) };
}

async function studioTable(root) {
  const { PARTS } = await load(root, 'studio/parts.js');
  return table(['Part', 'Group', 'Shows'], PARTS.map(p => [p.name, p.group, p.desc]));
}

function foldersTable(root) {
  // Tracked files only, so a checkout with stray folders gives the same table as CI.
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).split('\0');
  const dirs = [...new Set(files.filter(f => f.includes('/')).map(f => f.split('/')[0]))].sort();
  const missing = dirs.filter(d => !(d in FOLDER_ROLES));
  if (missing.length) throw new Error(`ai-readme: top-level folder without a sentence in FOLDER_ROLES: ${missing.join(', ')}`);
  return table(['Folder', 'Job'], dirs.map(d => [`\`${d}/\``, FOLDER_ROLES[d]]));
}

async function versionLine(root) {
  const { SUITE_VERSION } = await load(root, 'core/version.js');
  return `**Version \`${SUITE_VERSION}\`**, pack format ${(await load(root, 'packs/limits-parts/format.js')).PACK_FORMAT}.`;
}

/** Every generated block by name (`<!-- generated:<name> -->`), as Markdown. */
export async function generatedTables(root) {
  return { version: await versionLine(root), sdk: await sdkTable(root), commands: await commandsTable(root), ...(await packTables(root)), studio: await studioTable(root), folders: foldersTable(root) };
}
