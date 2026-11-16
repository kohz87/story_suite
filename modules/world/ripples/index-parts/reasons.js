// Collects each power's quest, event, standing and fight reasons.

import { MAX_NAME, MAX_TEXT } from './shared-limits.js';
import { text, fold, cut, list } from './shared-text.js';
import { when } from './shared-numbers.js';
import { mentions, labelsOf } from './words.js';

/** The id of the one power a quest served (its giver's; else the one its key, name or summary names), or null. */
function questOwner(quest, table) {
    const pick = haystack => {
        const hits = table.powers.filter(power => mentions(haystack, [...labelsOf(power), ...power.givers]));
        return hits.length === 1 ? hits[0].id : hits.length > 1 ? false : null;
    };
    const byGiver = text(quest.giver) ? pick(quest.giver) : null;
    if (byGiver !== null) return byGiver || null;
    return pick([quest.key, quest.name, quest.summary].map(text).join(' | ')) || null;
}

/** Sway per power from one signal's point of view: the matching entries, with their deltas and texts. */
function questReasons(power, quests, tiers, table) {
    const out = [];
    for (const quest of list(quests)) {
        const delta = quest.outcome === 'done' ? (quest.great === true ? tiers.great : tiers.small)
            : quest.outcome === 'failed' ? -tiers.failed
            : quest.outcome === 'abandoned' ? -tiers.abandoned : 0;
        if (!delta || questOwner(quest, table) !== power.id) continue;
        const label = cut(text(quest.name) || text(quest.key) || 'a quest', MAX_NAME);
        const giver = text(quest.giver);
        const verb = quest.outcome === 'done' ? 'finished' : quest.outcome === 'failed' ? 'failed' : 'gave up on';
        out.push({ kind: 'quest', delta, text: cut(`${verb} ${label}${giver ? ` for ${giver}` : ''}`, MAX_TEXT), when: when(quest.at) });
    }
    return out;
}

function eventReasons(power, events, directions, tiers) {
    const out = [];
    for (const event of list(events)) {
        if (event.open !== false) continue;
        const name = cut(text(event.name), MAX_NAME);
        const known = [name, text(event.id), ...list(event.aka).map(text)].map(fold).filter(Boolean);
        const entry = directions.find(item => known.includes(fold(item.event)));
        if (!entry) continue;
        const against = entry.unless.length > 0 && mentions(event.summary, entry.unless);
        const factions = list(event.factions).map(text);
        if (entry.favours === power.id) {
            const delta = against ? -tiers.great : tiers.great;
            out.push({ kind: 'event', delta, text: cut(against ? `${name} went against ${power.name}` : `${name} went ${power.name}'s way`, MAX_TEXT), when: when(event.at) });
        } else if (!against && factions.some(faction => mentions(faction, [...labelsOf(power), ...power.factions]))) {
            out.push({ kind: 'event', delta: -tiers.small, text: cut(`${name} cost ${power.name} ground`, MAX_TEXT), when: when(event.at) });
        }
    }
    return out;
}

function standingReasons(power, standing) {
    const out = [];
    if (!power.standing) return out;
    for (const change of list(standing)) {
        if (change.key !== power.standing || !Number.isSafeInteger(change.delta) || change.delta === 0) continue;
        const verb = change.delta > 0 ? 'rose' : 'fell';
        out.push({ kind: 'standing', delta: change.delta, text: `${power.name}'s standing ${verb}`, when: when(change.at) });
    }
    return out;
}

function fightReasons(power, fights, tiers) {
    const out = [];
    for (const fight of list(fights)) {
        if (fight.won !== true) continue;
        const groups = list(fight.groups).map(text);
        const npc = power.npcs.find(item => groups.some(group => mentions(group, [item.name])));
        if (!npc) continue;
        out.push({ kind: 'fight', delta: -tiers.fight * npc.weight, text: cut(`won a fight against ${npc.name}'s people`, MAX_TEXT), when: when(fight.at) });
    }
    return out;
}

/** Every signal's reasons for each power of the table: `Map(id → [{ kind, delta, text, when }])`. */
export function reasonsOf(table, inputs) {
    const directions = table.worldDirections;
    const out = new Map();
    for (const power of table.powers) {
        out.set(power.id, [
            ...questReasons(power, inputs.quests, table.tiers, table),
            ...eventReasons(power, inputs.events, directions, table.tiers),
            ...standingReasons(power, inputs.standing),
            ...fightReasons(power, inputs.fights, table.tiers),
        ]);
    }
    return out;
}
