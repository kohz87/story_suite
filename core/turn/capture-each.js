// Story Suite v2: the change lines run as story captures, moved out of createCaptureFlow unchanged: each line on the state the one before left, as its
// owner's capture command, with the reply's marks (practice rule, foe cap, rule marks), the safety net's marks, and the money guard.
// `createCaptureEach(s, deps)` is given the turn's state holder `s` and the turn parts it uses; it never imports turn.js.
import { extractBlock, stripBlock } from '../capture.js';
import { cutAt } from '../text.js';
import { assistDepartures, assistPlaceConflict } from '../../modules/assist/where.js';
import { readDisplayLine } from '../../ui/legacy/extras.js';
import { CAPTURE_PREFIX } from '../registry.js';
import { occurrenceOf } from '../evidence.js';
import { readRecord } from '../persist.js';
import { LEAN_RPG_FEATURE, practiceFromRollsOnly } from '../../modules/rpg/names.js';
import { allRuleNames, foeLine, ruleMarksFor, ruleMarksOf } from './rule-marks.js';
import { earlierReceipts, moneyWarning } from './money-guard.js';
import { lineMark, occurrenceFor } from './capture-seeds.js';

// The Assist safety net's marks on its receipts and Problems (MODULES §F123).
export const NOW = 'now';
export const LATE = 'late';

