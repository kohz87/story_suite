// Applies practice to the found slots and undoes the narrator's own practice on them.
import { createEvaluation } from '../../../packages/story-block/src/v2/data-modules/interpreter.js';
import { PRACTICE } from '../names.js';
import { fold } from '../read.js';
import { isObject, whole } from './shared-values.js';
import { fromOf } from './slots.js';

/** Said once in a reply where the narrator wrote practice for a skill its rolls used (a Problems line). */
export const PRACTICE_HELD = 'Practice for skills used in rolls is given by code; the narrator\'s practice line was not used.';

// Apply practice to the slots found before the guarded step; also undo the narrator's practice on those same slots.
export function givePractice(ctx, domain, items, perUse, spent = []) {
    if (!items.length) return [];
    const from = fromOf(domain, ctx.source);
    const draft = ctx.draft('dataModules');
    const skills = [];
    for (const item of items) {
        const definition = draft.pins?.[draft.active?.[item.module]?.hash]?.definition;
        const instance = draft.instances?.[item.module]?.chat;
        const fields = instance?.fields;
        if (!isObject(fields) || !whole(fields[`practice${item.slot}`])) continue;
        const paid = spent.find(entry => fold(entry.who) === fold(item.who) && fold(entry.skill) === fold(item.skill))?.amount ?? 0;
        // A fight step already restored this slot before paying it; do not erase that payment.
        const was = paid ? null : from[item.module]?.[String(item.slot)];
        // What the narrator added for this skill in this reply (its practice, and the rank it rose to) is not used.
        const held = Boolean(was) && (fields[`practice${item.slot}`] !== was.practice || fields[`rank${item.slot}`] !== was.rank);
        const amount = Math.min(PRACTICE.max - paid, perUse * item.n);
        if (amount <= 0 && !held) continue;
        if (isObject(definition?.state) && Array.isArray(definition.rules)) {
            const evaluation = createEvaluation(definition, instance, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
            if (held) evaluation.effects([{ op: 'set', path: [`practice${item.slot}`], value: was.practice }, { op: 'set', path: [`rank${item.slot}`], value: was.rank }]);
            evaluation.effects([{ op: 'add', path: [`practice${item.slot}`], value: amount, bounds: 'clamp' }]);
            evaluation.rules();
            evaluation.finish();
        } else {
            // A bare block (no pinned rules to run): practice only, held to 0–100.
            if (held) { fields[`practice${item.slot}`] = was.practice; fields[`rank${item.slot}`] = was.rank; }
            fields[`practice${item.slot}`] = Math.max(0, Math.min(100, fields[`practice${item.slot}`] + amount));
        }
        if (amount > 0) skills.push({ who: item.who, skill: item.skill, slot: item.slot, amount, ...(held ? { held: true } : {}) });
    }
    return skills;
}
