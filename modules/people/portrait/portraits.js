// Cast-portrait user files: save a picture once, verify which are still there and read one back as a data URL.
import { dataUrlOfBytes, isPortraitFileRecord, markPortraitFileMissing, markPortraitFilePresent, parseImageDataUrl, portraitFileRecordFor } from './portrait-file.js';
import { dataFileExists, dataFilesExist } from './exists.js';

/**
 * (cast portraits) Keeps a picture (a raster data URL) once, as its own user file named by its content, and returns the record
 * { path, type, hash } that names it; null when it is not a stored type, is too big, or the file could not be written (the caller then keeps
 * the picture as it always did). The file is asked about first (dataFileExists: no 404) and written only when absent; nothing is ever deleted.
 */
export async function savePortraitFile(dataUrl, { fetchFn = globalThis.fetch, headers = null } = {}) {
    const image = parseImageDataUrl(dataUrl);
    if (!image || typeof fetchFn !== 'function') return null;
    const record = portraitFileRecordFor(image.bytes, image.type);
    if (!record) return null;
    try {
        if (await dataFileExists(record.path, { fetchFn, headers: headers || null }) !== true) {
            const response = await fetchFn('/api/files/upload', {
                method: 'POST',
                headers: headers || {},
                body: JSON.stringify({ name: record.path.slice(record.path.lastIndexOf('/') + 1), data: image.base64 }),
            });
            if (!response?.ok) return null;
        }
    } catch {
        return null;
    }
    markPortraitFilePresent(record.path);
    return record;
}

/** (cast portraits) Asks the server which of these records' files are there and remembers the ones that are gone; returns how many are gone. */
export async function verifyPortraitFiles(portraits, { fetchFn = globalThis.fetch, headers = null } = {}) {
    const paths = [...new Set((portraits || []).filter(isPortraitFileRecord).map(portrait => portrait.path))];
    const answer = await dataFilesExist(paths, { fetchFn, headers });
    if (!answer) return 0;
    let gone = 0;
    for (const [path, exists] of Object.entries(answer)) {
        if (exists) markPortraitFilePresent(path);
        else { markPortraitFileMissing(path); gone += 1; }
    }
    return gone;
}

/** (cast portraits) The picture of a file-form record as a data URL (an export carries it), or null when the file is gone or is not the record's bytes. */
export async function readPortraitFileDataUrl(portrait, { fetchFn = globalThis.fetch } = {}) {
    if (!isPortraitFileRecord(portrait) || typeof fetchFn !== 'function') return null;
    try {
        const response = await fetchFn(portrait.path, { cache: 'no-store' });
        if (response?.status === 404 || !response?.ok || typeof response.arrayBuffer !== 'function') return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length) return null;
        const record = portraitFileRecordFor(bytes, portrait.type);
        return record?.hash === portrait.hash ? dataUrlOfBytes(bytes, portrait.type) : null;
    } catch {
        return null;
    }
}
