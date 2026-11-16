// Asks a recorded condition again on a guard's prefix and says whether the answer is the one recorded.
import { dmObject } from '../schema.js';
import { refuse } from './errors.js';
import { atPath } from './values.js';
import { entryAddProblem } from './entry-lists.js';
import { createEvaluation } from './evaluation.js';

/**
 * A guard asking a recorded condition again on its prefix: the same expression of the frozen definition, the recorded arguments, the
 * prefix's fields for everything the root had not written itself and the recorded value for what it had. Pure and bounded.
 * → true when the answer is the one recorded. Throws a DataModuleError when the condition cannot be evaluated (the guard then fails closed).
 */
export function conditionHolds(definition, record, prefixFields, inputs = {}) {
    const [kind, name] = Array.isArray(record?.ref) ? record.ref : [];
    // An entry added to a List of entries asked whether the list has room and no entry has its title.
    if (kind === 'entryAdd') {
        if (definition.state?.[name]?.type !== 'entries' || typeof record.outcome !== 'boolean' || !dmObject(record.env)) refuse('DM_SCHEMA', '', 'A recorded condition is damaged.');
        return (entryAddProblem(definition, name, Array.isArray(prefixFields?.[name]) ? prefixFields[name] : [], record.env.arg) === null) === record.outcome;
    }
    const expression = kind === 'kind' ? definition.kinds?.[name]?.when : kind === 'rule' ? definition.rules?.find(rule => rule.id === name)?.when
        : kind === 'reward' ? definition.rewards?.[name]?.when : kind === 'reply-end' ? definition.replyEnd?.[name]?.when : undefined;
    if (expression === undefined || !dmObject(record.internal) || typeof record.outcome !== 'boolean') refuse('DM_SCHEMA', '', 'A recorded condition is damaged.');
    const evaluation = createEvaluation(definition, { fields: prefixFields, timers: {}, offers: {}, settled: {} }, {
        inputs, lookup: (path, key) => (Object.hasOwn(record.internal, key) ? record.internal[key] : atPath(prefixFields, path)),
    });
    return (typeof expression === 'boolean' ? expression : Boolean(evaluation.evaluate(expression, record.env ?? {}))) === record.outcome;
}
