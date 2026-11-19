// The people view keeps no image bytes (view.js): inline images are dropped and portrait assets keep only their file references. Pure.

import { isPlain } from './volatile.js';

// Portraits go to the store as file references only (the people domain refuses image bytes, and one data URL would make every write of the chat INVALID).
// `noBytes` drops every `dataUrl` key and every data-URL string (NPC State still makes such records when a portrait file write fails); `fileRefs`
// keeps only the portraitAssets entries that are `{ path, type, hash }`. A portrait held only as bytes stays in NPC State's memory, not in the store.
const IMAGE_BYTES = /^data:[^,]{0,100};base64,/i;

export function noBytes(value) {
    if (Array.isArray(value)) return value.filter(item => !(typeof item === 'string' && IMAGE_BYTES.test(item))).map(noBytes);
    if (typeof value === 'string') return value;
    if (!isPlain(value)) return value;
    const out = {};
    for (const key of Object.keys(value)) {
        const item = value[key];
        if (key === 'dataUrl' || (typeof item === 'string' && IMAGE_BYTES.test(item))) continue;
        out[key] = noBytes(item);
    }
    return out;
}

const isFileRef = record => isPlain(record) && typeof record.path === 'string' && record.path !== '' && typeof record.type === 'string' && typeof record.hash === 'string';

export const fileRefs = assets => Object.fromEntries(Object.entries(assets).filter(([, record]) => isFileRef(record)));
