// Completes a step with deterministic code-played inputs and refuses stored inputs for actors the reader may not choose.

import { interactionError } from './contract.js';
import { policyProblem } from './policy.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clone = value => structuredClone(value);
// Derived actors share one stream per step: lane 63, position = the actor's index, so the engine's lane/at are ignored.
const namedAutoDice = (source, actorIndex) => (lane, at, sides = 20) => source(63, actorIndex, sides);

const titleOf = kind => String(kind?.title ?? 'interaction').trim() || 'interaction';
const bad = (kind, detail) => ({ error: interactionError('INVALID', titleOf(kind), detail) });

/** One step with its stored inputs checked and every code-played actor completed; derived inputs are returned, never stored. */
export function deriveStep({ kind, kindId, state, setup, steps = [], step, actors = [], policy, dice, number = 0 } = {}) {
    if (!plain(step) || !Array.isArray(step.inputs)) return bad(kind, 'The step has no inputs.');
    if (!actors.some(actor => actor?.player === true)) {
        const problem = policyProblem(policy, kindId, actors, { actor: 'player' });
        if (problem) return { error: problem };
    }
    const inputs = clone(step.inputs);
    for (const input of inputs) {
        const problem = policyProblem(policy, kindId, actors, input);
        if (problem) return { error: problem };
    }
    const derived = [], chosen = new Set(inputs.map(input => String(input?.actor ?? '')));
    if (typeof kind?.auto !== 'function') return { step: { ...clone(step), inputs }, derived };
    const source = typeof dice === 'function' ? dice(number) : null;
    for (let index = 0; index < actors.length; index += 1) {
        const actor = actors[index];
        const id = String(actor?.id ?? '');
        if (!id || chosen.has(id)) continue;
        if (!policyProblem(policy, kindId, actors, { actor: id })) continue;
        if (!source || typeof source !== 'function') return bad(kind, 'The step has no dice.');
        let input;
        try {
            input = kind.auto(state, setup, steps, id, namedAutoDice(source, index));
        } catch (error) {
            return bad(kind, `${titleOf(kind)} could not choose for ${String(actor?.name ?? id)}: ${error?.message ?? error}`);
        }
        if (!plain(input)) return bad(kind, `${titleOf(kind)} did not choose for ${String(actor?.name ?? id)}.`);
        if (input.actor !== undefined && String(input.actor) !== id) return bad(kind, `${titleOf(kind)} chose for the wrong actor.`);
        input = { ...clone(input), actor: id };
        if (typeof input.choice !== 'string' || !input.choice.trim()) return bad(kind, `${titleOf(kind)} chose nothing for ${String(actor?.name ?? id)}.`);
        derived.push(input);
        inputs.push(input);
        chosen.add(id);
    }
    return { step: { ...clone(step), inputs }, derived };
}

/** Each stored step with its derived inputs completed in order, for play, preview, settle and every replay. */
export function deriveSteps({ kind, kindId, state, setup, steps = [], actors = [], policy, dice } = {}) {
    const out = [], derived = [];
    for (let index = 0; index < steps.length; index += 1) {
        const got = deriveStep({ kind, kindId, state, setup, steps: out, step: steps[index], actors, policy, dice, number: index });
        if (got.error) return got;
        out.push(got.step);
        derived.push(...got.derived);
    }
    return { steps: out, derived };
}
