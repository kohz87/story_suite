// Reads what a reader picked (a pack.json with its images, or a .zip) or the open character's lorebook, installs it through
// `packs` (installed.js) and says what happened in words: `{ text, errors }`. No DOM: the old Packs panel and the new view's
// Settings › Packs and trackers both call these, so a pack goes in the same way and is told the same way from either.

import { plural } from '../ui/legacy/ui/dom.js';
import { LIMITS, ZIP_LIMITS } from './limits.js';
import { isZipFile, readPackZip } from './bundle.js';

const errorLines = errors => errors.slice(0, 5).map(error => error.message);
const isJson = file => /\.json$/i.test(file.name) || file.type === 'application/json';
const said = (text, errors = []) => ({ text, errors });

function portraitLine(report) {
    if (!report) return '';
    const parts = [];
    if (report.stored.length) parts.push(`${plural(report.stored.length, 'portrait')} saved`);
    if (report.dropped) parts.push(`${plural(report.dropped, 'portrait')} no longer in the pack removed`);
    // Only a count: the missing file names are the unmet people's names, which the reader must not see.
    if (report.missing.length) parts.push(report.missing.length === 1 ? '1 portrait not picked; that person shows without a picture until you add it' : `${report.missing.length} portraits not picked; the people show without a picture until you add them`);
    return parts.join('; ');
}

// What an install said, in words: the pack, then its portraits (saved, dropped, not picked) and each image not used.
async function finish(packs, name, text, images) {
    const result = await packs.install(text, { source: 'file', origin: name, files: images });
    if (!result.ok) return said(`${name} was not imported.`, errorLines(result.errors));
    const first = result.action === 'unchanged' ? `${result.name} is already installed.` : `${result.action === 'updated' ? 'Updated' : 'Installed'} ${result.name}.`;
    const refused = result.portraits?.refused ?? [];
    return said([first, portraitLine(result.portraits) ? `${portraitLine(result.portraits)}.` : '', refused.length ? `${plural(refused.length, 'image')} not used.` : ''].filter(Boolean).join(' '),
        [...(result.warnings ?? []).map(item => `Ignored: ${item.message}`), ...refused.map(item => item.message)]);
}

// A pack as one zip (bundle.js): pack.json and its portraits/ folder, picked alone.
async function importZip(packs, file, withOthers) {
    if (withOthers) return said('Nothing was imported.', ['Pick the .zip alone, or pick pack.json with its images; not both.']);
    if (file.size > ZIP_LIMITS.archive) return said(`${file.name} was not imported.`, [`The zip is larger than ${Math.round(ZIP_LIMITS.archive / 1024 / 1024)} MB.`]);
    let bytes;
    try {
        bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
        return said(`${file.name} could not be read.`);
    }
    const bundle = await readPackZip(bytes);
    if (!bundle.ok) return said(`${file.name} was not imported.`, [bundle.message]);
    return finish(packs, file.name, bundle.text, bundle.files);
}

/** Installs the picked files: one pack.json (any .json) with the images beside it, or one .zip. → `{ text, errors }`, or null when nothing was picked. */
export async function importPicked(packs, picked) {
    const list = Array.from(picked ?? []).filter(Boolean);
    if (!list.length) return null;
    const zips = list.filter(isZipFile);
    if (zips.length) return importZip(packs, zips[0], list.length > 1);
    const jsons = list.filter(isJson);
    if (jsons.length !== 1) return said('Nothing was imported.', [jsons.length ? 'Pick one pack file at a time, with its images.' : 'Pick the pack\'s .json file together with its images.']);
    const file = jsons[0];
    if (file.size > LIMITS.packBytes) return said(`${file.name} was not imported.`, [`The pack is larger than ${Math.round(LIMITS.packBytes / 1024)} KB.`]);
    let text;
    try {
        text = await file.text();
    } catch {
        return said(`${file.name} could not be read.`);
    }
    const images = list.filter(other => other !== file).map(other => ({ name: other.name, size: other.size, read: async () => new Uint8Array(await other.arrayBuffer()) }));
    return finish(packs, file.name, text, images);
}

/** Installs the packs in the open character's lorebook entries tagged [storysuite:pack]; `lore` (optional) also reads the places' market lines. → `{ text, errors }`. */
export async function importFromLorebook(packs, readLorebook, lore = null) {
    const read = await readLorebook();
    if (read.problem) return said(read.problem);
    // The places' `market:` lines (PACKS.md "Markets") are read again at the same time.
    let places = null;
    try { places = typeof lore?.read === 'function' ? await lore.read() : null; } catch { places = null; }
    const marketText = Number.isInteger(places) && places > 0 ? ` ${plural(places, 'place')} with a market line.` : '';
    const { found, results } = await packs.importLorebook(read.entries);
    if (!found) return said(`No lorebook entry of ${read.character || 'this character'} is tagged [storysuite:pack].${marketText}`);
    const good = results.filter(result => result.ok);
    const bad = results.filter(result => !result.ok);
    const text = [
        good.length ? `Read ${plural(good.length, 'pack')} from the lorebook: ${good.map(result => result.name).join(', ')}.` : '',
        bad.length ? `${bad.length} ${bad.length === 1 ? 'entry was' : 'entries were'} not imported.` : '',
        marketText.trim(),
    ].filter(Boolean).join(' ');
    return said(text, [...good.flatMap(result => (result.warnings ?? []).map(warning => `${result.title || result.origin}: Ignored: ${warning.message}`)), ...bad.flatMap(result => errorLines(result.errors).map(line => `${result.title || result.origin}: ${line}`))]);
}
