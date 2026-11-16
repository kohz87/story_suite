// Asks the server whether one data file, or several, exist, without fetching them.
// (beta) Whether a file exists, asked without fetching it (SillyTavern's /api/files/verify): true, false,
// or null when the server cannot say (no such route, an error, an answer of another shape); the caller
// then reads the file as before. A new chat has no data file yet, and fetching it only to be told so
// puts a red "404" in the browser console on every new chat.
export async function dataFileExists(path, { fetchFn = globalThis.fetch, headers = null } = {}) {
    if (!path || typeof fetchFn !== 'function' || !headers) return null;
    try {
        const response = await fetchFn('/api/files/verify', { method: 'POST', headers, body: JSON.stringify({ urls: [path] }) });
        if (!response?.ok || typeof response.json !== 'function') return null;
        const result = await response.json();
        const value = result && typeof result === 'object' ? result[path] : undefined;
        return typeof value === 'boolean' ? value : null;
    } catch {
        return null;
    }
}

// (cast portraits) Several files' existence in one request: { path: boolean }, or null when the server cannot say.
export async function dataFilesExist(paths, { fetchFn = globalThis.fetch, headers = null } = {}) {
    const list = [...new Set((paths || []).filter(Boolean))];
    if (!list.length || typeof fetchFn !== 'function' || !headers) return null;
    try {
        const response = await fetchFn('/api/files/verify', { method: 'POST', headers, body: JSON.stringify({ urls: list }) });
        if (!response?.ok || typeof response.json !== 'function') return null;
        const result = await response.json();
        if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
        return Object.fromEntries(list.filter(path => typeof result[path] === 'boolean').map(path => [path, result[path]]));
    } catch {
        return null;
    }
}
