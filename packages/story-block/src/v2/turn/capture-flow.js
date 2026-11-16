// Story Suite v2: the capture flow, moved out of createTurn unchanged: a reply's change lines read from its block, the ones the model
// wrote in the story or the safety net kept (stray, late, now), run one by one as their owner's capture command within the line cap,
// the afterCapture steps (capture-after.js), the lines run as captures (capture-each.js), the seeds a Re-read gives them (capture-seeds.js), and the
// held-module check (capture-held.js). `createCaptureFlow(s, deps)` is given the turn's state holder `s` and the turn parts it uses (the session's
// `problem`); it never imports turn.js.
import { MAX_CHANGE_LINES } from '../sdk.js';
import {
    LEGACY_PROBLEM, assistSections, grammarHeads, markCaps, parseChanges, sameChangeLine, strayLines,
} from '../capture.js';
import { cutAt } from '../../text.js';
import { refusedWhy } from '../assist/safety.js';
import { notWritten } from '../assist/extractor.js';
import { CHATTER_MAX, displayLines } from '../extras.js';
import { readRecord } from '../persist.js';
import { createMarkHistory, ruleMarksOf } from './rule-marks.js';
import { boardFailure, boardStep } from './held-board.js';
import { openingStep, settleStep } from '../interaction/watch.js';
import { createCaptureAfter } from './capture-after.js';
import { createCaptureEach, LATE, NOW } from './capture-each.js';
import { heldInReply as heldInReplyOf } from './capture-held.js';
import { stepSeeds, storySeeds } from './capture-seeds.js';
export function createCaptureFlow(s, deps) {
    const { ctx, store, bus, registry, settings, events, hostSettings, view, viewReader, lateReader, problem, isCarrier, boardError, PRACTICE_LINE, HOOK_TIMEOUT_MS, interactionError = () => null } = deps;
    const markHistory = createMarkHistory();
    const holdBoard = message => Object.assign(new Error(`${boardFailure('The fight could not be saved:', message)} Once restored, this reply can finish; after discarding, regenerate it.`), { code: 'BOARD_PRELUDE' });
    // A reply whose interaction settle can no longer be kept is held, as a board reply is: restore what it read or discard, then regenerate.
    const holdInteraction = message => {
        const detail = String(message ?? 'The interaction could not be saved.').trim().replace(/[.\s]+$/u, '');
        return Object.assign(new Error(`${detail}.${/discard/i.test(detail) ? '' : ' Restore what it used, or discard it.'} Once restored, this reply can finish; after discarding, regenerate it.`), { code: 'INTERACTION_PRELUDE' });
    };
    const { afterCapture } = createCaptureAfter({ ctx, store, bus, registry, settings, events, view, viewReader, problem, holdBoard, holdInteraction, HOOK_TIMEOUT_MS, isolated: deps.isolated });
    // Runs the reply's change lines; returns { receipts, problems }.
    // Each line runs on the state the lines before it left (bus.run's `state`), as its owner's
    // capture handler (bus.run's `capture`), and is stored on the reply before the next one runs.
    // A reply holds at most maxChangeLines change lines; the rest are one Problem (pushed to `found`).
    const lineCap = () => (Number.isInteger(hostSettings()?.maxChangeLines) && hostSettings().maxChangeLines > 0 ? hostSettings().maxChangeLines : MAX_CHANGE_LINES);
    // A block's lines read, at most maxChangeLines, the rest one Problem. `fresh` (first live capture) or the reply's `caretWords` mark: drop a preset's ^ before each word.
    function readBlock(index, text, { fresh = false } = {}) {
        const cap = lineCap();
        const caret = fresh || ruleMarksOf(readRecord(ctx?.chat?.[index])?.rules).includes('caretWords');
        const parsed = parseChanges(text, { max: cap, caret }), problems = parsed.problems.map(line => problem({ index, code: 'UNREADABLE', message: line }));
        if (parsed.over) {
            const { count, total, first } = parsed.over;
            problems.push(problem({ index, code: 'TOO_MANY', message: `The reply has ${total} change lines; only the first ${cap} were read, so ${count} ${count === 1 ? 'line was' : 'lines were'} not used (from "${cutAt(first, 60)}").` }));
        }
        return { lines: parsed.lines, problems };
    }
    // The heads of the kinds the reply may write ("! encounter", "+ quest"), for the change lines a
    // model writes in the story near the block (capture.js strayLines). Read at each capture, so a
    // feature turned off takes its kinds' heads with it.
    function changeHeads() {
        try { return grammarHeads(registry.contexts().flatMap(context => context.kinds ?? [])); } catch { return new Set(); }
    }
    // The story's change lines that were not taken (too far up, written another way) as Problems.
    // (A line that repeats one the reply's block holds, `read` (raw), was used: it is not told.)
    function strayProblems(index, text, heads, options, read = []) {
        const used = new Set(read.map(sameChangeLine));
        return strayLines(text, heads, options).problems.filter(({ line }) => !used.has(sameChangeLine(line)))
            .map(({ line, reason }) => problem({ index, line, code: 'STRAY', message: `"${line}" was not used: ${reason}.` }));
    }
    // The one Problem of a reply whose changes were read from a v1 envelope (capture.js adoptLegacy).
    const legacyProblem = index => problem({ index, code: 'LEGACY_FORMAT', message: LEGACY_PROBLEM });

    function capped(index, all, found) {
        const cap = lineCap();
        if (all.length > cap) {
            const more = all.length - cap;
            found.push(problem({ index, code: 'TOO_MANY', message: `The reply has ${all.length} change lines; only the first ${cap} were read, so ${more} ${more === 1 ? 'line was' : 'lines were'} not used (from "${cutAt(all[cap].raw, 60)}").` }));
        }
        return all.slice(0, cap);
    }

    // The safety net's lines that fit the reply's cap after `used` lines; the rest are one Problem.
    function assistRoom(index, items, used, found) {
        const room = Math.max(0, lineCap() - used);
        if (items.length > room) {
            const more = items.length - room;
            found.push(problem({ index, code: 'TOO_MANY', assist: items[room].mark, message: `(assist) The reply's lines fill its cap of ${lineCap()}, so ${more} safety-net ${more === 1 ? 'line was' : 'lines were'} not used (from "${cutAt(items[room].line.raw, 60)}").` }));
        }
        return items.slice(0, room);
    }

    // The previous reply's safety-net lines read after the reader had sent (its <Changes-assist-next>),
    // for reply `index` (not a Continue's): parsed, through the stricter wall for late lines, without the
    // ones the reply's own lines (`own`, raw) already hold.
    function lateLines(index, own = []) {
        const chat = ctx?.chat ?? [];
        const from = chat.slice(0, Math.max(0, index)).findLastIndex(isCarrier);
        if (from < 0 || lateReader?.faded().has(from)) return [];
        const stored = assistSections(String(chat[from]?.mes ?? '')).next;
        if (!stored.length) return [];
        const safe = parseChanges(stored.join('\n')).lines.filter(line => !refusedWhy(line, null, { late: true }));
        const keep = new Set(notWritten(safe.map(line => line.raw), own, { late: true }));
        return safe.filter(line => keep.has(line.raw));
    }

    // A reply's own safety-net lines (its <Changes-assist>), parsed, without the ones `own` already holds, nor
    // a place, time or weather `block` (the reply's own block lines, raw) set (extractor.js SCENE_KINDS).
    function nowLines(mes, own = [], block = own) {
        const stored = assistSections(String(mes ?? '')).now;
        if (!stored.length) return [];
        const parsed = parseChanges(stored.join('\n')).lines.filter(line => !refusedWhy(line, null));
        const keep = new Set(notWritten(parsed.map(line => line.raw), own, { scene: block }));
        return parsed.filter(line => keep.has(line.raw));
    }

    // How many lines of each display kind `mes` already shows (extras.js displayLines, the rule the card
    // draws by): lines a Continue or the extractor adds count after these against the cap (F115), so a
    // choice past it is told as one of the original reply's would be.
    const shownIn = (mes, caret = false) => new Map(Object.entries(displayLines(mes, { entryOf: word => registry.capture(word), max: lineCap(), caret }))
        .map(([kind, values]) => [kind, values.length]));

    // `before`: the reply's text before these lines were added (a Continue's, the extractor's), or null.
    // `type`: the generation's (normal, swipe, regenerate, continue) or 'late' (the extractor's lines).
    // `late` / `assist` (MODULES §F123): the Assist safety net's lines, run after the reply's own as story
    // lines marked as its (late: read from the reply before, after the reader had sent), within the same
    // cap per reply (`used`: lines the reply already read in an earlier call).
    async function captureLines(index, all, before = null, type = 'normal', { late = [], assist = [], used = 0, prechecks = [] } = {}) {
        const board = boardStep({ prechecks })?.payload.board;
        if (board) {
            const error = boardError(store.head(), board);
            if (error) throw holdBoard(error);
        }
        const settle = settleStep({ prechecks })?.payload;
        if (settle) {
            const error = interactionError(store.head(), settle, openingStep({ prechecks }));
            if (error) throw holdInteraction(error);
        }
        const receipts = [];
        const found = [];
        const lines = capped(index, all, found);
        const extra = assistRoom(index, [...late.map(line => ({ line, mark: LATE })), ...assist.map(line => ({ line, mark: NOW }))], used + lines.length, found);
        const blocked = markHistory(ctx?.chat?.[index], store.carrierSid?.(index), type, before, changeHeads(), type === 'continue' || type === 'late' ? lateLines(index) : []);
        const shown = typeof before === 'string' ? shownIn(before, ruleMarksOf(readRecord(ctx?.chat?.[index])?.rules).includes('caretWords')) : new Map();
        // One write of the reply's record for all its lines and its afterCapture steps (store.batch).
        let off = [];
        let steps = [];
        await (store.batch ?? (fn => fn()))(async () => {
            // The seeded pre-roll precedes this reply's story lines, as it did in the prompt.
            // Its Source is now this reply's; the previous reply is never changed.
            const prepared = prechecks.length ? await afterCapture(index, { type, problems: found, prechecks, onlyPrechecks: true }) : [];
            ({ off } = await captureEach(index, lines, receipts, found, null, null, shown, null, null, blocked));
            for (const mark of [LATE, NOW]) {
                const group = extra.filter(item => item.mark === mark).map(item => item.line);
                if (group.length) off = [...new Set([...off, ...(await captureEach(index, group, receipts, found, null, null, shown, mark, null, blocked)).off])];
            }
            // A pre-roll is part of this reply even when its narration has no Changes block.
            if (receipts.length || prepared.length) steps = [...prepared, ...await afterCapture(index, { type, problems: found })];
            // A reply with no story lines runs only the hooks that opted in (`hook.always === true`).
            else steps = await afterCapture(index, { type, problems: found, alwaysOnly: true });
        });
        return { receipts, problems: found, off, steps: steps.map(step => step.receipt) };
    }

    // How many Inner chatter lines this reply could show, kept in its hidden comment when the reader's setting is not the
    // usual 3 (capture.js markCaps): the reply shows the same lines whatever the setting becomes. Every reply without a
    // mark was read at 3.
    function keptCaps() {
        let entry = null;
        try { entry = registry.capture('chatter'); } catch { entry = null; }
        const cap = entry && !entry.off ? entry.display?.perReply : undefined;
        return Number.isInteger(cap) && cap > 0 && cap !== CHATTER_MAX ? { chatter: cap } : {};
    }
    const withCaps = (mes, from = 0, always = false) => {
        const caps = keptCaps();
        return always || Object.keys(caps).length ? markCaps(mes, caps, from) : mes;
    };
    const { captureEach } = createCaptureEach(s, { ctx, store, bus, registry, settings, events, problem, PRACTICE_LINE, readBlock, changeHeads });
    // The held-module check of a Re-read (capture-held.js).
    const heldInReply = (message, lines, assist = []) => heldInReplyOf(registry, message, lines, assist);

    return { changeHeads, readBlock, strayProblems, legacyProblem, capped, assistRoom, lateLines, nowLines, captureLines, afterCapture, stepSeeds, captureEach, storySeeds, heldInReply, withCaps, LATE, NOW };
}
