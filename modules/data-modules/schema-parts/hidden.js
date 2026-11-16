// Hidden fields (`prompt: false`) and where a kind writes, for the hidden-write check.
import { dmObject } from './checks.js';

/** A field the narrator may not set (`prompt: false`): left out of the tail and the grammar. */
export const dmHidden = schema => dmObject(schema) && schema.prompt === false;

/**
 * Where a kind writes: the root field names of its effects (and of the effects of the reward templates it names), and whether
 * any path is computed (then it could be any field). Tolerates a definition that has not been checked.
 */
export function dmKindWrites(definition, kind) {
    const fields = new Set();
    let computed = false;
    const visit = (list, seen = new Set()) => {
        for (const effect of Array.isArray(list) ? list : []) {
            if (!dmObject(effect)) continue;
            if (['set', 'add', 'clamp'].includes(effect.op)) {
                if (Array.isArray(effect.path) && typeof effect.path[0] === 'string') fields.add(effect.path[0]);
                else computed = true;
            } else if ((effect.op === 'reward' || effect.op === 'offer') && typeof effect.template === 'string' && !seen.has(effect.template)) {
                seen.add(effect.template);
                visit(definition?.rewards?.[effect.template]?.effects, seen);
            }
        }
    };
    visit(kind?.effects);
    return { fields, computed };
}

/** Whether a kind writes a hidden field (or might, through a computed path while some field is hidden). */
export function dmKindWritesHidden(definition, kind) {
    const state = dmObject(definition?.state) ? definition.state : {};
    const anyHidden = Object.values(state).some(dmHidden);
    if (!anyHidden) return false;
    const { fields, computed } = dmKindWrites(definition, kind);
    return computed || [...fields].some(name => dmHidden(state[name]));
}
