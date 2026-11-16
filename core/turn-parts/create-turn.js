// The turn's wiring (docs/v2/SPEC.md §4, §5): createTurn joins the SillyTavern context, the host parts and the turn's parts into one api.

import { PRECHECK } from '../../modules/assist/classifier.js';
import { makeView } from '../sdk.js';
import { SLOT_NUMBER } from '../runtime/skill-slots.js';
import { FLAGS, flagOn } from '../runtime/flags.js';
import { contentText, contextRoom } from '../turn/text.js';
import { createSession } from '../turn/session.js';
import { createCaptureFlow } from '../turn/capture-flow.js';
import { createReread } from '../turn/reread.js';
import { createPromptBuild } from '../turn/prompt-build.js';
import { createPromptHooks } from '../turn/prompt-hooks.js';
import { createEvents } from '../turn/events.js';
import { createBoardWatch } from '../turn/board-watch.js';
import { createInteractionWatch } from '../interaction/watch.js';
import { createInteractionHooks } from '../interaction/hooks.js';
import { reconcileInteraction } from '../interaction/reconcile.js';
import { pendingStart as pendingInteractionStart } from '../interaction/start.js';
import { pendingStart } from '../turn/fight-start.js';
import { STATIC_KEY, TAIL_KEY, V1_KEYS, INTERCEPTOR_NAME } from './keys.js';
import { FOREGROUND, OWN_PROMPT_PARTS, OWN_PROMPT_CHARS, normalizeType } from './prompt-limits.js';
import { HOOK_TIMEOUT_MS, hookTimeout } from './hook-time.js';
import { REPLY_BUSY_MAX_MS, ASSIST_WAIT_MS, RPG_LOAD_WAIT_MS } from './waits.js';

// A story line that practises a skill (`practice-N`, data-modules/part.js): the lines a reply is marked for (see captureEach).
const PRACTICE_LINE = new RegExp(`\\|\\s*kind\\s*:\\s*practice-${SLOT_NUMBER}\\b`, 'iu');

// SillyTavern's extension_prompt_types and extension_prompt_roles, when the context lacks them.
const IN_PROMPT = 0;
const IN_CHAT = 1;
const ROLE_SYSTEM = 0;
const MAX_PROBLEMS = 200;
// Stripped history texts kept between prompts (each is read again for every later prompt).
const STRIP_CACHE = 500;
const HAS_BLOCK = /<changes/i;
// Story Block v1's envelope (capture.js adoptLegacy): never sent to the model. In a text completion prompt only a closed
// one, and never across another comment's start, so one left open cannot take the rest of the prompt with it.
const HAS_LEGACY = /<!--\s*(?:STORY_BLOCKS_V1|INVENTORY_BLOCK_V05)/i;
const LEGACY_IN_PROMPT = /\s*<!--\s*(?:STORY_BLOCKS_V1_CUT|STORY_BLOCKS_V1|INVENTORY_BLOCK_V05)\b(?:(?!<!--)[\s\S])*?-->/gi;

const defaultNotify = reason => globalThis.toastr?.warning?.(reason, 'Story Suite');

// Why the state was rebuilt, as the head event tells it (the public API's `story:rebuilt`; 'edit' is not announced).
const REBUILD_REASONS = new Set(['delete', 'swipe', 'edit']);

const holdsIn = chat => mark => chat.some(message => contentText(message?.content).includes(mark));
const isCarrier = message => Boolean(message) && !message.is_user;

/**
 * Wires one SillyTavern context. `deps`: { ctx, live?() (SillyTavern's live context, for its API settings;
 * default ctx), store, bus, registry, settings, events?,
 * onBlocked?(reason, moduleId), notify?(reason, moduleId) (default: a toastr warning),
 * initial?() → the initial State for a chat with none (default registry.initialState(); the host
 * adds the packs' start, SPEC §2.6), ownPrompt?(eventData) → true for the prompt of Story Suite's own model
 * call on the chat's connection (model-call.js createOwnCalls().owns): never taken for the reply's }.
 * `settings` is createSettings() (settings() → host settings, settings(id) → a module's).
 * Returns { interceptor, install, uninstall, onGenerationStarted, onPromptReady, onTextPromptReady, onMessageReceived,
 * onChatChanged, seed, onChatRenamed, onTimelineChanged, onGenerationEnded, preview, report, problems, clearProblems, blocked, blockers, unblock,
 * session, replyBusy, whenIdle }.
 */
