// Story Suite v2: the afterCapture steps, moved out of createCaptureFlow unchanged: once a reply's story lines have run, each module's afterCapture hook
// may return commands that run as system steps on the scene the reply ended up in (stored live, or planned by a Re-read).
// `createCaptureAfter(deps)` is given the turn parts it uses; it never imports turn.js.
import { makeView } from '../sdk.js';
import { receiptWithCue } from '../lean-rpg/cue.js';
import { HOST_MODULE } from '../registry.js';
import { within, TIMED_OUT } from './text.js';
import { occurrenceOf } from '../evidence.js';
import { occurrenceFor } from './capture-seeds.js';

export function createCaptureAfter(deps) {
    const { ctx, store, bus, registry, settings, events, view, viewReader, problem, holdBoard, HOOK_TIMEOUT_MS } = deps;
    /**
     * afterCapture (SPEC §4.2 step 3): once the reply's story lines have run, each module's
     * `afterCapture(view, { index, type })` hook may return `{ commands: [{ type, payload }] }` to run as
     * `system` steps on the scene the reply ended up in (a turn-in its line read before the reply's own
     * `~ place` line). A step is stored on the reply right after its story lines, as part of that reply, its
     * receipt marked `afterCapture` (and `replan`), so a swipe or delete of the reply takes it back and a
     * Re-read runs the hook again on the new story lines. A Continue runs it again after the Continue's
     * lines. A hook that fails or takes longer than HOOK_TIMEOUT_MS, or a step that is refused, is a Problem.
     * Live (no `state`): each step is appended to the head as it runs. A Re-read passes `state` (the reply's
     * state after its new story lines), `reply` and `seeds` (the old steps' seeds by type, in order): nothing
     * is stored, and the steps come back as [{ ops, receipt, block? }] for store.replaceStory (`block`: what a
     * guarded step hands over, REPLAY.md; `plan` counts the guarded blocks the Re-read has planned so far, so
     * each gets its own ordinal). The same runner stores Assist's seeded pre-roll prelude with
     * `beforeGenerate: true`; Re-read plans that prelude before the story lines and replaces it too.
     */
    async function afterCapture(index, { type = 'normal', problems = [], state = null, reply = null, seeds = null, plan = null, prechecks = [], onlyPrechecks = false, alwaysOnly = false } = {}) {
        const steps = [];
        const live = state === null;
        let now = live ? store.head() : state;
        // A Re-read has stored nothing yet: the proof its lines and earlier steps planned is what the hooks and steps see.
        const planned = () => (live || !plan ? [] : [...plan.blocks.flatMap(piece => piece.block?.evidence ?? []), ...steps.flatMap(step => step.block?.evidence ?? [])]);
        // The reply's own receipts as far as this run knows them (`info.receipts`, read only when a hook asks): the store's for a live reply, a Re-read's planned ones.
        const replyReceipts = () => (live ? (store.receipts?.() ?? []).filter(entry => entry.index === index).map(entry => entry.receipt) : [...(plan?.blocks ?? []).map(piece => piece.receipt), ...steps.map(step => step.receipt)].filter(Boolean)).map(receiptWithCue);
        const previousReceipts = () => (live ? [] : (store.receipts?.() ?? []).filter(entry => entry.index === index).map(entry => entry.receipt)); // `info.previous` (a Re-read): the reply's stored receipts, still the old ones
        const hooks = [
            ...(prechecks.length ? [{ moduleId: HOST_MODULE, precheck: true, fn: () => ({ commands: prechecks }) }] : []),
            ...(onlyPrechecks ? [] : registry.hookEntries('afterCapture').filter(entry => !alwaysOnly || entry.fn.always === true)),
        ];
        for (const { moduleId, fn, precheck = false } of hooks) {
            const seen = live ? view() : makeView({ store, registry, settings, chat: ctx?.chat, active: viewReader, state: now, reply, pendingProofs: () => planned().map(proof => ({ proof, block: null })) });
            let out;
            try { out = await within(fn(seen, Object.defineProperties({ index, type, ...(alwaysOnly ? { always: true } : {}) }, { receipts: { get: replyReceipts }, previous: { get: previousReceipts } })), HOOK_TIMEOUT_MS); } catch (error) {
                problems.push(problem({ module: moduleId, index, code: 'FAILED', message: `afterCapture failed: ${error?.message ?? error}` }));
                continue;
            }
            if (out === TIMED_OUT) {
                problems.push(problem({ module: moduleId, index, code: 'TIMEOUT', message: `afterCapture did not answer within ${HOOK_TIMEOUT_MS / 1000} s; its steps after the reply's lines were not run.` }));
                continue;
            }
            for (const command of Array.isArray(out?.commands) ? out.commands : []) {
                const payload = command?.payload ?? {};
                const seed = command.seed ?? seeds?.(command?.type), kept = plan && seed !== undefined ? plan.reuse.stepReceipt(command?.type) : undefined;
                const taking = plan ? occurrenceFor(plan, command?.type, payload) : null;
                const result = bus.run(command?.type, payload, { cause: 'system', state: live ? store.head() : now, ...(reply ? { reply: plan ? { ...reply, ...(taking.span && (plan.preserveSources || occurrenceOf(taking.span) === null) ? { ordinal: taking.span.source.ordinal } : {}), pending: plan.pending, opsBefore: plan.blocks.reduce((sum, piece) => sum + (Number.isInteger(piece.n) ? piece.n : 0), 0) + steps.reduce((sum, step) => sum + (Array.isArray(step.ops) ? step.ops.length : 0), 0) } : reply } : {}), ...(plan ? { planned: planned(), replacing: plan.replacing, reusing: taking.span, ...(Number.isInteger(taking.value) ? { occurrence: taking.value } : {}) } : {}), ...(seed === undefined ? {} : { seed }), ...(kept ? { receiptId: kept } : {}) });
                if (!result?.ok) {
                    problems.push(problem({ module: moduleId, index, code: result?.code ?? 'FAILED', message: `The step "${command?.type}" after the reply's lines was not run: ${result?.message ?? 'unknown error'}` }));
                    if (precheck && command?.type === 'rpg.resolve' && payload?.board) throw holdBoard(result?.message);
                    continue;
                }
                // Done, but not all of what was asked (a clamp, a line of the story that was not used): the step says why, and it goes to the Problems list.
                if (typeof result.problem === 'string' && result.problem) problems.push(problem({ module: moduleId, index, code: 'LIMITED', message: result.problem }));
                let replan = result.receipt.replan;
                if (!replan) { try { replan = { payload: structuredClone(payload) }; } catch { replan = undefined; } }
                const receipt = { ...result.receipt, afterCapture: true, ...(precheck ? { beforeGenerate: true } : {}), ...(replan ? { replan } : {}) };
                if (live) {
                    store.append({ ops: result.ops, receipt, ...(result.block ? { block: result.block } : {}) });
                    now = store.head();
                    events?.emit('committed', { receipt });
                } else {
                    now = result.state;
                    if (result.block && plan) {
                        plan.pending += 1;
                        if (taking.key) plan.reuse.commit(taking.key, result.block.occurrence);
                    }
                }
                steps.push({ ops: result.ops, receipt, state: now, ...(result.block ? { block: result.block } : {}) });
            }
        }
        return steps;
    }

    return { afterCapture };
}
