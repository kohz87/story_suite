// Uploads a JSON payload to the server's user-file endpoint and deletes a data file there.
import { bytesToBase64 } from '../storage-payload.js';

export async function uploadPayload({ name, json, fetchFn, headers }) {
    const data = bytesToBase64(new TextEncoder().encode(json));
    const response = await fetchFn('/api/files/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, data }),
    });
    if (!response?.ok) {
        const detail = typeof response?.text === 'function' ? await response.text() : '';
        const error = new Error(`NPC State Delta data file write failed${detail ? `: ${detail}` : ''}.`);
        error.status = Number(response?.status || 0);
        throw error;
    }
    const result = typeof response.json === 'function' ? await response.json() : {};
    if (!result?.path) throw new Error('NPC State Delta data-file endpoint returned no path.');
    return result;
}

export async function deleteNpcStateDataFile(pointer, { fetchFn = globalThis.fetch, headers = {} } = {}) {
    if (!pointer?.path) return false;
    if (typeof fetchFn !== 'function') throw new Error('fetch() is unavailable for NPC State Delta data-file persistence.');
    const response = await fetchFn('/api/files/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ path: pointer.path }),
    });
    if (response?.status === 404) return false;
    if (!response?.ok) {
        const detail = typeof response?.text === 'function' ? await response.text() : '';
        throw new Error(`NPC State Delta data file delete failed${detail ? `: ${detail}` : ''}.`);
    }
    return true;
}
