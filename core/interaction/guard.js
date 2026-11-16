// Checks an interaction settle's replay guard against the state before its block; features do not turn it off.

import { CORE_MODULE_ID } from '../../modules/scene/domains/core/constants.js';
import { guardProblem } from '../replay.js';
import { interactionError } from './contract.js';
import { kindName } from './kind-name.js';
import { settlePayloadProblem } from './settle.js';

const HASH = /^[0-9a-f]{64}$/u;
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const notReady = (title) => ({ ok: false, code: 'NOT_READY', reason: interactionError('NOT_READY', title).message });
const bad = (title, detail = null, code = 'DAMAGED') => ({ ok: false, code, reason: interactionError(code, title, detail).message });

function predicateProblem(predicate) {
    if (!plain(predicate) || predicate.kind !== 'interaction') return true;
    if (!text(predicate.id) || !text(predicate.key)) return true;
    if (!Number.isSafeInteger(predicate.v) || predicate.v < 1) return true;
    if (!HASH.test(String(predicate.setup ?? ''))) return true;
    if (predicate.prior !== undefined && !HASH.test(String(predicate.prior ?? ''))) return true;
    return Object.keys(predicate).some(key => !['kind', 'id', 'v', 'key', 'setup', 'prior'].includes(key));
}

function matchesPayload(predicate, payload) {
    if (predicate.id !== payload.kindId || predicate.v !== payload.version || predicate.key !== payload.key) return false;
    if (predicate.prior !== payload.prior) return false;
    return true;
}

/**
 * The core's `hooks.replayGuard` answer for `predicate.kind === 'interaction'`. `kindOf` is the registered
 * kind or `kindId => kind`; `view` is `{ state, hash }` and `info` is the stored guard, source and payload.
 */
export function interactionGuard(view, info, kindOf) {
    const guard = info?.guard, payload = info?.recorded, predicate = guard?.predicate;
    const kindId = String(predicate?.id ?? payload?.kindId ?? '');
    let kind = null;
    try { kind = typeof kindOf === 'function' ? kindOf(kindId) : kindOf; } catch { kind = null; }
    const title = kindName(kind, kindId);
    const problem = guardProblem(guard);
    if (problem) return bad(title, `The saved ${title} is damaged: ${problem}.`);
    if (guard.owner !== CORE_MODULE_ID || guard.rulesHash !== null || predicateProblem(predicate)) return bad(title);
    if (!plain(payload)) return bad(title);
    if (!plain(kind)) return notReady(title);
    let ready = false;
    try { ready = typeof kind.ready === 'function' && kind.ready() === true; } catch { ready = false; }
    if (!ready || typeof kind.witness !== 'function') return notReady(title);
    const shape = settlePayloadProblem(payload, kind);
    if (shape) return bad(title, shape.message);
    if (!matchesPayload(predicate, payload)) return bad(title);
    if (typeof view?.hash !== 'function') return bad(title);
    if (predicate.setup !== view.hash(payload)) return bad(title);

    let witness;
    try { witness = kind.witness(view.state, payload.setup); } catch { return bad(title); }
    if (view.hash({ source: info?.source, predicate, witness }) !== guard.inputHash) {
        return bad(title, interactionError('CHANGED', title).message, 'CHANGED');
    }
    return { ok: true };
}
