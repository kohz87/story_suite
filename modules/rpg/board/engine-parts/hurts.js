// Writes foe hurts and clears ended fights' groups on the Foes block, and collapses member moves.
import { createEvaluation } from '../../../../packages/story-block/src/v2/data-modules/interpreter.js';
import { memberSize } from '../members.js';

export function applyHurts(domain, hurts) {
    for (const hurt of hurts) {
        const fields = domain?.instances?.[hurt.module]?.chat?.fields;
        if (fields && Object.hasOwn(fields, hurt.field)) fields[hurt.field] = hurt.to;
    }
}

/**
 * The foe-clear mark (`setup.foesClear = 1`, set on a fight opened under it): when the board fight has ended (won, lost or fled) its groups
 * are cleared from the Foes block, by the block's own `clear-N` kind (its effects and rules, as open.js clears a stale Down group), so no beaten or fled foe stands on for the
 * next message. Returns the slots cleared; a slot that was empty is left alone.
 */
export function clearFoes(domain, foes, groups) {
    const done = [];
    for (const foe of foes ?? []) {
        if (!foe.filled || !groups.includes(foe.slot)) continue;
        const n = foe.local ?? (((foe.slot - 1) % 4) + 1);
        const instance = domain?.instances?.[foe.module]?.chat;
        if (!instance?.fields) continue;
        // (as the stale-Down clear in open.js: the block's own clear kind with its rules, else its four fields)
        const definition = domain?.pins?.[domain?.active?.[foe.module]?.hash]?.definition;
        const kind = definition?.kinds?.[`clear-${n}`];
        if (kind?.effects && definition.state) {
            const evaluation = createEvaluation(definition, instance, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
            evaluation.effects(kind.effects, { arg: { why: 'gone' } });
            evaluation.rules();
            evaluation.finish();
        } else Object.assign(instance.fields, { [`foe${n}`]: '', [`count${n}`]: 0, [`hurt${n}`]: 5 });
        done.push(foe.slot);
    }
    return done;
}

const foeField = (prefix, foe) => `${prefix}${foe?.local ?? (((foe?.slot ?? 1) - 1) % 4) + 1}`;

// A member fight keeps its bars as virtual foes, so only the final ordinary count/hurt moves are written to the Foes block.
export function collapseMoves(realFoes, changes, maxOf) {
    const bySlot = new Map(realFoes.map(foe => [foe.slot, foe])), out = [];
    for (const change of changes) {
        const real = bySlot.get(change.slot);
        if (!real) continue;
        const id = `f:${change.slot}`;
        if (change.count.from !== change.count.to) out.push({ id, kind: 'foe', name: real.name, module: change.module,
            field: foeField('count', real), from: change.count.from, to: change.count.to });
        if (change.hurt.from !== change.hurt.to) out.push({ id, kind: 'foe', name: real.name, module: change.module,
            field: foeField('hurt', real), from: change.hurt.from, to: change.hurt.to, size: memberSize(real, maxOf) });
    }
    return out;
}
