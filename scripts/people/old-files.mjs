// The one-time clean-up of the old NPC State files from before the merge (owner answer 21 Nov, RETENTION §9 q4): the separate NPC State
// Delta kept its people in files of its own in SillyTavern's user files folder (data files, recovery copies, packed checkpoints), which the
// merged extension never reads. SillyTavern gives a page no way to list that folder, so this runs where the folder is:
//
//   node scripts/people/old-files.mjs <SillyTavern data>/<user>/user/files            lists them with their sizes (nothing is deleted)
//   node scripts/people/old-files.mjs <folder> --delete                                lists them, asks, and deletes only on "yes"
//
// Only `npc-state*.json` files go. Portraits (any name with "portrait", any picture) and every other extension's files stay.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const OLD = /^npc-state[a-z0-9._-]*\.json$/i;

/** The old NPC State files in `dir`: [{ name, size }] by name, and their total size in bytes. */
export function listOldFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !OLD.test(entry.name) || /portrait/i.test(entry.name)) continue;
        files.push({ name: entry.name, size: fs.statSync(path.join(dir, entry.name)).size });
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    return { files, total: files.reduce((sum, file) => sum + file.size, 0) };
}

/** Deletes the named files of `dir` that are still old NPC State files (a name that is not one is never touched). → { deleted, failed }. */
export function deleteOldFiles(dir, names) {
    const deleted = [];
    const failed = [];
    const allowed = new Set(listOldFiles(dir).files.map(file => file.name));
    for (const name of names) {
        if (!allowed.has(name)) { failed.push(name); continue; }
        try { fs.unlinkSync(path.join(dir, name)); deleted.push(name); } catch { failed.push(name); }
    }
    return { deleted, failed };
}

export const sizeText = bytes => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

async function main(argv, { input = process.stdin, output = process.stdout } = {}) {
    const dir = argv.find(arg => !arg.startsWith('--'));
    if (!dir || !fs.existsSync(dir)) {
        output.write('Give the SillyTavern user files folder, e.g. data/default-user/user/files.\n');
        return 2;
    }
    const { files, total } = listOldFiles(dir);
    if (!files.length) {
        output.write('No old NPC State files were found.\n');
        return 0;
    }
    for (const file of files) output.write(`${sizeText(file.size).padStart(9)}  ${file.name}\n`);
    output.write(`${files.length} old NPC State files from before the merge, ${sizeText(total)} in all. Story Suite no longer reads them. Portraits are kept.\n`);
    if (!argv.includes('--delete')) return 0;
    const ask = readline.createInterface({ input, output });
    const answer = await ask.question(`Delete these ${files.length} files? This can't be undone. Type yes to delete: `);
    ask.close();
    if (answer.trim().toLowerCase() !== 'yes') {
        output.write('Nothing was deleted.\n');
        return 0;
    }
    const { deleted, failed } = deleteOldFiles(dir, files.map(file => file.name));
    output.write(`Deleted ${deleted.length} old NPC State files.${failed.length ? ` Some files could not be deleted: ${failed.join(', ')}.` : ''}\n`);
    return failed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    process.exitCode = await main(process.argv.slice(2));
}
export { main };
