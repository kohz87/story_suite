/* NPC State Delta dossier view-model part: the four axes for the dial arcs. */
import { relationshipValue, RELATIONSHIP_AXES } from '../dossier-ui-model.js';
import { object } from './shared-object.js';

// The four axes for the dial. `value` is the clamped −100..100 meter; `fraction` maps it to 0..1 for the arc.
export function dialAxesModel(relationship) {
    const rel = object(relationship);
    return RELATIONSHIP_AXES.map(([axis, label]) => {
        const value = relationshipValue(rel[axis]);
        return { axis, label, value, fraction: (value + 100) / 200 };
    });
}
