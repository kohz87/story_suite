// Story Director v2, part **arc**: the Director judge's prompt for world events the story wrote (model-facing, switch story-director.world-events
// and the chronicle setting `judge`, default off; new wording, for the owner's approval: WORLDEV2.REPORT.md). The answer is read by the plan judge's
// own strict reader (read.js) and its secrets kept out by scrub.js. Pure.

export const WORLD_JUDGE_SYSTEM = [
    'You judge world events the story has just written, before they count as fact. Each numbered item is one event: its name, what happened, where, and the conditions it set. Judge each against the world below.',
    'Refuse an item that contradicts the lore or an Active world event, decides how an Active world event ends, reveals or hints at hidden lore or a secret not yet learned, kills, moves or changes a protected person, or invents a place, faction or fact the lore does not give.',
    'Reshape an item that is close and needs one fix to its words or its place: give the corrected item in the same form, with the same name. Accept every other item. When unsure, accept.',
    'Answer with one line per item and nothing else:',
    '<n>: accept',
    '<n>: reshape: <the corrected item, as given>',
    '<n>: refuse: secret   (the item reveals or hints at hidden lore or a secret not yet learned; never say which)',
    '<n>: refuse: <the reason, naming the lore entry or world event it breaks, under 20 words>',
    'The reasons and the corrected items never name, quote or hint at hidden lore or a secret not yet learned.',
].join('\n');

const flat = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** One item as the judge reads it: "Name — what happened | place: X | conditions: +a, +b" (`conditions`: 'name@ref' keys). */
export function worldItemLine({ name, summary = '', place = '', conditions = [] } = {}) {
    const set = conditions.map(key => String(key).split('@')[0]).filter(Boolean);
    return [`${flat(name, 80)}${summary ? ` — ${flat(summary, 300)}` : ''}`, place ? `place: ${flat(place, 80)}` : '', set.length ? `conditions: ${set.map(each => `+${each}`).join(', ')}` : ''].filter(Boolean).join(' | ');
}

/** The prompt: the world (`world`: context.js's text), then the items as numbered lines. */
export function worldJudgePrompt({ world = '', lines = [] } = {}) {
    return [world, 'Items:', ...lines.map((line, index) => `${index + 1}: ${line}`)].filter(Boolean).join('\n');
}
