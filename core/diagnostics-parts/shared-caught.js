// The state the console catcher shares: what was caught, the keep helper and the text of a logged part.

export const caught = { errors: [], saves: [], saveFailures: 0, seq: 0 };

export const textOf = part => (part instanceof Error ? `${part.name}: ${part.message}` : typeof part === 'string' ? part : (() => {
    try { return JSON.stringify(part); } catch { return String(part); }
})());

export function keep(list, entry, limit) {
    caught.seq += 1;
    list.push({ seq: caught.seq, ...entry });
    if (list.length > limit) list.splice(0, list.length - limit);
}
