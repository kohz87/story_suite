// Decodes sidecar JSON text to its payload, or reads only its head cheaply.
import { NPC_STATE_FILE_FORMAT, NPC_STATE_FILE_READ_VERSIONS } from './format.js';

export function decodeStateFilePayload(text) {
    let payload;
    try { payload = JSON.parse(String(text ?? '')); }
    catch { throw new Error('NPC State data file contains invalid JSON.'); }
    if (!payload || payload.format !== NPC_STATE_FILE_FORMAT) throw new Error('Not an NPC State chat data file.');
    if (!NPC_STATE_FILE_READ_VERSIONS.includes(payload.formatVersion)) {
        // A coded, non-retryable error: storage.js must not loop on a file a newer build wrote.
        throw Object.assign(new Error(`Unsupported NPC State data file version: ${payload.formatVersion} (saved by a newer NPC State; update the extension).`), { code: 'NPC_STATE_UNSUPPORTED_FORMAT' });
    }
    if (!payload.state || typeof payload.state !== 'object' || Array.isArray(payload.state)) throw new Error('NPC State data file is missing its state object.');
    // A format 2 file packed the branch journal's checkpoints (removed at B4-10a): its packing header and checkpoints are dropped unread.
    if (payload.formatVersion === 2) {
        delete payload.packing;
        delete payload.state.checkpoints;
    }
    payload.retired = payload.retired === true;
    payload.revision = Math.max(0, Math.trunc(Number(payload.revision) || 0));
    payload.writerId = String(payload.writerId || '');
    return payload;
}

// (inspection hot path) A boundary check wants only the revision, writer, chat key, time and retired flag. encodeStateFilePayload writes those
// scalar keys first and `state` last, and a quote inside a string value is always escaped, so the first `,"state":` is the real one: the head
// alone is parsed (a few hundred bytes) instead of the whole file (megabytes of portraits). Any file that does not look like that (older
// layout, pretty-printed, damaged) answers null and the caller decodes the whole file exactly as before. The state itself is not read here.
const HEAD_LIMIT = 4096;
export function decodeStateFileHead(text) {
    const raw = String(text ?? '');
    if (raw.charCodeAt(0) !== 123 || raw.charCodeAt(1) !== 34) return null;   // `{"`: compact JSON object
    const at = raw.indexOf(',"state":{');
    if (at < 1 || at > HEAD_LIMIT) return null;
    let head;
    try { head = JSON.parse(`${raw.slice(0, at)}}`); } catch { return null; }
    if (!head || head.format !== NPC_STATE_FILE_FORMAT || !NPC_STATE_FILE_READ_VERSIONS.includes(head.formatVersion)) return null;
    if (raw.charCodeAt(raw.length - 1) !== 125) return null;   // a cut-off file is decoded in full (and refused there)
    // A writer that adds `retired` after the state (another session's tool) is read by the full decode: one cheap scan, not a parse.
    if (raw.indexOf('"retired"', at) !== -1) return null;
    head.retired = head.retired === true;
    head.revision = Math.max(0, Math.trunc(Number(head.revision) || 0));
    head.writerId = String(head.writerId || '');
    return head;
}
