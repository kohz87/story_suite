// The story's open hooks and quests by name (the Director's open threads), as state lines for the repair of a reply that came with no block.

const KINDS = Object.freeze([['hook', 'Open hooks'], ['quest', 'Open quests']]);
const MAX_NAMES = 20;
const MAX_NAME = 60;

/** `Open hooks: A; B` and `Open quests: C` from the active threads of `view.state.domains.director` (a kind with none gives no line). */
export function openThreadLines(view) {
    const threads = view?.state?.domains?.director?.threads;
    const all = threads && typeof threads === 'object' ? Object.values(threads) : [];
    const lines = [];
    for (const [kind, label] of KINDS) {
        const names = all
            .filter(thread => thread && thread.kind === kind && thread.status === 'active')
            .map(thread => String(thread.key ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME))
            .filter(Boolean)
            .slice(0, MAX_NAMES);
        if (names.length) lines.push(`${label}: ${names.join('; ')}`);
    }
    return lines;
}
