// Story Suite v2: what is built and decided before the reply, moved out of createTurn unchanged: the beforeGenerate cues, what
// modules send under their own keys, the two prompt texts, the canGenerate question and what a hold-back does, the too-small notice,
// the generation interceptor, and the history stripped of hidden blocks. `createPromptBuild(s, deps)` is given the turn's state
// holder `s` and the turn parts it uses; it never imports turn.js.

import { extractBlock, hasHidden, hasLegacy, stripBlock } from '../capture.js';
import { HOST_MODULE } from '../registry.js';
import { assemble, contextNotice, estimateTokens } from '../prompt.js';
import { ensureModules, makeView } from '../sdk.js';
import { cutAt } from '../text.js';
import { CORE_FEATURE } from '../features.js';
import { NO_ROLLS_LINE } from '../../modules/rpg/cue.js';
import { fightCue } from '../../modules/rpg/board/fight-start.js';
import { startInteraction } from '../interaction/start.js';
import { CORE_MODULE_ID } from '../../modules/scene/domains/core/constants.js';
import { rpgLib } from '../../modules/rpg/rpg-lazy.js';
import { readRecord } from '../persist.js';
import { hashText } from '../../modules/assist/common.js';
import { KEPT_CHARS_MAX, KEPT_LINES_MAX, TIMED_OUT, defuseMacros, keptGiven, firstLine, mapContent, substituteNames, within } from './text.js';

export { KEPT_LINES_MAX, KEPT_CHARS_MAX };
export { KEPT_PRELUDE_TOKENS } from './prelude-run.js';
import { stripMarkers } from '../interaction/markers.js';
import { runPreludes } from './prelude-run.js';

