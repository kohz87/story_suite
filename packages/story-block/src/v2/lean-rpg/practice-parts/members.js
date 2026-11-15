// Reads the party as the checks see it and the witness of the members a check was worked from.
import { fold, sameWho } from '../read.js';
import { actorIdOf } from '../roster.js';

/** The party as checks/line.js reads it: the sheet's characters with the names the party module knows them by (`party.actors`: the block's actor, else the same name, else an alias that means one Character). `host` has a `query`. */
export function membersOf(host, sheet) {
    let actors = [];
    try {
        // (`recorded`: answered whatever Gear's switch says today, so a replan reads the party as the first run did)
        const given = host.query?.('party.actors', { recorded: true });
        if (Array.isArray(given)) actors = given.filter(actor => typeof actor?.id === 'string' && actor.id !== 'party');
    } catch { /* a party with no actor list: names only */ }
    return sheet.characters.map(character => {
        const named = actors.find(actor => actor.id === actorIdOf(character.module)) ?? actors.find(actor => fold(actor.name) === character.key)
            ?? actors.find(actor => sameWho(character, actor.name, actor.aliases, sheet.characters));
        const aliases = [...(named ? [named.name, ...(Array.isArray(named.aliases) ? named.aliases : [])] : [])].filter(value => typeof value === 'string' && value.trim());
        return { name: character.who, aliases, stats: character.stats, level: character.level, soul: character.soul,
            skills: character.skills.map(skill => ({ name: skill.name, stat: skill.stat, rank: skill.rank, type: skill.type ?? 'combat' })) };
    });
}

// What the results were worked from: every member of the party as the sheet now holds them (stats, level or class, every skill's stat, rank and type), so a line the step
// refused ("unknown skill", "unknown person") is planned again too when an earlier reply adds what it named. The replay guard asks it again. (A name the party module
// knows a member by, `party.actors`, is not something a guard may ask: an alias change alone does not plan the step again.)
export const membersWitness = sheet => sheet.characters.map(found => ({ who: found.who, stats: found.stats, level: found.level, soul: found.soul, skills: found.skills.map(skill => [skill.name, skill.stat, skill.rank, skill.type ?? 'combat']) }));
