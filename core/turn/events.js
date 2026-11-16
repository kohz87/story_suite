// Story Suite v2: the SillyTavern event handlers, moved out of createTurn unchanged: the reply received (its change lines read, captured and
// kept, then the afterReply / afterReceive hooks: events-hooks.js), the safety net's late and assist lines (events-late.js), a held fight reply (events-held.js), a chat opened, renamed or rewound (deleted messages,
// swipes, a deleted swipe), the generation stopped or ended, and install / uninstall of the interceptor and the listeners. `createEvents(s, deps)`
// is given the turn's state holder `s` and the turn parts it uses; it never imports turn.js.
import {
    adoptLegacy, continuation, cutLine, defangMarker, extractBlock, hideBlock, markOff,
} from '../capture.js';
import { cutAt } from '../text.js';
import { readRecord, swipeLoading } from '../persist.js';
import { within } from './text.js';
import { ensureModules } from '../sdk.js';
import { FIGHT_CLOSED, dropPrePortFight } from './pre-port-fight.js';
import { createHeldEvents } from './events-held.js';
import { rememberHeld as rememberInteractionHeld } from '../interaction/held.js';
import { settleStep } from '../interaction/watch.js';
import { createLateEvents } from './events-late.js';
import { createReplyHooks } from './events-hooks.js';
export function createEvents(s, deps) {
    const { ia, markIdle, clearPrompts, ctx, metadata = () => ctx?.chatMetadata, isCarrier, store, ensureInitial, problem, notify, stopChangedBoard, interactionError, reconcileScratch = () => {}, changeHeads, readBlock, strayProblems, legacyProblem, lateLines, captureLines, withCaps, timeline, trySave, saveText, redraw, events, registry, view, prepare, RPG_LOAD_WAIT_MS, rebuild, bus, hasCarrier, reconcileNow, REBUILD_REASONS, INTERCEPTOR_NAME, V1_KEYS, setPrompt, interceptor, onGenerationStarted, onPromptReady, onTextPromptReady, getApi, isolated = () => false } = deps;
    const { resumeHeldBoard, restoreHeldBoard } = createHeldEvents(s, { ctx, metadata, store, problem, interactionError, getOnMessageReceived: () => onMessageReceived });
    const { captureLate } = createLateEvents(s, { ctx, isCarrier, store, problem, changeHeads, readBlock, lateLines, captureLines, withCaps, trySave, saveText, redraw, events, registry, bus });
    const { afterReply, receivedHooks } = createReplyHooks(s, { ia, store, problem, events, registry, view, captureLate });

    /** MESSAGE_RECEIVED: (messageId, type). */
    async function onMessageReceived(messageId) {
        const id = Number(messageId);
        const current = s.session;
        if (!current || !Number.isInteger(id) || id !== current.index) return null;
        s.heldBoard = null;
        s.session = null;
        markIdle();
        clearPrompts();
        const message = ctx?.chat?.[id];
        if (!isCarrier(message)) return null;
        const idle = store.saveIdle?.() === true;   // (the turn's save window opens now: the capture's lines are not saved one by one)
        try {
            if (store.headIndex() !== id) store.rebuild();
            ensureInitial();
            if (store.headIndex() !== id) {
                problem({ index: id, code: 'FAILED', message: 'The reply is not the last message that keeps the story, so its changes were not read.' });
                return null;
            }
            const written = String(message.mes ?? '');
            // A Continue: SillyTavern wrote the old text again, cleaned up, so it can be shorter than it
            // was; where the added text starts is found, not counted, or its block is left bare.
            const at = typeof current.base === 'string' ? continuation(current.base, written) : null;
            // C2-7: a copy of the hidden comment's marker the model wrote itself is defanged first, so the
            // reply is read live as Re-read will read the saved message.
            // A v1 envelope (capture.js adoptLegacy): read as the reply's block when it has none, else taken out unread.
            const adopted = adoptLegacy(defangMarker(written, at?.from ?? 0), { at });
            const text = adopted.text;
            let edited = false;
            if (text !== written) {
                message.mes = text;
                if (Array.isArray(message.swipes) && Number.isInteger(message.swipe_id)) message.swipes[message.swipe_id] = text;
                edited = true;
            }
            // The reader stopped it (GENERATION_STOPPED): an open block's unfinished last line is left out.
            const stopped = current.stopped === true;
            // Change lines written in the story near the block are read with it (capture.js strayLines).
            const heads = changeHeads();
            const block = extractBlock(text, 'Changes', at, { stopped, heads });
            const parsed = block === null ? { lines: [], problems: [] } : readBlock(id, block, { fresh: current.type !== 'continue' });
            const problems = [...parsed.problems, ...strayProblems(id, text, heads, { from: at?.from ?? 0, tail: at?.tail === true, stopped }, parsed.lines.map(line => line.raw))];
            if (adopted.legacy === 'read') problems.push(legacyProblem(id));
            const cut = block === null ? null : cutLine(text, 'Changes', at);
            if (cut) problems.push(problem({ index: id, line: cut, code: 'CUT_OFF', message: `The reply ended in the middle of the change line "${cutAt(cut, 80)}" (nothing after it on its line, and the block was not closed), so it was not used. Continue finishes it; or end the line and close the block by hand, then Re-read.` }));
            // The previous reply's safety-net lines that came after the reader sent (not for a Continue).
            const late = current.type === 'continue' ? [] : lateLines(id, parsed.lines.map(line => line.raw));
            const result = await captureLines(id, parsed.lines, at ? current.base : null, current.type, { late, prechecks: current.prechecks });
            problems.push(...result.problems);
            receivedHooks(id, current.type);

            // What this reply was told; a Continue keeps what the reply was told before.
            // (B-b2-timeline-9: read through readRecord, and only receipt IDs, whatever the chat holds.)
            const told = current.type === 'continue' ? readRecord(message)?.narrated ?? [] : [];
            const before = told.filter(id => typeof id === 'string');
            store.setNarrated(id, [...new Set([...before, ...current.untold, ...result.steps.filter(receipt => receipt.beforeGenerate === true).map(receipt => receipt.id)])], { reply: !(current.type === 'swipe' && id === 0) });   // (a swipe of the opening greeting is still a greeting)

            // Also with no block: the change lines left in the story are listed in the hidden comment, so a
            // Re-read leaves them too (B-a1-3, B-a1-10).
            let hidden = hideBlock(message.mes, 'Changes', { ...(at ?? {}), stopped, heads, legacy: adopted.legacy === 'read' });
            if (result.off.length) hidden = markOff(hidden, result.off, at?.from ?? 0);
            hidden = withCaps(hidden, at?.from ?? 0);
            if (hidden !== message.mes) {
                message.mes = hidden;
                if (Array.isArray(message.swipes) && Number.isInteger(message.swipe_id)) message.swipes[message.swipe_id] = hidden;
                edited = true;
            }
            if (timeline?.needsRecovery()) {
                const anchored = await timeline.recover();
                if (!anchored.ok && !anchored.blockedBy) problem({ index: id, code: anchored.code, message: anchored.message });
            }
            s.deferred = false;
            // One write for the reply, its capture and the reader's actions after it (store.saveIdle).
            if (idle && store.dirty()) store.saveIdle();
            else if (store.dirty()) await trySave('after the reply');
            else if (edited) await saveText();
            // At MESSAGE_RECEIVED SillyTavern has not drawn the reply yet (it draws the text as saved), so
            // redrawing can fail; that is not a reason to lose the turn.
            if (edited) redraw(id, message);
            const turn = { index: id, type: current.type, receipts: result.receipts, steps: result.steps, problems, told: current.untold };
            events?.emit('turn', turn);
            afterReply(id, current.type, message, [...parsed.lines, ...late].map(line => line.raw));
            return turn;
        } catch (error) {
            const failure = problem({ index: id, code: 'FAILED', message: `The reply's changes could not be kept: ${error?.message ?? error}` });
            if (error?.code === 'INTERACTION_PRELUDE') {
                // The same hold for an interaction reply: kept uncaptured until what its settle read is restored, or discarded.
                const payload = settleStep(current).payload, staged = metadata()?.storySuiteInteraction?.open?.id === payload.id;
                s.session = current;
                s.heldBoard = { index: id, message, current, interaction: payload, hold: error.message, staged };
                if (!readRecord(message)) store.setNarrated(id, []);
                if (rememberInteractionHeld(metadata(), store.carrierSid(id), current, staged)) {
                    store.touch?.();
                    await trySave('after holding the interaction');
                }
                try { notify?.(error.message, 'story-block'); } catch { /* the problem remains visible */ }
            } else if (isolated() === true) {
                // Flag `suite.isolatedApply`: the reply's lines were not kept, but the other modules still learn it arrived and the card says why.
                try { receivedHooks(id, current.type); } catch { /* each hook is already guarded */ }
                try { events?.emit('turn', { index: id, type: current.type, receipts: [], steps: [], problems: [failure], told: [] }); } catch { /* a listener's failure is its own */ }
                try { afterReply(id, current.type, message, []); } catch { /* each hook is already guarded */ }
            }
            return null;
        }
    }

    /** CHAT_CHANGED: a new chat (or the same one reloaded). */
    async function onChatChanged() {
        // The old chat's session and prompts go at once, before anything is awaited: a generation started while the RPG's code loads is the new chat's.
        s.session = null;
        s.heldBoard = null;
        s.quiets = [];
        markIdle();
        clearPrompts();
        // The RPG's code, when this chat needs it (the feature is on, or it holds the RPG's records), before anything is replayed (rpg-lazy.js); a stalled
        // import is waited for only RPG_LOAD_WAIT_MS (the guard mark then says the code is missing, so a later load makes the chat look again).
        if (typeof prepare === 'function') { try { await within(prepare(), RPG_LOAD_WAIT_MS); } catch { /* the loader reports its own failure */ } }
        rebuild({ publish: false });
        const meta = metadata();
        // A fight left open by a build from before the port is closed (turn/pre-port-fight.js); the interaction scratch follows the head by itself (reconcileScratch).
        const closed = dropPrePortFight(meta);
        if (closed !== null) {
            if (closed) problem({ code: 'FIGHT_CLOSED', quiet: true, message: FIGHT_CLOSED });
            try { (ctx.saveMetadata ?? ctx.saveMetadataDebounced)?.call(ctx); } catch { /* saved on the next chat write */ }
        }
        timeline?.settle();
        // A1-2: read-backs of a write that timed out before a reload of the page go on.
        try { store.resume?.(); } catch { /* only a guard */ }
        // A cue left for the reply's save (runCues) whose reply will not come here: saved now (the store's rescue, into its own chat's file).
        if (s.deferred) {
            s.deferred = false;
            if (store.dirty?.()) store.scheduleSave?.();
        }
        await ensureModules({ store, bus, registry, events });
        restoreHeldBoard();
        events?.emit('head', { index: store.headIndex(), reason: 'chat' });
    }

    /**
     * A reader's action in a chat that has a message but no state yet (sdk.command): the state starts on its first carrier now, as
     * onChatChanged would. SillyTavern shows a new chat's greeting before it tells of the chat (CHAT_CHANGED comes after its save, and
     * after every listener ahead of Story Block's), and a message added with no event Story Block reads (/sendas into an empty chat)
     * starts nothing. No open chat, or no carrier: nothing to start. → true when the chat has a state.
     */
    function seed() {
        if (store.head()) return true;
        // The libraries a chat needs come first, as for CHAT_CHANGED; only when one is on its way is a promise returned (→ Promise<boolean>), else the answer is at once.
        let waiting;
        if (typeof prepare === 'function') { try { waiting = prepare(); } catch { waiting = undefined; } }
        return waiting ? within(waiting, RPG_LOAD_WAIT_MS).then(seedNow, seedNow) : seedNow();
    }
    function seedNow() {
        if (store.head()) return true;
        let open = true;
        try { open = typeof ctx?.getCurrentChatId !== 'function' || !!ctx.getCurrentChatId(); } catch { open = true; }
        if (!open || !hasCarrier()) return false;
        rebuild();
        return !!store.head();
    }

    /**
     * CHAT_RENAMED: { oldFileName, newFileName } (file names with ".jsonl"). SillyTavern 1.19 renames the
     * file, reads the open chat back (CHAT_CHANGED), then tells this; a change not saved yet goes into the
     * renamed file (store.renamed, B-b2-timeline-r2-2). The server may clean the new name up (characters
     * it does not allow in a file name); when the open chat's ID is that name cleaned up, it is the one.
     */
    function onChatRenamed(data) {
        const name = value => String(value ?? '').trim().replace(/\.jsonl$/i, '');
        const from = name(data?.oldFileName);
        let to = name(data?.newFileName);
        if (!from || !to) return false;
        let open = null;
        try { open = typeof ctx?.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : null; } catch { open = null; }
        const loose = id => String(id).replace(/[\/?<>\\:*|"\u0000-\u001f\u0080-\u009f]/g, '').replace(/[. ]+$/, '');
        if (typeof open === 'string' && open && open !== from && open !== to && loose(open) === loose(to)) to = open;
        return store.renamed?.(from, to) ?? false;
    }

    /**
     * Deleted messages, swipes, a greeting picked: the state is rebuilt from what is stored. `reason` ('delete', 'swipe',
     * 'edit'; anything else is none) rides on the head event for the public API's `story:rebuilt`.
     */
    async function onTimelineChanged(reason) {
        if (typeof prepare === 'function') { try { await within(prepare({ scan: false }), RPG_LOAD_WAIT_MS); } catch { /* the loader reports its own failure */ } }
        rebuild({ publish: false });
        resumeHeldBoard();
        restoreHeldBoard();
        const carry = timeline?.carryBoundaries?.();
        reconcileNow();
        carry?.();
        timeline?.settle();
        if (timeline?.needsRecovery()) await timeline.recover();
        // one head, after the steps that follow the change are planned again
        events?.emit('head', { index: store.headIndex(), ...(REBUILD_REASONS.has(reason) ? { reason } : {}) });
    }

    /**
     * A deleted swipe. SillyTavern tells of the deletion of the swipe being shown before it shows the next one (`extra` is
     * still the deleted swipe's; MESSAGE_SWIPED follows). The shown swipe is told by whose record it holds, not by its text
     * (persist.js swipeLoading): while it is in flux nothing is rebuilt, restamped, reconciled or published, so no record is
     * written and no head is told of; the swipe load that follows does all of it once. Any other swipe deletion is a
     * change on its own.
     */
    function onSwipeDeleted(detail) {
        const live = ctx?.chat ?? [];
        const at = Number.isInteger(detail) ? detail : detail?.messageId;
        const message = live[Number.isInteger(at) ? at : live.length - 1];
        const deleted = Number.isInteger(detail?.swipeId) ? detail.swipeId : null;
        if (swipeLoading(message, deleted)) return;
        return onTimelineChanged('delete');
    }

    /** GENERATION_STOPPED: the reader stopped the reply being written (its last line may be unfinished). */
    function onGenerationStopped() {
        if (s.session) s.session.stopped = true;
        onGenerationEnded();
    }

    /** GENERATION_ENDED / GENERATION_STOPPED: a spent note never reaches a later prompt. */
    function onGenerationEnded() {
        if (s.session?.prompted) clearPrompts();
        s.deferred = false;
        markIdle();
        // A save that failed and was not made good after the reply (or the reply never came): again soon.
        if (store.dirty()) store.scheduleSave();
    }

    function install({ globalName = INTERCEPTOR_NAME } = {}) {
        for (const [key, place] of V1_KEYS) setPrompt(key, '', place);
        clearPrompts();
        if (globalName) globalThis[globalName] = interceptor;
        // A module turned ready or dormant: guarded blocks of its are asked again (store.lifecycleChanged).
        s.offModules?.();
        // (only the restore barrier going up or down: the memos kept under the mark come back, the guards are not asked again for nothing)
        const barrierOnly = changes => Array.isArray(changes) && changes.length > 0 && changes.every(c => c?.status === 'restore-pending' || (c?.from === 'restore-pending' && c?.status === 'ready'));
        s.offModules = events?.on?.('modules', info => {
            if (store.lifecycleChanged?.({ barrier: barrierOnly(info?.changes) })) events?.emit('head', { index: store.headIndex(), reason: 'module' });
        }) ?? null;
        for (const off of s.offBoard) off();
        s.offBoard = ['committed', 'head'].flatMap(name => [events?.on?.(name, stopChangedBoard), events?.on?.(name, resumeHeldBoard)]).filter(Boolean);
        // The unsent interaction scratch follows every head move (a rewind or a restore announces only this event).
        const offScratch = events?.on?.('head', reconcileScratch);
        if (offScratch) s.offBoard.push(offScratch);
        const source = ctx?.eventSource;
        const names = ctx?.eventTypes ?? ctx?.event_types ?? {};
        const on = (event, fn) => {
            if (!event || typeof source?.on !== 'function') return;
            source.on(event, fn);
            s.listeners.push([event, fn]);
        };
        on(names.GENERATION_STARTED, onGenerationStarted);
        on(names.CHAT_COMPLETION_PROMPT_READY, onPromptReady);
        on(names.GENERATE_AFTER_COMBINE_PROMPTS, onTextPromptReady);
        on(names.MESSAGE_RECEIVED, onMessageReceived);
        on(names.GENERATION_ENDED, onGenerationEnded);
        on(names.GENERATION_STOPPED, onGenerationStopped);
        on(names.CHAT_CHANGED, onChatChanged);
        on(names.CHAT_RENAMED, onChatRenamed);
        // MESSAGE_EDITED too: a record's swipe mark follows an edit (persist.js restamp), so a Continue
        // after it still finds the record.
        for (const [event, reason] of [[names.MESSAGE_DELETED, 'delete'], [names.MESSAGE_SWIPED, 'swipe'], [names.CHARACTER_FIRST_MESSAGE_SELECTED, 'swipe'], [names.MESSAGE_EDITED, 'edit']]) on(event, () => onTimelineChanged(reason));
        on(names.MESSAGE_SWIPE_DELETED, onSwipeDeleted);
        return getApi();
    }

    function uninstall({ globalName = INTERCEPTOR_NAME } = {}) {
        s.offModules?.();
        s.offModules = null;
        for (const off of s.offBoard) off();
        s.offBoard = [];
        const source = ctx?.eventSource;
        for (const [event, fn] of s.listeners) (source?.removeListener ?? source?.off)?.call(source, event, fn);
        s.listeners = [];
        if (globalName && globalThis[globalName] === interceptor) delete globalThis[globalName];
        clearPrompts();
        markIdle();
    }

    return { install, uninstall, onMessageReceived, onChatChanged, seed, onChatRenamed, onTimelineChanged, onGenerationEnded };
}
