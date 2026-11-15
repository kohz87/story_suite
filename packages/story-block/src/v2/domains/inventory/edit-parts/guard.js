// The replay guard of a reader edit: recording it and judging it again on a Re-read.

import { isPlainObject } from '../../common.js';
import { E } from '../stacks.js';
import { editPieces, addDecision, renameDecision } from './witness.js';

export const INVENTORY_EDIT_GUARD = 'inventory.reader-edit';

// A reader action is a guarded ordinary command. If a later Re-read makes its saved ops
// invalid, the existing replay machinery can leave just this action off and report it.
export function guardReaderEdit(ctx, action, target = null, pieces = null, decision = null) {
    if (ctx.cause !== 'ui' || ctx.caller !== null || typeof ctx.replayGuard !== 'function' || !ctx.source) return;
    const predicate = { kind: INVENTORY_EDIT_GUARD, action, ...(target ? { target } : {}), ...(pieces ? { pieces: ctx.hash(pieces) } : {}),
        ...(decision ? { decision: { ...decision, witness: ctx.hash(decision.witness) } } : {}) };
    ctx.replayGuard({ owner: 'story-block', version: 2, epoch: ctx.epoch, rulesHash: null,
        inputHash: ctx.hash({ predicate, source: ctx.source }), predicate });
}

export function inventoryEditGuard({ state, hash }, { guard, source, operation }) {
    const p = guard?.predicate;
    const bad = { ok: false, reason: E.itemEditDamaged };
    if (guard?.owner !== 'story-block' || guard.version !== 2 || guard.rulesHash !== null
        || !isPlainObject(p) || p.kind !== INVENTORY_EDIT_GUARD
        || !['inventory.add', 'inventory.edit', 'inventory.drop'].includes(p.action)
        || operation?.type !== p.action || Object.keys(p).some(key => !['kind', 'action', 'target', 'pieces', 'decision'].includes(key))
        || hash({ predicate: p, source }) !== guard.inputHash) return bad;
    const inventory = state?.domains?.inventory;
    if (p.decision !== undefined) {
        const d = p.decision, payload = operation?.payload;
        if (!isPlainObject(d) || !inventory || !isPlainObject(payload) || typeof payload.name !== 'string'
            || typeof d.witness !== 'string' || !/^[a-f0-9]{64}$/.test(d.witness)) return bad;
        let witness;
        if (p.action === 'inventory.add' && Object.keys(d).length === 2 && typeof d.def === 'string') {
            witness = addDecision(inventory, payload, d.def);
        } else if (p.action === 'inventory.edit' && (Object.keys(d).length === 1 || (Object.keys(d).length === 2 && d.story === 1)) && inventory.stacks?.[payload.stack]
            && inventory.defs?.[inventory.stacks[payload.stack].def]) {
            witness = renameDecision(inventory, inventory.stacks[payload.stack], payload, d.story === 1);
        } else return bad;
        if (hash(witness) !== d.witness) return { ok: false, reason: E.itemDecisionChanged };
    }
    // Earlier saved guards did not have a decision witness; keep their existing replay behavior.
    if (p.action === 'inventory.add') return p.target === undefined && p.pieces === undefined ? { ok: true } : bad;
    if (!isPlainObject(p.target) || Object.keys(p.target).length !== 3
        || typeof p.target.id !== 'string' || p.target.id !== operation?.payload?.stack
        || typeof p.target.def !== 'string' || typeof p.target.owner !== 'string') return bad;
    const stack = inventory?.stacks?.[p.target.id];
    if (!stack || stack.def !== p.target.def || stack.owner !== p.target.owner || !inventory?.defs?.[stack.def]) {
        return { ok: false, reason: E.itemEditGone };
    }
    if (p.pieces !== undefined && (p.action !== 'inventory.edit' || operation?.payload?.group !== true
        || !(Array.isArray(p.pieces) || (typeof p.pieces === 'string' && /^[a-f0-9]{64}$/.test(p.pieces))))) return bad;
    const piecesHash = Array.isArray(p.pieces) ? hash(p.pieces) : p.pieces;
    if (p.pieces !== undefined && hash(editPieces(inventory, p.target)) !== piecesHash) {
        return { ok: false, reason: E.itemPiecesChanged };
    }
    return { ok: true };
}
