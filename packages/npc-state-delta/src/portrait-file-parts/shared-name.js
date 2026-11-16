// The portrait file naming: prefix, folder, the plain-object test and the file name for a hash and type.
export const PORTRAIT_FILE_PREFIX = 'npc-state-delta-portrait-';
export const PORTRAIT_FILE_DIR = '/user/files/';
const NAME_HASH_LENGTH = 40;
const EXTENSIONS = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' });

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The file's name for these bytes' hash and type, or '' for a type that is not stored. */
export function portraitFileName(hash, type) {
    const ext = EXTENSIONS[String(type || '').toLowerCase()];
    return ext && /^[a-f0-9]{64}$/.test(String(hash || '')) ? `${PORTRAIT_FILE_PREFIX}${hash.slice(0, NAME_HASH_LENGTH)}.${ext}` : '';
}
