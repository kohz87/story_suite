// The lines that tell the extractor where and when the scene is.

/** The lines that tell the extractor where and when the scene is (none when nothing is known). */
export function whereLines(around) {
    if (!around) return [];
    const lines = [];
    if (around.time) lines.push(`Story date and time now: ${around.time}`);
    if (around.here) lines.push(`Place now: ${around.here.name}${around.here.kind || around.here.region ? ` (${[around.here.kind, around.here.region].filter(Boolean).join(', ')})` : ''}`);
    if (around.near?.length) lines.push(`Known places near it (use these exact names): ${around.near.join('; ')}`);
    if (around.events?.length) lines.push(`Open world events the story already keeps (to update one, write ~ world with its exact name): ${around.events.join('; ')}`);
    if (around.factions?.length) lines.push(`Factions the story already keeps, with stance (never write a stance for one): ${around.factions.map(item => (item.stance ? `${item.name} (${item.stance})` : item.name)).join('; ')}`);
    return lines;
}
