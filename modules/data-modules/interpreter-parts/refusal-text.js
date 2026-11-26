// What a refused line is told: the kind's refusal, and the sentence of each of its `refusals` whose condition holds. Pure.

/** The refusal of `kind` for these fields and labels; a refused line records nothing, so these conditions are never replayed. */
export function refusalText(kind, evaluation, fields, args) {
    const base = kind.refusal ?? 'Kind condition is not met.';
    const parts = (kind.refusals ?? []).filter(part => evaluation.evaluate(part.when, { arg: args }) === true)
        .map(part => part.text.replace(/\{([^{}]*)\}/g, (_whole, name) => String(fields[name])));
    return parts.length ? `${base} ${parts.join('; ')}` : base;
}
