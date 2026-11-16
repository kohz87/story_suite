// Reads the pack table and the scoring inputs from the head state.

import { questDifficulty } from '../../../changes.js';
import { validateRipples } from './table.js';

const GREAT = new Set(['hard', 'nightmare']);
const ask = (tools, name, args) => {
    try { return typeof tools?.query === 'function' ? tools.query(name, args) ?? null : null; } catch { return null; }
};
const listOf = value => (Array.isArray(value) ? value : []);

/** The pack's table: the `packs.ripples` section (a host that has none gives null), validated; a bad one is ignored. */
export function tableOf(tools) {
    return checkedTable(tools).table;
}

const checkedTable = tools => {
    const found = ask(tools, 'packs.ripples', {});
    return validateRipples(found && typeof found === 'object' ? found : null);
};

/** `ripples.problems` → the pack table's Problems (strings), [] when it is fine or there is no section. */
export const problemsQuery = (state, args, tools) => checkedTable(tools).problems;

/** The inputs `swayOf` reads, from the head state: resolved quests, resolved world events, standing, won board fights. */
export function inputsOf(state, tools, table) {
    const quests = listOf(ask(tools, 'director.threads', { status: 'resolved' })).filter(thread => thread?.kind === 'quest' || thread?.kind === 'hook').map(thread => ({
        key: thread.key, name: thread.key, giver: thread.fields?.giver, summary: thread.summary,
        outcome: ['done', 'failed', 'abandoned'].includes(thread.ended?.outcome) ? thread.ended.outcome : null,
        great: GREAT.has(questDifficulty(thread.fields?.difficulty)), at: thread.ended?.at ?? null,
    }));
    const events = listOf(ask(tools, 'chronicle.events', { open: false })).map(event => ({
        id: event.id, name: event.name, aka: listOf(event.aka), summary: event.summary, factions: listOf(event.factions).map(item => item?.name ?? item), open: event.open, at: event.updated ?? null,
    }));
    // Standing: the change since the chat's start: the key's value now minus the power's `standingBase` (0 unless the pack says).
    const standing = [];
    const fields = table.standingModule ? ask(tools, 'dataModules.view', { module: table.standingModule })?.chat : null;
    for (const power of table.powers) {
        const value = fields?.[power.standing];
        if (power.standing && Number.isSafeInteger(value)) standing.push({ key: power.standing, delta: value - power.standingBase, at: null });
    }
    // Won board fights: the `rpg.fight` receipts (a fight that is not won writes none) with the groups they faced.
    let entries = [];
    try { entries = typeof tools?.receipts === 'function' ? tools.receipts() ?? [] : []; } catch { entries = []; }
    const fights = [];
    const upTo = Number.isSafeInteger(tools?.reply?.index) ? tools.reply.index : null;
    for (const entry of listOf(entries)) {
        if (upTo !== null && Number.isSafeInteger(entry?.index) && entry.index > upTo) continue;
        const receipt = entry?.receipt ?? entry;
        const fight = receipt?.type === 'rpg.fight' ? receipt.data?.v2?.result?.fight : null;
        if (fight && Array.isArray(fight.groups)) fights.push({ won: true, groups: fight.groups.map(group => group?.name), at: null });
    }
    return { quests, events, standing, fights };
}
