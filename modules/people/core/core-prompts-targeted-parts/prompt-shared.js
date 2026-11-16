/* The wording and return shape shared by every targeted dossier prompt: lever labels, output caps, style line, returnShape. */
import { DURABLE_PROFILE_LIMITS } from '../core-relationship.js';
import { BEHAVIOR_PROFILE_LIMIT } from '../core-behavior.js';
import { KEY_RELATIONSHIP_LIMIT } from '../core-keyrel.js';
import { RETURN_KEYS, RETURN_SHAPES } from '../src/fields/registry.js';
// (cleanup steps 12-13) Written once for every dossier prompt: the behaviour-lever labels, the output
// caps (the stored limits, DURABLE_PROFILE_LIMITS, so a FULL field the model returns is what is
// kept), and the targeted prompts' return shapes (the registry's RETURN_SHAPES).
export const BEHAVIOR_LEVER_LABELS = 'Disposition|Care|Expression|Independence|Conflict|Threat|Analytical|Presentation|Mercy|Loyalty|Drive|Honesty';
export const PROMPT_CAPS = `homeBase 300, appearance ${DURABLE_PROFILE_LIMITS.appearance}, personality ${DURABLE_PROFILE_LIMITS.personality}, speech ${DURABLE_PROFILE_LIMITS.speech}, background 320, relationshipSummary 280, behaviorProfile ${BEHAVIOR_PROFILE_LIMIT}x${DURABLE_PROFILE_LIMITS.behaviorProfile}, mannerisms 4x${DURABLE_PROFILE_LIMITS.mannerism}, keyRelationships ${KEY_RELATIONSHIP_LIMIT}x${DURABLE_PROFILE_LIMITS.keyRelationship}, memory ${DURABLE_PROFILE_LIMITS.memory}`;
// One wording for how the scanner writes a person (owner-approved style change); every dossier prompt appends it.
export const PROFILE_STYLE_LINE = 'Style: speech=how they sound + one short line in their words if a scene gives one; personality=the tension or reason under the surface, plain words, no adjective list; behaviorProfile "Label: level - what they do" (the act seen); mannerisms=one physical habit; overallAppearance (no named forms)=readable: kind, apparent age, build, hair, eyes, then unmistakable marks; appearance=clothes and their state; both FULL, keep recorded details, add new. Every claim needs quoted evidence; unsupported = leave out.';
const RETURN_SHAPE_LEAD = 'Return shape (write it as JSON; bare key=text, []=list, a|b=one of; a *State other than keep goes with its *Reason, e.g. ageReason, mannerismReason):';
function returnShapeKeys(names, values = {}) {
    return names.map(name => {
        const spec = RETURN_KEYS[name] || {};
        const key = spec.key || name;
        const value = values[name] ?? spec.value;
        const parts = [value ? `${key}:${value}` : key];
        if (spec.states) parts.push(`${spec.stateKey || `${key}State`}:${spec.states}`);
        return parts.join(',');
    }).join(',');
}
/** The return shape of a targeted prompt ('refresh' | 'backfill' | 'import'); `values` replaces a key's value. */
export function returnShape(kind, values = {}, extraNpcKeys = []) {
    const shape = RETURN_SHAPES[kind];
    const parts = [`"npcs":[{${returnShapeKeys([...shape.npcs, ...extraNpcKeys], values)}}]`];
    if (shape.profileUpdates) parts.push(`"profileUpdates":[{${returnShapeKeys(shape.profileUpdates, values)}}]`);
    if (shape.edges) parts.push('"keyRelationshipEdges":[]');
    return `${RETURN_SHAPE_LEAD}\n{${parts.join(',')}}`;
}
