// What a hero's stance switch carries across a fight's exchanges and replies: a switch left off stays off until the player turns it on (`args.stance` false / true on a pick; no `stance` on a pick means "as it was").
// Pure and read from the stored steps and setup only, so a swipe, a Re-read, a rewind and a reload give the same input.
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The inputs of `step` as a Map: actor id → input. */
const inputsOf = step => new Map((step?.inputs ?? []).filter(input => plain(input) && input.actor !== undefined).map(input => [String(input.actor), input]));

/** `{ [actorId]: false }` of the heroes the player left off: `setup.stance` (what the earlier replies left) updated by each hero's latest pick in `steps`. A step without a hero's input (a Flee staged alone, a downed hero) leaves that hero as the steps before left them. A pick without `stance` is the engine's own (on), as before this carry. */
export function stanceAfter(setup, steps = []) {
    const out = { ...(plain(setup?.stance) ? setup.stance : {}) };
    for (const step of steps ?? []) {
        for (const [actor, input] of inputsOf(step)) {
            if (input.args?.stance === false) out[actor] = false;
            else delete out[actor];
        }
    }
    return out;
}

/** Whether the hero's stance is held off for the exchange `steps` has reached: the hero's latest pick in the steps, or (no pick yet in this reply) what the earlier replies left. */
export function stanceHeldOff(setup, steps, actor) {
    const id = String(actor);
    for (let i = (steps?.length ?? 0) - 1; i >= 0; i -= 1) {
        const input = inputsOf(steps[i]).get(id);
        if (input) return input.args?.stance === false;
    }
    return setup?.stance?.[id] === false;
}
