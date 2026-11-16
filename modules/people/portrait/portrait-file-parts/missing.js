// The session memory of which portrait files the server said are gone, with its change counter.
// The files the server said are not there, this session. A file this session wrote or the server confirmed is taken out again.
export const missing = new Set();
let missingVersion = 0;
export const markPortraitFileMissing = path => { const key = String(path || ''); if (!missing.has(key)) { missing.add(key); missingVersion += 1; } };
export const markPortraitFilePresent = path => { if (missing.delete(String(path || ''))) missingVersion += 1; };
/** Moves whenever the set of files known gone changes (the dossier view's token: what shows changed without a state write). */
export const portraitFilesVersion = () => missingVersion;
