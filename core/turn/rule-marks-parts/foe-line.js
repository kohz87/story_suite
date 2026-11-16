// Foe line: tells whether a narrator's set-slot line is a foe line, for the rule marks.

import { activeDefinition } from '../../../modules/data-modules/adapters.js';
import { withKind } from '../../../modules/data-modules/part/act.js';
import { resolveModule } from '../../../modules/data-modules/part/views.js';

/** A narrator's set-slot line, using normalized labels and the same omitted-kind inference as the handler. */
export function foeLine(line, state = null) {
    if (line?.kind !== 'dm' || line.op !== '+') return false;
    const named = Object.hasOwn(line.labels ?? {}, 'kind');
    if (named && !/^set-slot-\d$/u.test(String(line.labels.kind))) return false;
    // Prior text may have used an older definition; a kind-less line could have been a foe, so do not change its rule.
    if (!state) return true;
    try {
        const definition = activeDefinition(state, resolveModule(state, line.name));
        if (definition?.role !== 'foes') return false;
        const kind = named ? line.labels.kind : withKind(definition, line).kind;
        return /^set-slot-\d$/u.test(String(kind ?? '')) && !!definition.kinds[kind]?.labels?.level;
    } catch { return false; }
}
