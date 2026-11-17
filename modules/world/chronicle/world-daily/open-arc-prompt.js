// World events, generated arcs on the host: the model-facing wording for a slot that may start an arc (owner standing rule 18 Nov: the lead's
// wording). Sent only when a slot of the batch allows an arc, so a batch with none is word for word as before. Pure.

/** Added to the system text only when a slot of the batch may start an arc (spec §5). */
export const ARC_SYSTEM = [
    'A slot that says "Arc allowed" may also start a short arc: a small trouble with a beginning, a middle and an end. Your usual answer for that slot is the first step. Add "arc":{"steps":[...],"ending":{...}} to start one, or leave "arc" out to start none.',
    'Write the whole arc now; it is final and is not rewritten later. Each step and the ending have the same shape as a result (name, summary, people, effects, picked only from that slot\'s menu) plus "after" (whole days until it happens, counted from the step before) and "within" (how many days it may take), and "severity":"major" only for a step that changes the world\'s balance.',
    'Each step must follow from the one before. The ending closes the trouble: it settles or lets it fade, and may attach the fact offered for the slot. An arc never changes a thread the world already tells; use only the menu.',
].join('\n');

/** The slot block's line for a slot that may start an arc (`arc` is the template's { steps: [low, high] }). */
export const arcLine = arc => `Arc allowed: ${arc.steps[0]} to ${arc.steps[1]} steps counting the happening above; "arc.steps" lists the steps after it (${arc.steps[0] - 1} to ${arc.steps[1] - 1}), then "arc.ending"`;
