// The job: pack portraits stored as SillyTavern user files (upload, delete, verify, url).

import { context } from './shared-context.js';

// base64 of bytes, in slices so a long picture does not overflow the argument list.
function base64Of(bytes) {
    let text = '';
    for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    return btoa(text);
}

/**
 * Pack portraits on SillyTavern's user files (portraits.js): `{ put, remove, exists, url }`, or null where there is no
 * SillyTavern to ask. A file is written to `/api/files/upload` and shown at `/user/files/<name>`; the name is made by
 * portraits.js from the pack id and the picture's hash (letters, digits, dashes), which the server accepts as is.
 */
export function stPortraitFiles({ fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
    const ask = async (url, body) => {
        const ctx = context();
        if (typeof ctx?.getRequestHeaders !== 'function' || typeof fetchImpl !== 'function') throw new Error('SillyTavern is not available');
        return fetchImpl(url, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) });
    };
    return {
        async put(name, bytes) {
            const response = await ask('/api/files/upload', { name, data: base64Of(bytes) });
            if (!response?.ok) throw new Error(`the server answered ${response?.status ?? 'nothing'}`);
        },
        async remove(name) {
            const response = await ask('/api/files/delete', { path: `user/files/${name}` });
            if (!response?.ok && response?.status !== 404) throw new Error(`the server answered ${response?.status ?? 'nothing'}`);
        },
        async exists(names) {
            const response = await ask('/api/files/verify', { urls: names.map(name => `user/files/${name}`) });
            if (!response?.ok) throw new Error(`the server answered ${response?.status ?? 'nothing'}`);
            const found = await response.json();
            return Object.fromEntries(names.map(name => [name, found?.[`user/files/${name}`] !== false]));
        },
        url: name => `/user/files/${name}`,
    };
}
