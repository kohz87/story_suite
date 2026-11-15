// What a portrait record shows: its file path while the file is not gone and the URL it displays.
import { missing } from './missing.js';
import { isObject } from './shared-name.js';
import { isPortraitFileRecord } from './record.js';

/** The record's file path while the file is not known to be gone, else ''. */
export const portraitFileSrc = portrait => (isPortraitFileRecord(portrait) && !missing.has(portrait.path) ? portrait.path : '');

/** Whether the record is a file-form portrait whose file is known gone this session (a cast dossier in that state may be refilled). */
export const portraitFileKnownGone = portrait => isPortraitFileRecord(portrait) && missing.has(portrait.path);

/** The URL a portrait record shows: its data URL, else its file (unless known gone), else a plain url/src; '' when there is none. */
export function portraitSrc(portrait) {
    if (!isObject(portrait)) return '';
    if (typeof portrait.dataUrl === 'string' && portrait.dataUrl) return portrait.dataUrl;
    if (portraitFileSrc(portrait)) return portrait.path;
    if (typeof portrait.url === 'string' && portrait.url) return portrait.url;
    return typeof portrait.src === 'string' ? portrait.src : '';
}
