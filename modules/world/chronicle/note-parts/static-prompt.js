// Story Director v2, chronicle note: static prompt text, grammar lines, and tail token budget.

export const TAIL_BUDGET = 120;

/**
 * Each kind has its own always-taught grammar so the first event or faction can be recorded and
 * the safety net can select either. The World paragraphs are taught only once the story keeps one.
 */
export const GRAMMAR = Object.freeze({
    world: '+ world Name — what is changing in the wider world | state: looming|ongoing|resolved | place | factions (~ world Name — what changed; - world Name — how it ended). Write + world when anyone reports or shows news from beyond the scene (war, raids, monsters moving, trade cut off, disaster, law or price change); ~ world when news moves an existing event on. A hook is a lead to follow; news can be both.',
    faction: '+ faction Name — who they are, what they want | area | stance: toward {{user}} (~ faction Name to change it; - faction Name when gone). Write + faction when a group with its own aims acts or is named as acting and is not yet known; ~ faction when its stance toward {{user}} changes after what {{user}} did, or its aims or area change; - faction when it is gone or broken up.',
});

/** The chronicle's part of the static prompt (only while the story keeps world events or factions): no names, counts, times or dice. */
export const STATIC_TEXT = [
    'World lines are for what changes the wider world (a war, a plague, a calamity, a power rising or falling), never the scene\'s own business; a faction line for a power that shapes it. Code keeps their dates.',
    'Events under [World] are under way: when time and place allow, let one move on and write its ~ world line.',
].join('\n');
