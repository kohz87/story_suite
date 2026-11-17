// What a hero's stance switch carries across a fight's exchanges and replies: a switch left off stays off until the player turns it on (`args.stance` false / true on a pick; no `stance` on a pick means "as it was").
// Pure and read from the stored steps and setup only, so a swipe, a Re-read, a rewind and a reload give the same input.
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The inputs of `step` as a Map: actor id → input. */
const inputsOf = step => new Map((step?.inputs ?? []).filter(input => plain(input) && input.actor !== undefined).map(input => [String(input.actor), input]));

/** `{ [actorId]: false }` of the heroes the player left off: `setup.stance` (what the earlier replies left) updated by `steps`' last step. A pick without `stance` in a later exchange of the same reply is the engine's own (on), as before this carry. */
export function stanceAfter(setup, steps = []) {
    const out = { ...(plain(setup?.stance) ? setup.stance : {}) };
    for (const [actor, input] of inputsOf(steps.at(-1))) {
        if (input.args?.stance === false) out[actor] = false;
        else delete out[actor];
    }
    return out;
}

/** Whether the hero's stance is held off for the exchange `steps` has reached: the last step's pick, or (no step yet in this reply) what the earlier replies left. */
export const stanceHeldOff = (setup, steps, actor) => (steps?.length ? inputsOf(steps.at(-1)).get(String(actor))?.args?.stance === false : setup?.stance?.[String(actor)] === false);
