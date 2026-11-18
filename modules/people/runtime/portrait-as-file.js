// A portrait picked on the device is kept the way a cast portrait is: once, as its own user file named by its content, with the dossier
// holding only { path, type, hash, width, height, sourceName, updatedAt }. The store takes file references only, so a record that kept the
// picture itself (`dataUrl`) showed nowhere in the new views and was gone after a reload. When the file cannot be written the record keeps
// the picture as before.
import { savePortraitFile } from '../storage/storage.js';

/** `portrait` ({ dataUrl, mime, ... }) as the file-form record when the picture could be filed, else `portrait` itself. */
export async function portraitAsFile(portrait, headers) {
    const filed = await savePortraitFile(portrait?.dataUrl, { headers });
    if (!filed) return portrait;
    const { dataUrl, mime, ...rest } = portrait;
    return { ...rest, ...filed };
}