export function createCaptureEach(s, deps) {
    const { ctx, store, bus, registry, settings, events, problem, PRACTICE_LINE, readBlock, changeHeads } = deps;
    // The reply's lines in the order they run: as written, except a line of a kind with `after` (registry captureEntry) goes behind the
    // reply's last line of the kinds it names, so it reads what those lines set up. The others keep their order, and so do the moved ones.
    function linesInOrder(lines) {
        const kinds = lines.map(line => registry.capture(line.kind));
        if (!kinds.some(entry => entry?.after)) return lines;
        const key = (line, at) => {
            const after = kinds[at]?.after;
            const last = after ? kinds.reduce((found, entry, other) => (other > at && after.includes(entry?.kind) ? other : found), -1) : -1;
            return last < 0 ? [at, 0] : [last, at + 1];
        };
        return lines.map((line, at) => ({ line, order: key(line, at) }))
            .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1])
            .map(item => item.line);
    }

    // Runs `lines` as story captures on carrier `index`, each on the state the one before left. Stored on
    // the head as they go (append), or, with `base` (a Re-read), run on that state and returned as
    // { ops } for store.replaceStory, nothing stored.
    // `plan` ({ blocks: [], pending: 0 }, a Re-read's, shared by its calls): the guarded blocks planned so far
    // (REPLAY.md), so each line's block gets the next ordinal and replaceStory stores each as a block of its own.
    async function captureEach(index, lines, receipts, found, base = null, seeds = null, shown = new Map(), assist = null, plan = null, blocked = { foe: false, rules: [] }) {
        const collected = [];
        const firstProblem = found.length;
        lines = linesInOrder(lines);
        // Display kinds (written words) whose lines were read while their feature was off (capture.js markOff).
        const off = new Set();
        let state = base ?? store.head();
        // ctx.carrier and ctx.chat for the capture handlers (MODULES §F2's capture context).
        const message = ctx?.chat?.[index];
        // `sid`: the reply's record ID, which stays with the reply when earlier messages are deleted.
        const carrier = { index, swipe: Number.isInteger(message?.swipe_id) ? message.swipe_id : 0, sid: store.carrierSid?.(index) ?? null };
        // The practice rule recorded with the reply: skill practice comes only from rolls (data-modules/part.js refuses a story practice-N line). A reply
        // captured live under the rule (the RPG on, Rolls automatic) that has such a line is marked; a Re-read or an edit goes by the mark the reply
        // already has, so an older reply keeps the practice lines it was told with.
        if (readRecord(message)?.practiceRule === 'rolls') carrier.practiceRule = 'rolls';
        else if (base === null && lines.some(line => PRACTICE_LINE.test(line.raw ?? '')) && practiceFromRollsOnly(registry.featureOn?.(LEAN_RPG_FEATURE) === true, settings?.('story-block'))) {
            try { store.setPracticeRule?.(index); carrier.practiceRule = 'rolls'; } catch { /* an unmarked reply is judged as before */ }
        }
        // The foe level cap recorded with the reply: a new foe's guessed level may reach the party's highest + 20 (data-modules/part/act.js). A first live capture
        // marks the reply even without a foe line; a Re-read or an edit goes by the mark the reply has, so an older reply keeps its +10 cap.
        if (readRecord(message)?.foeCap === 20) carrier.foeCap = 20;
        else if (base === null && (blocked.first || (!blocked.foe && lines.some(line => foeLine(line, state)))) && typeof store.setFoeCap === 'function') {
            try { store.setFoeCap(index); carrier.foeCap = 20; } catch { /* an unmarked reply keeps the old cap */ }
        }
        // Rule marks (rule-marks.js): the first live capture gets all current marks; a Re-read goes by those it has (a module reads `ctx.carrier.rules`).
        const marks = ruleMarksOf(readRecord(message)?.rules), fresh = base === null ? (blocked.first ? allRuleNames() : ruleMarksFor(lines)).filter(name => !marks.includes(name) && !blocked.rules.includes(name)) : [];
        if (fresh.length && typeof store.setRuleMarks === 'function') { try { store.setRuleMarks(index, fresh); marks.push(...fresh); } catch { /* an unmarked reply keeps the old rule */ } }
        if (marks.length) carrier.rules = marks;
        if (assist && (marks.includes('assistPlace') || marks.includes('assistFaction'))) { carrier.assist = assist; carrier.assistLeft = []; const start = state; carrier.assistHas = (domain, table, id) => Object.hasOwn(start.domains?.[domain]?.[table] ?? {}, id); }
        const prior = carrier.assist && base === null && assist === NOW ? (readRecord(message)?.receipts ?? []) : [];
        const own = carrier.assist ? readBlock(index, extractBlock(String(message?.mes ?? ''), 'Changes', null, { heads: changeHeads() }) ?? '').lines : [];
        // The message right before the reply (system messages aside), and only when it is the reader's: a reply that
        // follows another reply has no message of the reader's to quote (proof, EVIDENCE.md).
        const before = (ctx?.chat ?? []).slice(0, index).findLast(item => !item?.is_system);
        const reader = before?.is_user ? before : null;
        const chat = { lastUser: String(reader?.mes ?? ''), reply: stripBlock(String(message?.mes ?? ''), 'Changes', { heads: changeHeads() }) };
        // A Re-read (a2-3): the reply as it stands now, for bookkeeping its kept blocks wrote (ctx.standing).
        let standing = null;
        if (base) { try { standing = store.at(index); } catch { standing = null; } }
        // (and what the reply's own receipts recorded, ctx.standingReceipts: the rows a join or a return seeded)
        const standingReceipts = base ? (readRecord(message)?.receipts ?? null) : null;
        // `shown`: how many lines of each display kind this reply has shown so far (their cap per reply).
        for (const line of lines) {
            const entry = registry.capture(line.kind);
            if (!entry) {
                const held = registry.captureOwner?.(line.kind); // declared but held back (dormant, restore): not an unknown kind
                found.push(problem(held ? { module: held, index, line: line.raw, code: 'MODULE_HELD', message: `"${line.raw}" was not used: ${held} is held back right now (dormant, or a restore is in progress).` }
                    : { index, line: line.raw, code: 'UNKNOWN_KIND', message: `No module keeps "${line.kind}", so "${line.raw}" was not used.` }));
                continue;
            }
            const mark = lineMark(line.raw);
            const seed = seeds?.(entry.kind, mark), kept = plan && seed !== undefined ? plan.reuse.receipt(`${CAPTURE_PREFIX}${entry.kind}`, mark) : undefined;
            if (carrier.assist) { carrier.assistLeft = assistDepartures([...prior, ...receipts]); carrier.assistCheck = seed === undefined ? (item, places) => assistPlaceConflict(item, own, places) : null; }
            // C3-4: a Re-read runs a line that made a change before (its receipt gives the seed) even
            // while its feature is off, so turning a feature off never takes away what it already did.
            const again = base !== null && seed !== undefined;
            // A kind whose feature the reader turned off (MODULES §F100): not an error, just not used.
            if (entry.off && !again) {
                const label = registry.feature?.(entry.feature)?.label ?? entry.feature;
                found.push(problem({ module: entry.moduleId, index, line: line.raw, code: 'FEATURE_OFF', quiet: true, message: `"${line.raw}" was not used: ${label} is turned off (feature off).` }));
                // B-a1-5: a display line told as not used stays unshown when the feature is turned on
                // later; a Re-read reads it again.
                if (entry.display) off.add(line.kind);
                continue;
            }
            // A display kind (Choices, Inner chatter; extras.js): read for the reader alone. No command
            // runs and nothing is stored; what is shown is read again from the reply's hidden block, by
            // the same rule (readDisplayLine), so only what the rule refuses is told here.
            if (entry.display) {
                const read = readDisplayLine(entry, line, shown);
                if (!read.ok) found.push(problem({ module: entry.moduleId, index, line: line.raw, code: read.code, message: `"${line.raw}" was not used: ${read.message}.` }));
                continue;
            }
            let result;
            try {
                const operation = { type: `${CAPTURE_PREFIX}${entry.kind}`, payload: { ...line, kind: entry.kind, word: line.kind } };
                const taking = plan ? occurrenceFor(plan, operation.type, operation.payload) : null;
                const run = opts => bus.run(operation.type, operation.payload, { cause: 'story', state, capture: entry, carrier: plan ? { ...carrier, ...(taking.span && (plan.preserveSources || occurrenceOf(taking.span) === null) ? { ordinal: taking.span.source.ordinal } : {}), pending: plan.pending, opsBefore: plan.blocks.reduce((sum, piece) => sum + (Number.isInteger(piece.n) ? piece.n : 0), 0) } : carrier, chat, standing, standingReceipts, ...(plan ? { planned: plan.blocks.flatMap(piece => piece.block?.evidence ?? []), replacing: plan.replacing, reusing: taking.span, ...(Number.isInteger(taking.value) ? { occurrence: taking.value } : {}) } : {}), ...(seed === undefined ? {} : { seed }), ...(kept ? { receiptId: kept } : {}), ...opts });
                result = entry.off ? await run({ capture: { ...entry, off: false }, again: true }) : await run();
                // Refused by a feature that is off (a command it called, ctx.feature): run as it ran before.
                if (again && !entry.off && result?.code === 'FEATURE_OFF') result = await run({ again: true });
                // The receipt remembers which line made it (`line`), so a Re-read can give the line its seed again.
                // The safety net's lines are marked as its (receipt `assist`: 'now' | 'late', and the line).
                if (result?.ok) result = { ...result, receipt: { ...result.receipt, line: mark, ...(assist ? { assist, assistLine: cutAt(line.raw, 200) } : {}) } };
                if (result?.ok && base) {
                    collected.push(...result.ops);
                    if (plan) {
                        plan.blocks.push({ n: result.ops.length, receipt: result.receipt, ...(result.block ? { block: result.block } : {}) });
                        if (result.block) {
                            plan.pending += 1;
                            if (taking.key) plan.reuse.commit(taking.key, result.block.occurrence);
                        }
                    }
                } else if (result?.ok) store.append({ ops: result.ops, receipt: result.receipt, ...(result.block ? { block: result.block } : {}) });
            } catch (error) {
                result = { ok: false, code: 'FAILED', message: error?.message ?? String(error) };
            }
            if (!result?.ok) {
                // A line refused because a feature the reader turned off answered it (another module's
                // command it called, MODULES §F100): listed quietly, like a line of a kind that is off.
                found.push(problem({ module: entry.moduleId, index, line: line.raw, code: result?.code ?? 'FAILED', message: result?.code === 'RECOVERY_REFUSED' ? result.message : `"${line.raw}" was not used: ${result?.message ?? 'unknown error'}`, ...(result?.code === 'FEATURE_OFF' ? { quiet: true } : {}) }));
                continue;
            }
            state = result.state ?? (base ? state : store.head());
            // The money guard (warns only; the line is applied): a repeated payment or one far above the purse.
            const warned = line.op === '+' ? moneyWarning(result.receipt, [...earlierReceipts(ctx?.chat, index), ...receipts], earlierReceipts(ctx?.chat, index, 1)) : null;
            if (warned) found.push(problem({ module: entry.moduleId, index, line: line.raw, code: 'LIMITED', message: warned }));
            receipts.push(result.receipt);
            // Used, but not all of it (a clamp): the owner says why, and that goes to the Problems list.
            if (typeof result.problem === 'string' && result.problem) found.push(problem({ module: entry.moduleId, index, line: line.raw, code: 'LIMITED', message: result.problem }));
            if (!base) events?.emit('committed', { receipt: result.receipt });
        }
        // What the safety net's lines met is marked as its in the Problems list.
        if (assist) {
            for (const item of found.slice(firstProblem)) {
                if (item.assist) continue;
                item.assist = assist;
                item.message = `(assist${assist === LATE ? ', from the previous reply' : ''}) ${item.message}`;
            }
        }
        return { ops: collected, off: [...off], state };
    }

    return { captureEach };
}
