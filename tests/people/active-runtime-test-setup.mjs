import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The synthetic host (runtime-smoke.mjs and its siblings) was written for the flat package folder: it copies `<package>/<name>.js` into a
// fake extension folder and imports index.js from there. The code now sits under modules/people/ (each file imports its neighbours by their
// new paths), so the copies are one-line stand-ins that load the real file in place; host imports are answered by host-resolve-hook.mjs.
import { register, syncBuiltinESMExports } from 'node:module';
import { oldPath } from './helpers/old-path.js';

register('./helpers/host-resolve-hook.mjs', import.meta.url);

const testsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const copyFileSync = fs.copyFileSync.bind(fs);
fs.copyFileSync = (source, destination, ...args) => {
    const resolvedSource = path.resolve(String(source));
    const resolvedDestination = path.resolve(String(destination));
    if (fs.existsSync(resolvedSource) || path.dirname(resolvedSource).split(path.sep).includes('node_modules') || !resolvedSource.startsWith(testsRoot + path.sep)) {
        return copyFileSync(resolvedSource, resolvedDestination, ...args);
    }
    // a name from the old flat package folder
    const real = oldPath(path.relative(testsRoot, resolvedSource).split(path.sep).join('/'));
    const url = pathToFileURL(real).href;
    const body = path.basename(resolvedSource) === 'index.js' || /^bootstrap\.js$/.test(path.basename(resolvedSource))
        ? `const query = new URL(import.meta.url).search;\nawait import(${JSON.stringify(url)} + query);\nexport {};\n`
        : `export * from ${JSON.stringify(url)};\n${/export\s+default\b/.test(fs.readFileSync(real, 'utf8')) ? `export { default } from ${JSON.stringify(url)};\n` : ''}`;
    fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true });
    fs.writeFileSync(resolvedDestination, body);
};

// the adapter's src/ folder is not copied either: the hook answers a request for a file in it with the file's new home
const cpSync = fs.cpSync.bind(fs);
fs.cpSync = (source, destination, ...args) => (fs.existsSync(String(source)) ? cpSync(source, destination, ...args) : undefined);

// Reads of a flat old-name file (tests/core-prompts.js, modules/people/legacy/runtime-settings.js ...) from a test that took the package
// folder to be tests/.. or the legacy folder: a path there that does not exist is looked up as the old package name.
const legacyRoot = path.join(path.resolve(testsRoot, '..'), 'modules', 'people', 'legacy');
const mapOld = file => {
    const resolved = path.resolve(String(file));
    const base = resolved.startsWith(testsRoot + path.sep) ? testsRoot : resolved.startsWith(legacyRoot + path.sep) ? legacyRoot : null;
    if (!base || fs.existsSync(resolved)) return file;
    const real = oldPath(path.relative(base, resolved).split(path.sep).join('/'));
    return fs.existsSync(real) ? real : file;
};
for (const name of ['readFileSync', 'readdirSync', 'statSync', 'lstatSync']) {
    const original = fs[name].bind(fs);
    fs[name] = (file, ...rest) => original(typeof file === 'string' || file instanceof URL ? mapOld(file instanceof URL ? fileURLToPath(file) : file) : file, ...rest);
}

// files that import `{ readFileSync }` by name see the patched functions too
syncBuiltinESMExports();
