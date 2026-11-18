// Whether a pack secret's gate is open for one person, from their record and what the host says (anchors, place, pack stages). Pure.
// The gate opening makes the secret revealable, not learned: it is learned only when a `~ reveal` line opens it (npc-lines-parts/secret.js).
import { gateHolds } from './gate-eval.js';
import { meterValue, rungMet } from '../npc-meters-slice.js';
import { rung } from '../npc-meters-config.js';

/** The cast's ladder rows as rungs, the way NPC State reads them (a stage's `milestone` is only its cue there, never a need). */
const rungsOf = stages => (Array.isArray(stages) ? stages : []).map(row => rung(row));

/** The highest pack stage (1-based) whose needs all hold, by the ladder's own test; 0 for none. */
export function stageReached(record, stages, byId) {
    const defs = [...byId.values()];
    let reached = 0;
    rungsOf(stages).forEach((step, at) => { if (step && rungMet(record, step, defs)) reached = at + 1; });
    return reached;
}

/** The owner's ids a gate's `of <id>` may name (cast id and name, lower case and slugged); none known → undefined (such terms are read as before). */
function ownersOf(record) {
    const ids = [record?.castFrom?.id, record?.name].filter(text => typeof text === 'string' && text.trim()).flatMap(text => [text.toLowerCase(), text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')]);
    return ids.length ? new Set(ids) : undefined;
}

/**
 * `{ gate }` (a rule) against `record`. `inputs`: { stages, anchors: string[], place, quote(text) → bool } as the host's hook gives them;
 * `byId`: the meter definitions by id. Reading the record as it stood before the reply keeps a reveal the same on replay.
 */
export function gateOpen(rule, record, byId, inputs = {}) {
    if (typeof rule?.gate !== 'string') return false;
    const stages = Array.isArray(inputs.stages) ? inputs.stages : [];
    return gateHolds(rule.gate, {
        stage: stageReached(record, stages, byId),
        stageOf: name => rungsOf(stages).findIndex(step => step?.name === name) + 1,
        meter: id => (byId.has(id) ? meterValue(record, byId.get(id)) : null),
        owners: ownersOf(record),
        anchors: new Set(Array.isArray(inputs.anchors) ? inputs.anchors : []),
        place: inputs.place ?? '',
        quote: inputs.quote ?? (() => true),   // a quote term is open until the reveal line (its quote is checked there)
    });
}
