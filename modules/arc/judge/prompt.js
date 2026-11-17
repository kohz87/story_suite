// Story Director v2, part **arc**: the Director judge's prompt (model-facing, switch story-director.world-events; wording the lead's, owner standing rule 18 Nov,
// recorded in NSD-WORDING.md). The system text, and the prompt built from the plan's items and the world text (context.js). Pure.

export const JUDGE_SYSTEM = [
    'You judge a story arc plan before it is accepted. Each numbered item is a beat, clock or agenda a planner proposed; judge each against the world below.',
    'Refuse an item that decides, ends or shows the outcome of an Active world event (the world settles those by its own rolls; a plan may only react to them), contradicts the lore, reveals or hints at hidden lore, kills, moves or changes a protected person, or invents a place, faction or fact the lore does not give.',
    'Reshape an item that is close and needs one fix: give the corrected line in the same form. Accept every other item. When unsure, accept.',
    'Answer with one line per item and nothing else:',
    '<n>: accept',
    '<n>: reshape: <the corrected line, as given>',
    '<n>: refuse: event "<the exact event title>"   (the item decides how that Active event ends)',
    '<n>: refuse: <the reason, under 20 words>   (any other refusal)',
    'Then one last line: NOTE: <at most 60 words tying the accepted plan to the world: the standing conditions and the facts the story must not contradict>.',
].join('\n');

/** The judge's prompt: the arc, the items as numbered lines, then the world (`world`: context.js's text). */
export function judgePrompt({ arc = '', lines = [], world = '' } = {}) {
    return [arc ? `Arc: ${arc}` : '', world, 'Items:', ...lines.map((line, index) => `${index + 1}: ${line}`)].filter(Boolean).join('\n');
}
