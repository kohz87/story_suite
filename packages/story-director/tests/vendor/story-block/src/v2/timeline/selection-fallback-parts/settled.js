// The settled plan after a fallback or rebuild, and the sentence the reader sees after a fallback.

/**
 * The plan with the modules that fell put back the way the journal settled them. A completed selection that recorded
 * `fell: { module, from, to }` stood on `to` because `from` could not be prepared; while the plan still names `from` and the
 * selection holds `to`, that is settled, not a new selection to make (otherwise every look would try `from` again).
 */
export function settledPlan(plan, selection, entries) {
    let result = plan;
    for (const entry of entries) {
        // A module whose dossiers were started again from the chat has no selected checkpoint until it publishes the new one: the old plan is not a selection to make.
        if (entry.kind === 'selection' && entry.phase === 'rebuilt') {
            for (const [module, slot] of Object.entries(entry.slots ?? {})) {
                if (slot?.rebuilt === true && !selection[module] && result[module]) { result = { ...result }; delete result[module]; }
            }
            continue;
        }
        if (entry.kind !== 'selection' || entry.phase !== 'complete') continue;
        for (const fell of [].concat(entry.fell ?? [], entry.fellOthers ?? [])) {
            const { module, from, to } = fell;
            const wanted = plan[module];
            const held = selection[module];
            if (from && to && wanted?.checkpoint === from.checkpoint && wanted.hash === from.hash && held?.checkpoint === to.checkpoint && held.hash === to.hash) {
                result = { ...result, [module]: held };
            }
        }
    }
    return result;
}

/** The sentence the reader sees after a fallback (the approved wording). `index` is the reply the point stands at, or null for the baseline. */
export function fellNotice(label, { index, replies }) {
    const where = Number.isInteger(index) ? `reply ${index}` : 'the start of the chat';
    const later = Number.isInteger(replies) ? `${replies} later ${replies === 1 ? 'change is' : 'changes are'}` : 'Later changes are';
    return `${label} were restored to the nearest saved point (${where}). ${later} being read again from the chat.`;
}