export function createPromptBuild(s, deps) {
    const { ia, ctx, metadata, store, bus, registry, settings, events, timeline, onBlocked, notify, initial, prepare, hostSettings, viewReader, view, contextNow, hasCarrier, lastCarrier, isPrelude, markBusy, markIdle, setPrompts, clearPrompts, problem, trySave, held, claimQuiet, FOREGROUND, HOOK_TIMEOUT_MS, ASSIST_WAIT_MS, RPG_LOAD_WAIT_MS, OWN_PROMPT_PARTS, OWN_PROMPT_CHARS, STRIP_CACHE, HAS_BLOCK, HAS_LEGACY, hookTimeout, normalizeType } = deps;
    let toldRestore = null;
    let recovering = null;

    function recoverOnce() {
        const holder = metadata();
        if (recovering?.holder === holder || !timeline?.needsRecovery()) return;
        const attempt = { holder };
        recovering = attempt;
        try {
            Promise.resolve(timeline.recover()).then(() => {
                if (recovering === attempt) recovering = null;
            }, error => {
                if (recovering === attempt) recovering = null;
                problem({ code: 'FAILED', message: `The restore could not be checked: ${error?.message ?? error}` });
            });
        } catch (error) {
            if (recovering === attempt) recovering = null;
            problem({ code: 'FAILED', message: `The restore could not be checked: ${error?.message ?? error}` });
        }
    }

    // beforeGenerate (§4.1 step 3): each hook may return lines for the tail, or commands to
    // commit now as `system` receipts: string[] | { lines?: string[], commands?: [{ type, payload }] }.
    // A Continue (the same reply goes on) commits nothing (B3-9): hooks are told `{ type, dryRun,
    // commit: false }` and their commands are not run. A dry run (SillyTavern counting tokens) never
    // gets here: SillyTavern 1.19 runs no interceptor for one (Generate: `if (!dryRun)`), so the
    // interceptor's own generation is never a dry run (r2-1).
    async function runCues(type = 'normal', { dryRun = false } = {}) {
        const cues = {};
        let committed = false;
        const prechecks = [];
        let previewState = null, boardStop = null;
        const requested = [];
        const commit = !dryRun && type !== 'continue';
        // `again`: an earlier attempt at this reply was never captured (a retried interceptor), so a hook may reuse its work.
        const again = s.session !== null;
        for (const { moduleId, fn } of registry.hookEntries('beforeGenerate')) {
            let out;
            const limit = hookTimeout(fn);
            try { out = await within(fn(view(), { type, dryRun, commit, again }), limit); } catch (error) {
                problem({ module: moduleId, code: 'FAILED', message: `beforeGenerate failed: ${error?.message ?? error}` });
                continue;
            }
            if (out === TIMED_OUT) {
                problem({ module: moduleId, code: 'TIMEOUT', message: `beforeGenerate did not answer within ${limit / 1000} s; the reply went on without its notes.` });
                continue;
            }
            // A module offers an interaction before the send (interaction/start.js): previewed and held, or dropped with a quiet Problem.
            if (out?.interactionStart) {
                const started = startInteraction({ answer: out, moduleId, chat: ctx?.chat ?? [], metadata, bus, kindOf: id => registry.interaction?.(id), problem, state: store.head() });
                if (started?.blocked) return started;
            }
            // A merged hook (domains/index.js mergeParts) keeps the answers of the parts that did answer and reports the others.
            for (const entry of Array.isArray(out?.problems) ? out.problems : []) problem({ module: moduleId, code: entry.code, message: entry.message, ...(entry.quiet === true ? { quiet: true } : {}) });
            const lines = Array.isArray(out) ? out : Array.isArray(out?.lines) ? out.lines : [];
            // The RPG's rolls and its "no rolls" line outrank ordinary tail notes when the tail is trimmed (prompt.js); keptGiven (text.js) pins `{ text, keep: true }` lines.
            const given = keptGiven(lines, NO_ROLLS_LINE);
            if (given.length) cues[moduleId] = given;
            for (const command of commit && Array.isArray(out?.commands) ? out.commands : []) {
                // A prelude (Assist's roll, the RPG's rolls) is previewed for the prompt, without writing on the
                // previous reply. Completion runs the same seed on the generated reply; only that transaction is stored.
                if (isPrelude(command?.type)) {
                    requested.push({ moduleId, type: command.type, payload: command.payload ?? {}, seed: command.seed });
                    continue;
                }
                const result = await bus.command(command?.type, command?.payload ?? {}, { cause: 'system' });
                if (result?.ok) {
                    committed = true;
                    events?.emit('committed', { receipt: result.receipt });
                } else problem({ module: moduleId, code: result?.code ?? 'FAILED', message: `The cue "${command?.type}" was not committed: ${result?.message ?? 'unknown error'}` });
            }
        }
        // An interaction the reader staged and sent: its opening and its segment settle as preludes of this reply (interaction/hooks.js; null when none).
        let mine = null;
        try { mine = ia.beforeGenerate(view(), { type, dryRun, commit, again }); } catch (error) { problem({ module: CORE_MODULE_ID, code: 'FAILED', message: `beforeGenerate failed: ${error?.message ?? error}` }); }
        for (const command of mine?.commands ?? []) requested.push({ moduleId: CORE_MODULE_ID, type: command.type, payload: command.payload ?? {}, seed: command.seed });
        // Other cues may settle a fight or change a modifier. Preview on the state they leave,
        // which is also the state the generated reply's prelude will start from.
        const ran = runPreludes({ s, bus, store, problem, kindOf: id => registry.interaction?.(id) }, { requested, cues, prechecks, previewState });
        if (ran.blocked) return { blocked: ran.blocked };
        ({ previewState, boardStop } = ran);
        const { keptPrelude } = ran;
        // A fight narrated with no foes line (fight-start.js fightCue): one short tail line for this reply, only with the RPG on and no foe set.
        // (A swipe: the reply being swiped is the last message, so the reader's message and the reply before it sit one place further back.)
        const back = type === 'swipe' ? 1 : 0, last = ctx?.chat?.at(-1 - back), prior = ctx?.chat?.at(-2 - back);
        if (type !== 'continue' && battleOn() && last?.is_user && prior && !prior.is_user && !prior.is_system && readRecord(prior)) {
            const state = store.head(), lib = rpgLib(), foesNow = (lib?.rpgBlocks(state) ?? []).some(block => block.role === 'foes' && lib.foesOf(block).length > 0);
            const cue = fightCue(prior, { foesNow });
            if (cue) cues[HOST_MODULE] = [...(cues[HOST_MODULE] ?? []), cue];
        }
        // Saved with the reply (MESSAGE_RECEIVED), not now: each save writes the whole chat file, and the
        // reply's save comes moments later with these cues in it. A reply that never comes still has them
        // saved: GENERATION_ENDED / GENERATION_STOPPED and CHAT_CHANGED save what is unsaved.
        if (committed) {
            store.deferSave?.();
            s.deferred = true;
        }
        return { cues, prechecks, previewState, boardStop, keptPrelude };
    }

    // What modules send with the reply on their own, under their own prompt keys (SPEC §5: NPC State
    // Delta's dossiers): each `ownPrompt(view)` hook's [{ label, text }] (one { label, text } or a string
    // also do), read at once (a promise is not waited for), names filled in as SillyTavern fills them.
    // It is counted, never sent by Story Block: the share of the context (prompt.js contextFit) and the
    // settings' prompt size count it. A hook that throws or answers nothing counts nothing; the size is a
    // report, never a reason to hold the reply back. → [{ module, label, place: 'own', text, tokens }]
    function sentByModules(current) {
        const out = [];
        for (const { moduleId, fn } of registry.hookEntries('ownPrompt')) {
            let answer;
            try { answer = fn(current); } catch { continue; }
            if (typeof answer?.then === 'function') {
                answer.then?.(() => {}, () => {});
                continue;
            }
            const list = typeof answer === 'string' ? [{ text: answer }] : Array.isArray(answer) ? answer : answer && typeof answer === 'object' ? [answer] : [];
            const name = registry.module(moduleId)?.name ?? moduleId;
            for (const item of list.slice(0, OWN_PROMPT_PARTS)) {
                const raw = typeof item === 'string' ? item : item?.text;
                if (typeof raw !== 'string' || !raw.trim()) continue;
                const text = substituteNames(cutAt(raw, OWN_PROMPT_CHARS), ctx);
                const label = typeof item?.label === 'string' && item.label.trim() ? cutAt(item.label.replace(/\s+/g, ' ').trim(), 80) : name;
                out.push({ module: moduleId, label, place: 'own', text, tokens: estimateTokens(text) });
            }
        }
        return out;
    }

    function build(cues = {}, state = null, boardStop = null, keptTokens = 0) {
        const untold = store.untold();
        // (`state`: the state the reply's prelude rolls leave, when it has one; the tail's lines are made from it)
        const current = state ? makeView({ store, registry, settings, chat: ctx?.chat, active: viewReader, state, boardStop }) : view();
        const own = sentByModules(current);
        const ownTokens = own.reduce((sum, part) => sum + part.tokens, 0);
        const result = assemble({ registry, view: current, untold, settings: hostSettings(), cues, substitute: text => substituteNames(text, ctx), context: contextNow(), ownTokens, rolled: state !== null, keptTokens });
        for (const message of result.problems) problem({ code: 'FAILED', message });
        return { ...result, own, untold };
    }

    /** SillyTavern's generate interceptor: (chat, contextSize, abort, type). */
    // canGenerate (MODULES §F12): every module may hold a story generation back, e.g. until the
    // player character exists. `false` or { ok: false, reason, action? } blocks; the first one is the answer.
    // A hook that throws, or does not answer within HOOK_TIMEOUT_MS, is logged and does not block
    // (a bug must not lock the reader out). `all` asks every module (Home's "Before you start"): the
    // list of those that hold back, nothing logged (it is asked again on each redraw).
    // A module that is dormant, or held by a restore barrier, is not asked at all (registry.hookEntries leaves
    // it out): its veto is suppressed, never answered false, since one refusal stops the whole story.
    async function askCanGenerate({ all = false, type = 'normal' } = {}) {
        const found = [];
        // A restore barrier (registry.setRestore) holds the story back for everyone until every part agrees;
        // the hooks of the modules it holds are not asked (registry.hookEntries leaves them out).
        const barrier = registry.restore?.();
        if (barrier?.state === 'pending') {
            const entry = { moduleId: HOST_MODULE, reason: registry.lifecycle?.(HOST_MODULE)?.reason ?? 'A restore is in progress.' };
            if (!all) return entry;
            found.push({ ...entry, name: registry.module(HOST_MODULE)?.name ?? HOST_MODULE, action: false, canOpen: false });
        }
        // (the core's own interaction hold is asked last, directly: it is no module's hook, and answers at once)
        for (const { moduleId, fn, own = false } of [...registry.hookEntries('canGenerate'), { moduleId: CORE_MODULE_ID, fn: ia.canGenerate, own: true }]) {
            let answer;
            try { answer = own ? fn(view(), { type, commit: !all }) : await within(fn(view(), { type, commit: !all }), HOOK_TIMEOUT_MS); } catch (error) {
                if (!all) problem({ module: moduleId, code: 'FAILED', message: `canGenerate failed: ${error?.message ?? error}` });
                continue;
            }
            if (answer === TIMED_OUT) {
                if (!all) problem({ module: moduleId, code: 'TIMEOUT', message: `canGenerate did not answer within ${HOOK_TIMEOUT_MS / 1000} s; the story went on.` });
                continue;
            }
            if (answer === false || (answer && typeof answer === 'object' && answer.ok === false)) {
                const name = registry.module(moduleId)?.name ?? moduleId;
                const reason = typeof answer?.reason === 'string' && answer.reason.trim() ? answer.reason.trim() : `${name} is not ready for the story to go on yet.`;
                const entry = { moduleId, reason, ...(answer?.interactionStart === true ? { interactionStart: true } : {}) };
                if (all) {
                    // The button's words (a module's `action`, flattened, ≤ 40 code points), or false for none.
                    const action = answer?.action === false ? false
                        : typeof answer?.action === 'string' ? Array.from(answer.action.replace(/[\p{Cc}\p{Zl}\p{Zp}\s]+/gu, ' ').trim()).slice(0, 40).join('').trim() : '';
                    entry.name = name;
                    entry.action = action;
                    entry.canOpen = action !== false && typeof onBlockedOf(moduleId) === 'function';
                } else return entry;
                found.push(entry);
            }
        }
        return all ? found : null;
    }
    const blockedBy = type => askCanGenerate({ type });

    // A module's own onBlocked hook (what it does when it held the story back: an example module opens the
    // character wizard). → true when it ran without throwing.
    // C3-2: through the off-aware hook list, so a hook whose feature is off is never called (nor offered).
    const onBlockedOf = moduleId => registry.hookEntries('onBlocked').find(entry => entry.moduleId === moduleId)?.fn ?? null;
    function runOnBlocked(moduleId, reason) {
        const fn = onBlockedOf(moduleId);
        if (typeof fn !== 'function') return false;
        try {
            fn(reason, moduleId);
            return true;
        } catch (error) {
            problem({ module: moduleId, code: 'FAILED', message: `onBlocked failed: ${error?.message ?? error}` });
            return false;
        }
    }

    // `keepSession`: the held fight reply's session is put back once the block is told (it is still captured).
    function block({ moduleId, reason, interactionStart = false, keepSession = false }, abort) {
        const held = keepSession ? s.session : null;
        s.session = null;
        markIdle();
        clearPrompts();
        const restoring = moduleId === HOST_MODULE && registry.restore?.().state === 'pending';
        const holder = restoring ? metadata() : null;
        const epoch = restoring ? registry.restoreEpoch?.() : null;
        const tell = restoring && (toldRestore?.holder !== holder || toldRestore?.epoch !== epoch);
        if (tell) {
            toldRestore = { holder, epoch };
            problem({ code: 'RESTORE_PENDING', message: `The reply was not sent. ${reason}` });
        }
        try { abort?.(true); } catch (error) { console.warn('[Story Suite] the generation could not be stopped', error); }
        if (interactionStart) {
            try { Promise.resolve(ctx?.saveChat?.()).catch(() => {}); } catch { /* the next chat write saves it */ }
            try { (ctx?.saveMetadata ?? ctx?.saveMetadataDebounced)?.call(ctx); } catch { /* the next chat write saves it */ }
            events?.emit('head', { index: store.headIndex(), reason: 'interaction-start' });
            return;
        }
        if (!restoring || tell) {
            try { notify?.(reason, moduleId); } catch { /* a missing toastr is not an error */ }
        }
        runOnBlocked(moduleId, reason);
        if (typeof onBlocked === 'function') {
            try { onBlocked(reason, moduleId); } catch (error) {
                problem({ module: moduleId, code: 'FAILED', message: `onBlocked failed: ${error?.message ?? error}` });
            }
        }
        s.blocks.push({ moduleId, reason });
        if (keepSession) s.session = held;
    }

    // The static part alone is over Story Suite's share of the context: told once per chat (a toast and the
    // Problems list); the reply still goes out with it.
    function tellTooSmall(fit) {
        if (!fit?.tooSmall) return;
        let chatId = null;
        try { chatId = typeof ctx?.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx?.chatId; } catch { chatId = null; }
        const key = String(chatId ?? '');
        if (s.toldSmall.has(key)) return;
        s.toldSmall.add(key);
        const reason = contextNotice(fit);
        problem({ code: 'CONTEXT_SMALL', message: reason });
        try { notify?.(reason, null); } catch { /* a missing toastr is not an error */ }
    }

    async function interceptor(_chat, contextSize, abort, type) {
        const kind = normalizeType(type);
        if (!FOREGROUND.includes(kind)) {
            // A quiet generation whose instruction is known is told apart at its own prompt-ready, which loses Story Block's text
            // there (quietPrompt, below): the slots keep the reply's text for the reply's own prompt, whichever of the two is built first.
            const known = kind === 'quiet' && claimQuiet();
            if (known && s.session && !s.session.prompted) return;
            // Any other (an impersonation, a quiet generation with no instruction told): a prompt built while the reply's own is
            // pending must not carry its text; the reply's prompt gets it back at that prompt's prompt-ready (below).
            // A reply already on its way keeps its session, so it is still captured.
            if (s.session && !s.session.prompted) s.session.background += 1;
            clearPrompts();
            return;
        }
        if (!ctx?.chat) return;
        // The feature switched on a moment ago: its code is waited for (no pass over the chat; onChatChanged did that).
        if (typeof prepare === 'function') { try { const waiting = prepare({ scan: false }); if (waiting) await within(waiting, RPG_LOAD_WAIT_MS); } catch { /* the loader reports its own failure */ } }
        // The safety net still reading the last reply: waited for briefly, so its lines are in this prompt.
        if (s.assistPending) await within(s.assistPending, ASSIST_WAIT_MS);
        markBusy();
        if (Number.isFinite(Number(contextSize)) && Number(contextSize) > 0) s.lastSize = Number(contextSize);
        // B-b2-timeline-r2-1: never a dry run (SillyTavern runs interceptors only for real generations).
        // It is not read from GENERATION_STARTED: another caller's dry run (token counting) can start
        // between this generation's GENERATION_STARTED and this call, and would cost the reply its capture.
        try {
            // What is waiting for the turn's idle save goes with the reply's own save (it is on its way);
            // without idle saves it is written now.
            if (store.idleSaves?.()) {
                if (store.dirty()) store.deferSave?.();
            } else await trySave('before the reply');
            // A Regenerate removes the old reply before this runs, without an event for it.
            if (store.headIndex() !== lastCarrier()) store.rebuild();
            // Stored packs not yet checked (the checker is late or failed): no state is started from a pack-less read and no prompt goes out; it is said once and the reply stops.
            if (hasCarrier()) {
                const why = held();
                if (why) { block({ moduleId: HOST_MODULE, reason: why }, abort); return; }
                store.ensureInitial(initial());
            }
            // A pending barrier may need settling after a head change. Healthy sends do not settle here.
            if (registry.restore?.().state === 'pending') {
                timeline?.settle();
                if (registry.restore?.().state === 'pending') {
                    recoverOnce();
                    const waiting = await blockedBy(kind);
                    if (waiting) { block({ ...waiting, keepSession: Boolean(s.heldBoard) }, abort); return; }
                }
            }
            await ensureModules({ store, bus, registry, events });
            if (s.heldBoard) {
                block({ moduleId: 'story-block', reason: s.heldBoard.hold ?? 'Restore what the interaction used, or discard it from its screen, and regenerate the held reply.', keepSession: true }, abort);
                return;
            }
            const blocked = await blockedBy(kind);
            if (blocked) {
                block(blocked, abort);
                return;
            }
            const { cues, prechecks, previewState, boardStop, keptPrelude, blocked: cueBlocked } = await runCues(kind);
            if (cueBlocked) { block(cueBlocked, abort); return; }
            const built = build(cues, previewState, boardStop, keptPrelude);
            tellTooSmall(built.fit);
            const chat = ctx.chat;
            const last = chat.length - 1;
            const index = kind === 'swipe' || kind === 'continue' ? last : chat.length;
            s.session = {
                type: kind,
                prechecks,
                index,
                untold: built.untold.map(receipt => receipt.id),
                staticText: defuseMacros(built.staticText),
                tailText: defuseMacros(built.tailText),
                parts: built.parts,
                // The change lines are on: the static header names <Changes> (prompt.js), which the closing cue repeats (prompt-hooks.js).
                changesOn: built.parts.some(part => part.module === 'story-suite' && part.text.includes('<Changes>')),
                // A Continue's reply was captured before: only blocks the continuation adds to this
                // text are read (capture.js continuation()).
                base: kind === 'continue' ? String(chat[last]?.mes ?? '') : null,
                prompted: false,
                background: 0,
                restored: '',
            };
            s.abortBoard = abort;
            setPrompts(s.session.staticText, s.session.tailText);
        } catch (error) {
            s.session = null;
            markIdle();
            clearPrompts();
            problem({ code: 'FAILED', message: `The reply's notes could not be built: ${error?.message ?? error}` });
        }
    }

    function strippedText(text) {
        if (!HAS_BLOCK.test(text) && !HAS_LEGACY.test(text)) return text;
        let out = s.stripped.get(text);
        if (out === undefined) {
            // (A hidden comment may hold only lines left in the story, B-a1-3: it goes too. So does a v1 envelope.)
            out = extractBlock(text) === null && !hasHidden(text) && !hasLegacy(text) ? text : stripBlock(text);
            if (s.stripped.size >= STRIP_CACHE) s.stripped.delete(s.stripped.keys().next().value);
            s.stripped.set(text, out);
        }
        return out;
    }
    // Only while the RPG is on: with it off a reply's text goes into the prompt as it always did.
    const battleOn = () => registry.featureOn?.(CORE_FEATURE.leanRpg) === true;
    // The marker words dropped from the history: `[battle]` while the RPG is on (the board's own gate), then each registered interaction kind's word whose marker feature is on.
    const markers = () => [...(battleOn() ? ['battle'] : []), ...(registry.markerWords?.() ?? [])];
    function stripHistory(chat) {
        const words = markers();
        const strip = words.length ? text => stripMarkers(strippedText(text), words) : strippedText;
        for (const message of chat) {
            if (message?.role !== 'assistant') continue;
            const content = mapContent(message.content, strip);
            if (content !== message.content) message.content = content;
        }
    }

    // A background prompt seen while the reply's own is pending: its slots were emptied for it;
    // fill them again for the reply. True when this prompt was the background one.
    function backgroundPrompt() {
        if (!s.session || s.session.prompted || s.session.background <= 0) return false;
        s.session.background -= 1;
        if (!s.session.background) setPrompts(s.session.staticText, s.session.tailText);
        return true;
    }

    // Another caller's prompt built while the reply's own is pending (generateRaw: SillyTavern runs no interceptor for it and puts
    // no extension prompt in it, yet tells its prompt-ready like the reply's): it holds neither of the slots' texts, which the
    // reply's own prompt always does while they are set. It is left alone and the reply's own prompt is still waited for.
    function foreignPrompt(holds) {
        if (!s.session || s.session.prompted || s.session.background > 0) return false;
        const marks = [s.session.staticText, s.session.tailText].map(firstLine).filter(Boolean);
        return marks.length > 0 && !marks.some(holds);
    }

    return { runCues, build, askCanGenerate, runOnBlocked, interceptor, battleOn, markers, stripHistory, backgroundPrompt, foreignPrompt };
}