export function createTurn({ ctx, live = () => ctx, store, bus, registry, settings, events = null, onBlocked = null, notify = defaultNotify, initial = () => registry.initialState(), ownPrompt = () => false, timeline = null, prepare = null }) {
    const types = () => ctx?.extension_prompt_types ?? ctx?.extensionPromptTypes ?? {};
    const roles = () => ctx?.extension_prompt_roles ?? ctx?.extensionPromptRoles ?? {};
    const position = place => (place === 'static' ? types().IN_PROMPT ?? IN_PROMPT : types().IN_CHAT ?? IN_CHAT);
    // Flag `suite.isolatedApply` (read at each use): a hook's own problems are kept, and a failed reply still tells the other modules.
    const isolated = () => flagOn(() => ctx?.extensionSettings, FLAGS.isolatedApply);
    const hostSettings = () => (typeof settings === 'function' ? settings() : settings ?? {});
    // Story Block's readers of earlier messages that this turn owns, each asked for by name from the timeline's active-history filter
    // (timeline/active.js): messages a restore faded are not a module's last reader message nor a source of late lines. (A request is not
    // filtered here: SillyTavern leaves the hidden messages out of it, and a restore hides what it faded.) A host without a timeline has none.
    const reader = name => (typeof timeline?.active === 'function' ? timeline.active(name) : null);
    const lateReader = reader('assist.late');
    const viewReader = reader('view.lastUser');
    const s = {
        session: null,
        boardCapture: null,
        heldBoard: null,
        abortBoard: null,
        deferred: false,   // cues committed before a reply, left for the reply's save (runCues)
        listeners: [],
        problemLog: [],
        blocks: [],
        lastSize: null,   // the context size the last interceptor call was handed
        // Quiet generations told by GENERATION_STARTED: { mark, claimed (its interceptor ran, at this time) }, oldest first.
        quiets: [],
        // What the two slots hold now (setPrompts).
        slots: { staticText: '', tailText: '' },
        toldSmall: new Set(),   // chats whose reader was told the context is too small
        // A reply in progress: from its interceptor until it is received, ended, stopped or held back (or the
        // chat changes). Story Suite's own model calls on the chat's connection wait for it (whenIdle).
        replyBusy: false,
        // The Assist safety net's runs on the last reply (afterReply), until they settle.
        assistPending: null,
        busyTimer: null,
        idleWaiters: [],
        // Every earlier reply is in every prompt: what its text is without blocks is remembered, and a
        // text with no "<changes" in it at all is passed by without reading it further.
        stripped: new Map(),
        offModules: null,
        offBoard: [],
    };
    const liveContext = () => {
        try { return live() ?? ctx; } catch { return ctx; }
    };
    const metadata = () => liveContext()?.chatMetadata ?? null;
    const contextNow = () => contextRoom(liveContext(), s.lastSize);
    const whenIdle = () => (s.replyBusy ? new Promise(resolve => s.idleWaiters.push(resolve)) : Promise.resolve());
    // Our own model call's prompt (model-call.js) is never the reply's.
    const isOwn = eventData => {
        try { return ownPrompt(eventData) === true; } catch { return false; }
    };

    const view = () => makeView({ store, registry, settings, chat: ctx?.chat, active: viewReader });
    const hasCarrier = () => (ctx?.chat ?? []).some(isCarrier);
    const lastCarrier = () => (ctx?.chat ?? []).findLastIndex(isCarrier);

    // The commands run as preludes: Assist's pre-roll, and any command a module marks `prelude` (registry.isPrelude).
    const isPrelude = type => type === PRECHECK || registry.isPrelude?.(type) === true;

    const refusal = (code, message) => ({ ok: false, code, message });

    // Session housekeeping and Re-read (turn/session.js, turn/reread.js): wired here, after every const they are given.
    const kindOf = id => registry.interaction?.(id) ?? null;
    // The unsent interaction scratch in chat metadata follows every head move (interaction/reconcile.js); a chat that never used one has none and nothing happens.
    const reconcileScratch = () => {
        let changed = false;
        try { changed = reconcileInteraction(metadata(), ctx?.chat, () => store.receipts?.() ?? [], { kindOf: id => registry.interaction?.(id) ?? null, stateAt: index => store.at(index) }); } catch { changed = false; }
        if (changed) { try { (ctx?.saveMetadata ?? ctx?.saveMetadataDebounced)?.call(ctx); } catch { /* saved on the next chat write */ } }
    };
    const { markBusy, markIdle, setPrompt, setPrompts, clearPrompts, problem, trySave, ensureInitial, held, repairActions, repair, startOver, rebuild, planAgain, reconcileNow } = createSession(s, { ctx, store, bus, events, notify, initial, position, roles, hasCarrier, refusal, reconcileScratch, kindOf, STATIC_KEY, TAIL_KEY, REPLY_BUSY_MAX_MS, MAX_PROBLEMS, ROLE_SYSTEM });
    // One commit guard and one stop for what a reply in flight read: the fight board's (still the planner's rpg.resolve) and an interaction's.
    // The state a kind's opening prelude leaves (a preview: nothing is stored), which the segment after it is checked and played on.
    const previewOpening = (payload, seed, state) => { const run = bus.run('interaction.settle', payload, { cause: 'system', state, seed }); return run?.ok ? run.state : null; };
    // The core's hooks for a reply with an interaction (canGenerate, beforeGenerate, afterReceive): called by the turn itself, so they are no part of any module's hook lists.
    const ia = createInteractionHooks({ chat: () => ctx?.chat ?? [], metadata, kindOf, preview: previewOpening });
    const { boardError, boardCommitCheck, stopChangedBoard: stopBoard } = createBoardWatch(s, { bus, store, problem, notify });
    const watch = createInteractionWatch(s, { store, problem, notify, kindOf, preview: previewOpening, featureOn: id => registry.featureOn?.(id) !== false });
    bus.setCommitGuard?.((next, receipt) => boardCommitCheck(next, receipt) ?? watch.commitCheck(next, receipt));
    const stopChangedBoard = () => { stopBoard(); watch.stopChanged(); };
    const interactionError = watch.errorOf;
    // The capture flow (turn/capture-flow.js): wired here, after the session's `problem` it is given and before the Re-read that calls it.
    const { changeHeads, readBlock, strayProblems, legacyProblem, capped, assistRoom, lateLines, nowLines, captureLines, afterCapture, stepSeeds, captureEach, storySeeds, heldInReply, withCaps, LATE, NOW } = createCaptureFlow(s, { ctx, store, bus, registry, settings, events, hostSettings, view, viewReader, lateReader, problem, isCarrier, boardError, PRACTICE_LINE, HOOK_TIMEOUT_MS, isolated, interactionError });
    const { reread, saveText, redraw } = createReread(s, { ctx, metadata, store, events, timeline, refusal, changeHeads, readBlock, strayProblems, capped, lateLines, assistRoom, nowLines, heldInReply, legacyProblem, storySeeds, afterCapture, captureEach, stepSeeds, withCaps, isPrelude, LATE, NOW, planAgain, problem, trySave });

    // The prompt side of a turn (turn/prompt-build.js, turn/prompt-hooks.js): wired here, after every const they are given. The interceptor asks for claimQuiet only when it runs.
    const { runCues, build, askCanGenerate, runOnBlocked, interceptor, markers, stripHistory, backgroundPrompt, foreignPrompt } = createPromptBuild(s, { ia, ctx, metadata, store, bus, registry, settings, events, timeline, onBlocked, notify, initial, prepare, hostSettings, viewReader, view, contextNow, hasCarrier, lastCarrier, isPrelude, markBusy, markIdle, setPrompts, clearPrompts, problem, trySave, held, claimQuiet: () => claimQuiet(), FOREGROUND, HOOK_TIMEOUT_MS, ASSIST_WAIT_MS, RPG_LOAD_WAIT_MS, OWN_PROMPT_PARTS, OWN_PROMPT_CHARS, STRIP_CACHE, HAS_BLOCK, HAS_LEGACY, hookTimeout, normalizeType });
    const { onGenerationStarted, claimQuiet, onPromptReady, onTextPromptReady } = createPromptHooks(s, { ctx, isOwn, markers, stripHistory, backgroundPrompt, foreignPrompt, HAS_LEGACY, LEGACY_IN_PROMPT, holdsIn, normalizeType });

    // The SillyTavern event handlers (turn/events.js): wired here, after every part they are given. `getApi` is read only when install runs, after the api below exists.
    const { install, uninstall, onMessageReceived, onChatChanged, seed, onChatRenamed, onTimelineChanged, onGenerationEnded } = createEvents(s, { ia, markIdle, clearPrompts, ctx, metadata, isCarrier, store, ensureInitial, problem, notify, stopChangedBoard, boardError, interactionError, reconcileScratch, changeHeads, readBlock, strayProblems, legacyProblem, lateLines, captureLines, withCaps, timeline, trySave, saveText, redraw, events, registry, view, prepare, RPG_LOAD_WAIT_MS, rebuild, bus, hasCarrier, reconcileNow, REBUILD_REASONS, INTERCEPTOR_NAME, V1_KEYS, setPrompt, interceptor, onGenerationStarted, onPromptReady, onTextPromptReady, getApi: () => api, isolated });

    const api = {
        repairActions,
        repair,
        startOver,
        interceptor,
        install,
        uninstall,
        onGenerationStarted,
        onPromptReady,
        onTextPromptReady,
        onMessageReceived,
        onChatChanged,
        seed,
        onChatRenamed,
        onTimelineChanged,
        onGenerationEnded,
        reread,
        /** What the next ordinary reply would be sent, without changing anything (no cues run). */
        preview: () => build().parts,
        /**
         * The same with how it fits the context and what modules send on their own: { parts, fit, own }
         * (fit: prompt.js contextFit, or null; own: [{ module, label, place: 'own', text, tokens }]).
         */
        previewFit: () => {
            const built = build();
            return { parts: built.parts, fit: built.fit, own: built.own };
        },
        /** Adds { module?, code?, message, index?, line? } to the Problems list (and the console). */
        // (`toast`: told at once too, not only listed)
        report: entry => {
            const item = problem(entry);
            if (entry?.toast === true) { try { notify?.(item.message, item.module); } catch { /* a missing toastr is not an error */ } }
            return item;
        },
        /** The Problems list, oldest first; `moduleId` narrows it (null: the host's own). */
        problems: moduleId => s.problemLog.filter(item => moduleId === undefined || item.module === moduleId).map(item => ({ ...item })),
        clearProblems: () => { s.problemLog.length = 0; },
        /** Generations a canGenerate hook stopped: [{ moduleId, reason }], oldest first. */
        blocked: () => s.blocks.map(item => ({ ...item })),
        /**
         * Every module holding the story back now (each canGenerate asked, none logged):
         * Promise<[{ moduleId, name, reason, action, canOpen }]> (`action`: the module's button words, '' for
         * the host's own, false for no button; `canOpen`: it has an onBlocked hook to run).
         */
        blockers: () => askCanGenerate({ all: true }),
        /** Runs module `moduleId`'s onBlocked(reason, moduleId) hook (Home's button). → true when it ran. */
        unblock: (moduleId, reason = '') => runOnBlocked(moduleId, reason),
        /** The pending reply's session (for status and tests), or null. */
        session: () => (s.session ? { ...s.session } : null),
        /** The held opening's private sheet, recreated with its saved seed. */
        fightStartPreview: () => {
            const pending = pendingStart(metadata(), ctx?.chat);
            if (!pending?.opening) return null;
            const preview = bus.run('rpg.resolve', pending.opening.payload, { cause: 'system', seed: pending.opening.seed });
            return preview?.ok ? { state: preview.state, result: preview.receipt?.data?.v2?.result } : null;
        },
        /** The held interaction opening's private state, recreated with its saved seed (null when none waits or it has no opening). */
        interactionStartPreview: () => {
            const pending = pendingInteractionStart(metadata(), ctx?.chat);
            if (!pending?.opening) return null;
            const preview = bus.run('interaction.settle', pending.opening.payload, { cause: 'system', seed: pending.opening.seed });
            return preview?.ok ? { state: preview.state, result: preview.receipt?.data?.v2?.result } : null;
        },
        /** Whether a reply is being built or awaited (its interceptor ran; not yet received, ended or stopped). */
        replyBusy: () => s.replyBusy,
        /** Resolves when no reply is in progress (at once when none is). */
        whenIdle,
    };
    return api;
}
