// World events, generated arcs on the host: the model-facing wording for a slot that may start an arc (owner standing rule 18 Nov: the lead's
// wording). Sent only when a slot of the batch allows an arc, so a batch with none is word for word as before. Pure.

/** Added to the system text only when a slot of the batch may start an arc (spec §5). */
export const ARC_SYSTEM = [
    'A slot that says "Arc allowed" may also start a short arc: a small trouble with a beginning, a middle and an end. Your usual answer for that slot is the first step. Add "arc":{"steps":[...],"ending":{...}} to start one, or leave "arc" out to start none.',
    'The happening the slot already names is the first happening; "arc.steps" lists the ones between (it may be empty) and "arc.ending" is the last, so the slot\'s count is every happening in all: the first, arc.steps and the ending.',
    'Write the whole arc now; it is final and is not rewritten later. Each step and the ending have the same shape as a result (name, summary, people, effects, picked only from that slot\'s menu) plus "after" (whole days, 1 to 90, until it happens, counted from the step before) and "within" (how many days it may take, 1 to 60), and "severity":"major" only for a happening that changes the world\'s balance (the first happening may carry it too).',
    'Example for a slot that allows 3 to 4: {"slot":"<slot id>","name":"<first>","summary":"<what happens>","people":[],"effects":{},"arc":{"steps":[{"name":"<next>","summary":"<what happens>","people":[],"effects":{},"after":5,"within":10}],"ending":{"name":"<last>","summary":"<what happens>","people":[],"effects":{},"after":7,"within":10}}}.',
    'Each step must follow from the one before. The ending closes the trouble: it settles or lets it fade, and may attach the fact offered for the slot. An arc never changes a thread the world already tells; use only the menu.',
].join('\n');

/** The slot block's line for a slot that may start an arc (`arc` is the template's { steps: [low, high] }). */
export const arcLine = arc => `Arc allowed: ${arc.steps[0]} to ${arc.steps[1]} happenings in all (the one above, "arc.steps" and "arc.ending"); "arc.steps" lists ${arc.steps[0] - 2} to ${arc.steps[1] - 2}`;
