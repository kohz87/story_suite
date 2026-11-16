// Reads the party section of the public paths from the RPG's characters.

import { activeDefinition } from '../data-modules/adapters.js';
import { readSheet } from '../lean-rpg/read.js';
import { rosterOf } from '../lean-rpg/roster.js';
import { STAGES, STATS } from '../lean-rpg/names.js';
import { barOf, spreadWord, wordsOf } from '../lean-rpg/blocks.js';
import { fold } from './shared-basics.js';
import { put } from './shared-put.js';

// A bar's word as the Party card reads it: a Standard block bar spreads the word over its size, a stage bar's own field names win, else the default words.
function barWord(key, definition, member) {
    const value = member[key];
    if (!Number.isSafeInteger(value)) return undefined;
    if (member.size && barOf(definition?.state?.[key])) return spreadWord(wordsOf(barOf(definition.state[key])), value, member.size[key]) || undefined;
    const named = definition?.state?.[key]?.names?.[String(value)];
    if (typeof named === 'string' && named) return named;
    return STAGES[key]?.[value] ?? String(value);
}

export function partySection(state, persona) {
    const map = new Map();
    const sheet = readSheet(state);
    if (!sheet.characters.length) return map;
    const roster = rosterOf(state, persona).actors;
    const members = sheet.characters.map((member, at) => {
        const definition = activeDefinition(state, member.module);
        const hidden = new Set(member.hidden);
        const out = { name: member.who };
        if (!hidden.has(member.levelled ? 'level' : 'soul')) out.level = member.level;
        if (Number.isSafeInteger(member.xp) && !hidden.has('xp')) out.xp = member.xp;
        for (const key of ['health', 'mana', 'stamina']) {
            const word = hidden.has(key) ? undefined : barWord(key, definition, member);
            if (word !== undefined) out[key] = word;
        }
        const stats = Object.fromEntries(STATS.filter(stat => Number.isSafeInteger(member.stats[stat]) && !hidden.has(stat)).map(stat => [stat, member.stats[stat]]));
        if (Object.keys(stats).length) out.stats = stats;
        return { out, lead: roster[at]?.pc === true };
    });
    put(map, 'party', members.map(member => member.out), false);
    for (const { out, lead } of members) {
        // A member called "me" is not reachable by name (party.me is the reader's alias); it is still in the `party` list.
        const named = fold(out.name) !== 'me';
        const base = `party.${out.name}`;
        if (named) put(map, base, out, false);
        if (lead) put(map, 'party.me', out, false, true);
        for (const [field, value] of Object.entries(out)) {
            if (field === 'name') { if (named) put(map, `${base}.name`, value); if (lead) put(map, 'party.me.name', value, true, true); continue; }
            if (field === 'stats') {
                if (named) put(map, `${base}.stats`, value, false);
                if (lead) put(map, 'party.me.stats', value, false, true);
                for (const [stat, number] of Object.entries(value)) {
                    if (named) put(map, `${base}.stats.${stat}`, number);
                    if (lead) put(map, `party.me.stats.${stat}`, number, true, true);
                }
                continue;
            }
            if (named) put(map, `${base}.${field}`, value);
            if (lead) put(map, `party.me.${field}`, value, true, true);
        }
    }
    return map;
}
