// ST-LINK: the release copies the Pack Studio (studio/ and every file it reaches) into the extension's output folder at the same relative paths.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { copyStudio, studioFiles, STUDIO_ENTRY } from '../../scripts/release/studio.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
let temp;
before(() => { temp = tempDir('release-studio-'); });
after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('the Studio page reaches its modules, the dry-run worker, the sheets and the fonts, and none is missing', () => {
  const { files, missing } = studioFiles(repoRoot);
  assert.deepEqual(missing, []);
  for (const want of [STUDIO_ENTRY, 'studio/main.js', 'studio/dryrun/worker.js', 'studio/studio.css', 'ui/css/base.css', 'ui/theme/apply.js', 'packs/zip.js', 'ui/dev/fonts/nunito-latin-400.woff2']) assert.ok(files.includes(want), want);
});

test('the copy holds every file the Studio page reaches, byte for byte, and every relative import in it resolves inside the copy', () => {
  const out = path.join(temp, 'whole');
  assert.deepEqual(copyStudio(repoRoot, out), []);
  const { files } = studioFiles(repoRoot);
  for (const file of files) assert.ok(fs.readFileSync(path.join(out, file)).equals(fs.readFileSync(path.join(repoRoot, file))), file);
  for (const file of files.filter(name => name.endsWith('.js'))) {
    for (const [, spec] of fs.readFileSync(path.join(out, file), 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      assert.ok(fs.existsSync(path.join(out, path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)))), `${file} imports ${spec}`);
    }
  }
});

test('a reference to a file that does not exist is a problem of the release, and a page that is missing is too', () => {
  const root = path.join(temp, 'broken');
  fs.mkdirSync(path.join(root, 'studio'), { recursive: true });
  fs.writeFileSync(path.join(root, 'studio/index.html'), '<link rel="stylesheet" href="./a.css"><script type="module" src="./main.js"></script>');
  fs.writeFileSync(path.join(root, 'studio/a.css'), '@import "./gone.css"; .x { background: url(../ui/none.png); }');
  fs.writeFileSync(path.join(root, 'studio/main.js'), "import { x } from '../packs/nope.js';\nexport { x };\n");
  const problems = copyStudio(root, path.join(temp, 'broken-out'));
  assert.equal(problems.length, 3, problems.join('\n'));
  assert.ok(problems.every(line => line.startsWith('studio: ')));
  assert.deepEqual(copyStudio(path.join(temp, 'empty'), path.join(temp, 'empty-out')), [`studio: ${STUDIO_ENTRY} is missing`]);
});

test('node scripts/release.mjs --out puts the Studio page beside the extension bundle, with its modules and sheets', () => {
  const out = path.join(repoRoot, 'dist', `studio-test-${process.pid}`);
  try {
    execFileSync(process.execPath, [path.join(repoRoot, 'scripts/release.mjs'), '--out', out], { encoding: 'utf8', stdio: 'pipe' });
    const ext = path.join(out, 'story-suite');
    for (const file of ['index.js', 'suite.css', STUDIO_ENTRY, 'studio/main.js', 'studio/dryrun/worker.js', 'ui/css/base.css']) assert.ok(fs.existsSync(path.join(ext, file)), file);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
