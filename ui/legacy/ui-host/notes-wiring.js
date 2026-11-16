// Story Block v2's page furniture: the notes under replies, moved out of mountUi unchanged: Re-read when the runtime offers one, and whether the extractor is on
// or failed for a reply. `createNotesWiring(deps)` is given the runtime parts it reads and the mounts (a note's change redraws the changes card).
import { createReplyNotes } from '../reply-notes.js';
import { CORE_FEATURE } from '../../../core/features.js';

export function createNotesWiring({ runtime, ctx, doc, sdk, events, getMounts, onForget }) {
    const rereadFn = typeof sdk.reread === 'function' ? index => sdk.reread(index)
        : typeof runtime.turn?.reread === 'function' ? index => runtime.turn.reread(index) : null;
    const notes = createReplyNotes({
        ctx,
        doc,
        turn: runtime.turn ?? null,
        events,
        reread: rereadFn,
        extractorOn: () => {
            try { return typeof sdk.feature === 'function' ? sdk.feature(CORE_FEATURE.extractor) : sdk.settings('story-block')?.assistExtractor === true; } catch { return false; }
        },
        // The extractor ran on reply `index` (this swipe, this chat) and its call failed: the note shows.
        extractorFailed: (index, swipe) => {
            try {
                const chat = String(ctx.getCurrentChatId?.() ?? ctx.chatId ?? '');
                const runs = sdk.query('assist.status')?.runs ?? [];
                const last = runs.findLast(run => run?.helper === 'extractor' && run.index === index && run.swipe === swipe && (run.chat ?? '') === chat);
                return last?.outcome === 'failed' || last?.outcome === 'timeout';
            } catch { return false; }
        },
        onForget,
        onChanged: index => getMounts()?.card?.refresh?.(index, { force: true }),
    });
    return notes;
}
