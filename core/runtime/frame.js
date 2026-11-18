// The chat frame (pack format 4, D12): the part that records, in a chat's own state, the world and game it began with and the calendar and currency of
// that game, so a game swapped or installed in Settings later does not move the chat's dates and money. The frame is a deferred domain written by a
// `beforeGenerate` step at the chat's first reply with a world or game selected; a chat that had begun before one was selected records the built-in game.
// Readers: the query `packs.frame` (null while there is none: the chat reads the built-in game live).

import { initialFrame, validateFrame } from './frame-parts/shape.js';
import { resolveFrame, selectedPair, updateNote } from './frame-parts/resolve.js';
import { pairLines } from './frame-parts/pair-lines.js';
import { tellFrame, useFrame, writeFrame } from './frame-parts/commands.js';

/**
 * The frame part over the installed list (`packs/installed.js`). The hook writes the frame when the chat has none and a world or game is selected (with the
 * Problems lines of the pair it begins with: pair-lines.js; the built-in game's frame for a chat that had begun), or when the reader asked for the current
 * game; otherwise it only says, once, that a pack changed since the chat began.
 */
const BUILT_IN = Object.freeze({ world: null, game: 'built-in', calendar: null, currency: null });

export function createFramePart({ installed, chatId = () => '' }) {
    // The update notes given in this session, by the chat and the frame they were about: the "told" mark is kept on the reply the note came with, so a swipe of
    // that reply takes it away; this keeps the note from coming again with every swipe (a reload may give it once more). Each chat has its own.
    const toldNow = new Set();
    const beforeGenerate = (view, info = {}) => {
        if (info?.commit === false) return undefined;
        try { return step(view); } catch { return undefined; }
    };
    const step = view => {
        const frame = view?.state?.domains?.frame;
        if (frame?.set !== true || frame.refresh === true) {
            const next = resolveFrame(installed);
            // Nothing selected: the chat runs on the built-in game live, and no frame is written (a chat with no world or game is byte for byte as before).
            if (!next || (next.world === null && next.game === 'built-in' && frame?.refresh !== true)) return undefined;
            // A chat that began before anything was selected (the reader has written more than this one message) began with the built-in game: that is
            // its frame, so a world or game installed since moves nothing in it. A new chat takes the selection at its start.
            if (frame?.set !== true && (view?.chat?.readers ?? 0) > 1) return { commands: [{ type: 'packs.frame', payload: BUILT_IN }] };
            const problems = frame?.set === true ? [] : pairLines(installed, selectedPair(installed));
            return { commands: [{ type: 'packs.frame', payload: next }], ...(problems.length ? { problems } : {}) };
        }
        const note = updateNote(frame, installed);
        if (!note || note.key === frame.told) return undefined;
        const seen = `${chatId()}|${frame.world?.hash ?? ''}|${frame.game?.hash ?? frame.game}|${note.key}`;
        if (toldNow.has(seen)) return undefined;
        toldNow.add(seen);
        return { commands: [{ type: 'packs.frameTold', payload: { key: note.key } }], problems: [{ code: 'PACK_CHANGED', message: note.message, quiet: true }] };
    };
    return {
        domains: { frame: { initial: initialFrame, deferred: true, snapshot: 'when-present', validate: validateFrame } },
        commands: { 'packs.frame': writeFrame, 'packs.frameTold': tellFrame, 'packs.frameUse': useFrame },
        queries: { 'packs.frame': state => (state?.domains?.frame?.set === true ? structuredClone(state.domains.frame) : null) },
        hooks: { beforeGenerate },
    };
}
