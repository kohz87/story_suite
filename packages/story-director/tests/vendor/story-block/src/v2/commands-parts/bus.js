// The command bus: createCommandBus, with its transactions, previews, commits and runs.
import { apply } from '../ops.js';
import { operationKey } from '../evidence.js';
import { seed as freshSeed } from '../rng.js';
import { MAX_DEPTH, MAX_PREVIEWS, CommandError, asCommandError, fail, headReply, newId, replyAt } from '../commands/shared.js';
import { createStateTools } from '../commands/state.js';
import { createGuards } from '../commands/guards.js';
import { createCtxTools } from '../commands/ctx.js';
import { createTransact } from '../commands/transact.js';

/**
 * createCommandBus({ store, registry, settings, onCommitted?, id?, seed? })
 * `store` and `registry` as in SPEC §12; `settings(moduleId)` → that module's settings object;
 * `onCommitted({ receipt, ops })` runs after each commit; `id(prefix)` and `seed()` replace the crypto
 * sources (tests).
 */
export function createCommandBus({ store, registry, settings = () => ({}), onCommitted = null, id = newId, seed = freshSeed } = {}) {
    const previews = new Map();
    let previewCount = 0;
    let commitGuard = null;

    // `again` (a Re-read of a line that made a change before, turn.js): its features are not checked.
    function resolve(type, again = false) {
        // A module held back (dormant, or a restore is pending; registry.refusal) is refused with its reason, at
        // the top, through ctx.call and on commit; like UNKNOWN_COMMAND nothing has run, so a caller may catch it.
        const held = typeof type === 'string' && type && typeof registry.refusal === 'function' ? registry.refusal(type) : null;
        if (held) fail(held.code, held.message);
        const handler = typeof type === 'string' && type ? registry.command(type) : null;
        const moduleId = typeof handler === 'function' ? registry.commandOwner(type) : null;
        if (typeof handler !== 'function' || !moduleId) fail('UNKNOWN_COMMAND', `There is no command called "${type}".`);
        const feature = typeof registry.commandFeature === 'function' ? registry.commandFeature(type) : null;
        if (feature && !again && !featureOn(feature)) featureOff(type, feature);
        return { moduleId, handler };
    }

    const featureOn = id => typeof registry.featureOn === 'function' && registry.featureOn(id) === true;
    function featureOff(type, feature) {
        const label = registry.feature?.(feature)?.label ?? feature;
        fail('FEATURE_OFF', `"${type}" is part of ${label}, which is turned off in the Features settings.`);
    }

    // Internal commands (registry.js) are the host's own steps: never with cause 'ui'.
    const internal = type => typeof registry.isInternal === 'function' && registry.isInternal(type);
    const internalMessage = type => `"${type}" is a step Story Block takes itself (a change line, a module's set-up or an event); a button, screen or module action cannot run it.`;

    function findQuery(name) {
        if (typeof registry.query === 'function') {
            const fn = registry.query(name);
            if (typeof fn === 'function') return fn;
        }
        for (const def of registry.modules?.() ?? []) {
            const fn = def?.queries?.[name];
            if (typeof fn === 'function' && fn.enabled !== false) return fn;
        }
        return null;
    }

    // What a block is for the ids of its proof: its command and line, and its occurrence among the blocks of its reply that did the same
    // (given once and kept in the block's span: the caller that plans a block again passes the one it has, else the reply's next unused
    // one). Two blocks of a reply differ in it.
    function originOf(tx) {
        if (tx.origin === null) {
            try { tx.operation = operationKey(tx.call.type, tx.call.payload); } catch { tx.operation = null; }
            // (never invented here: the caller that plans a block gives it, else the store's allocator does; with neither the proof is refused)
            let rank = tx.occurrence;
            if (rank === null) {
                try { rank = Number.isInteger(tx.reply?.index) && tx.operation ? store.allocateOccurrence?.(tx.reply.index, tx.operation) : null; } catch { rank = null; }
            }
            if (!Number.isInteger(rank) || rank < 0) throw new Error('No occurrence could be given to this proof.');
            tx.rank = rank;
            tx.origin = `${tx.operation}:${rank}`;
        }
        return tx.origin;
    }

    const stateTools = createStateTools({ store, findQuery, fail, originOf });
    const { draftOf, metaOf, readOf, currentState, queryTools, sourceOf, cursorOf, giveProof } = stateTools;
    const { guardHook, replayGuardCheck, guardMark } = createGuards({ registry, findQuery });
    if (typeof store.attachGuard === 'function') store.attachGuard(replayGuardCheck, guardMark);
    const { makeCtx, invoke } = createCtxTools({
        registry, settings, resolve, featureOn, internal, internalMessage, findQuery, guardHook,
        sourceOf, cursorOf, currentState, queryTools, readOf, draftOf, metaOf, giveProof,
    });
    const transact = createTransact({ store, registry, resolve, internal, internalMessage, featureOff, invoke, currentState, sourceOf, originOf });

    // ---- storing ------------------------------------------------------------------------------

    function storeResult(ops, receipt, block = null) {
        if (commitGuard) {
            const refused = commitGuard(() => apply(store.head(), ops), receipt);
            if (refused) return { ok: false, code: 'REPLY_BUSY', message: refused };
        }
        try {
            store.append({ ops, receipt, ...(block ? { block } : {}) });
        } catch (error) {
            return { ok: false, code: 'FAILED', message: `The change could not be stored: ${error?.message ?? error}` };
        }
        store.scheduleSave();
        if (typeof onCommitted === 'function') {
            try {
                onCommitted({ receipt, ops });
            } catch (error) {
                console.warn('[Story Block] A committed listener failed:', error);
            }
        }
        return { ok: true, receipt };
    }

    function fresh(cause, seedValue) {
        return { cause, seed: seedValue ?? seed(), receiptId: id('rc') };
    }

    function guarded(fn) {
        try {
            return fn();
        } catch (error) {
            const reason = asCommandError('the command bus', error);
            return { ok: false, code: reason.code, message: reason.message };
        }
    }

    function fingerprint(head) {
        return { rev: head?.meta?.rev, index: store.headIndex?.(), json: JSON.stringify(head) };
    }

    // C3-3: which declared features are on, so a preview taken before the reader turned one off (or on)
    // is not committed as it was: the handler, or a command it called, may have read it.
    const featureMarks = () => (typeof registry.features === 'function' ? registry.features() : [])
        .map(feature => `${feature.id}:${featureOn(feature.id) ? 1 : 0}`).join(',');

    return {
        /** Host-only guard for edits that would change an in-flight reply's inputs. */
        setCommitGuard(fn) { commitGuard = typeof fn === 'function' ? fn : null; },
        /** command(type, payload, { cause = 'ui' }) → { ok: true, receipt } | { ok: false, code, message } */
        command(type, payload, { cause = 'ui' } = {}) {
            return guarded(() => {
                const result = transact(store.head(), type, payload, fresh(cause));
                return result.ok ? storeResult(result.ops, result.receipt, result.block) : result;
            });
        },

        /** preview(type, payload) → { ok: true, receipt, token, ops }: the handler's result, nothing stored. */
        preview(type, payload, { cause = 'ui' } = {}) {
            return guarded(() => {
                const head = store.head();
                const result = transact(head, type, payload, fresh(cause));
                if (!result.ok) return result;
                const token = `pv_${++previewCount}`;
                previews.set(token, { type, ops: result.ops, receipt: result.receipt, block: result.block ?? null, seen: fingerprint(head), features: featureMarks() });
                while (previews.size > MAX_PREVIEWS) previews.delete(previews.keys().next().value);
                return { ok: true, receipt: result.receipt, token, ops: result.ops };
            });
        },

        /**
         * commit(token): stores exactly what the preview showed, or STALE when the head moved since.
         * The command's feature is checked again (FEATURE_OFF), and a preview from before any feature
         * was turned on or off is STALE.
         */
        commit(token) {
            return guarded(() => {
                const saved = previews.get(token);
                if (!saved) return { ok: false, code: 'NOT_FOUND', message: 'That preview is gone; try the action again.' };
                previews.delete(token);
                resolve(saved.type);
                if (featureMarks() !== saved.features) {
                    return { ok: false, code: 'STALE', message: 'A feature was turned on or off since this preview; try the action again.' };
                }
                const now = fingerprint(store.head());
                if (now.rev !== saved.seen.rev || now.index !== saved.seen.index || now.json !== saved.seen.json) {
                    return { ok: false, code: 'STALE', message: 'The story changed since this preview; try the action again.' };
                }
                return storeResult(saved.ops, saved.receipt, saved.block);
            });
        },

        /**
         * run(type, payload, { cause = 'story', seed, state, capture }) → { ok, ops, receipt, state }:
         * the command's result without storing it (capture). `state` is the state to run against
         * (default: the head), so lines of one reply can chain; `capture` = registry.capture(kind)'s
         * { moduleId, apply } runs that capture handler as command `type`; `carrier` ({ index, swipe, sid? })
         * and `chat` ({ lastUser, reply }) become ctx.carrier and ctx.chat. `again` (story only): a Re-read
         * of a line that made a change before, run with its features as on (C3-4). `standing` (story only): a
         * Re-read's reply state as it stood before it, ctx.standing (a2-3). `reply` ({ index, sid }, system only):
         * ctx.reply for a step kept on a reply that is not the head (a Re-read's afterCapture and replan steps).
         * `carrier` and `reply` may also say `pending` (guarded blocks a Re-read has planned before this one) or
         * `ordinal` (this block's own, when it is planned again): only ctx.source's ordinal follows them. `planned`
         * (the Proofs the lines of a Re-read have given so far): parents and story.evidence see them like stored ones.
         * `replacing` (the proof of the blocks being replaced): a proof of the same kind and key at the same place among those keeps the id of its old one.
         * A guarded transaction's result has a `block` too (REPLAY.md), which store.append or replaceStory keeps.
         */
        run(type, payload, { cause = 'story', seed: seedValue, state, capture, carrier = null, chat = null, again = false, standing = null, standingReceipts = null, reply = null, planned = null, replacing = null, occurrence = null, reusing = null, receiptsBefore = null, receiptId = null } = {}) {
            return guarded(() => transact(state ?? store.head(), type, payload, { ...fresh(cause, seedValue), ...(typeof receiptId === 'string' ? { receiptId } : {}), capture, carrier, chat, again: again === true && cause === 'story', standing, standingReceipts, reply, planned, replacing, occurrence, reusing, receiptsBefore }));
        },
    };
}
