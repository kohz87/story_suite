// The chat frame (pack format 4, D12): the part that records, in a chat's own state, the world and game it began with and the calendar and currency of
// that game, so a game swapped in Settings later does not move the chat's dates and money. The frame is a deferred domain written by a `beforeGenerate`
// step, so a chat with no format 4 world or game selected has no trace of it. Readers: the query `packs.frame` (null when there is no frame).

import { initialFrame, validateFrame } from './frame-parts/shape.js';
import { resolveFrame, updateNote } from './frame-parts/resolve.js';
import { tellFrame, useFrame, writeFrame } from './frame-parts/commands.js';

/**
 * The frame part over the installed list (`packs/installed.js`). The hook writes the frame when the chat has none and a world or game is selected, or when
 * the reader asked for the current game; otherwise it only says, once, that a pack changed since the chat began.
 */
export function createFramePart({ installed }) {
    const beforeGenerate = (view, info = {}) => {
        if (info?.commit === false) return undefined;
        try { return step(view); } catch { return undefined; }
    };
    const step = view => {
        const frame = view?.state?.domains?.frame;
        if (frame?.set !== true || frame.refresh === true) {
            const next = resolveFrame(installed, { always: frame?.refresh === true });
            return next ? { commands: [{ type: 'packs.frame', payload: next }] } : undefined;
        }
        const note = updateNote(frame, installed);
        if (!note || note.key === frame.told) return undefined;
        return { commands: [{ type: 'packs.frameTold', payload: { key: note.key } }], problems: [{ code: 'PACK_CHANGED', message: note.message, quiet: true }] };
    };
    return {
        domains: { frame: { initial: initialFrame, deferred: true, snapshot: 'when-present', validate: validateFrame } },
        commands: { 'packs.frame': writeFrame, 'packs.frameTold': tellFrame, 'packs.frameUse': useFrame },
        queries: { 'packs.frame': state => (state?.domains?.frame?.set === true ? structuredClone(state.domains.frame) : null) },
        hooks: { beforeGenerate },
    };
}
