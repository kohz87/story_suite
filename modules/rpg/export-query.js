// The `rpg.characterFile` query: one party member's saved character file (Export a character), worked out from the story as it stands now.
import { DEFAULT_CURRENCY } from '../inventory/money.js';
import { FILE_LIMITS, buildCharacterFile, fileNameOf, fileText, itemsForFile } from './charfile.js';
import { characterOfCard } from './charfile-parts/of-card.js';
import { fold } from './read.js';
import { actorIdOf } from './roster.js';
import { readParty } from './view/party-data.js';

const asked = (tools, name, args, fallback) => { try { return tools?.query?.(name, args) ?? fallback; } catch { return fallback; } };

/**
 * `args`: { id (the member's party id), persona, inventory (default true), money (default true; only the reader's own character has a purse) }.
 * → { ok: true, name, fileName, text, own, level, points, items (how many things it carries), money (the purse, 0 when none or not theirs), currency } or { ok: false, message }.
 */
export function characterFileQuery(state, args, tools) {
    const own = typeof args?.persona === 'string' ? args.persona : '';
    const character = readParty(state, { own }).find(row => actorIdOf(row.module) === args?.id);
    if (!character) return { ok: false, message: 'That character is not in the story any more.' };
    // Who holds what this character carries: the reader's own character has the party's bag, and every character the party actor of their name.
    const actors = asked(tools, 'party.actors', {}, []);
    const named = (Array.isArray(actors) ? actors : []).filter(actor => typeof actor?.id === 'string' && fold(actor.name) === fold(character.name)).map(actor => actor.id);
    const owners = [...new Set([...(character.own ? ['party'] : []), ...named])];
    const things = itemsForFile(owners.flatMap(owner => { const rows = asked(tools, 'inventory.items', { owner }, []); return Array.isArray(rows) ? rows : []; }));
    const purse = character.own ? asked(tools, 'inventory.wallet', { owner: 'party' }, {})?.coin : null;
    const money = Number.isSafeInteger(purse) && purse > 0 ? Math.min(purse, FILE_LIMITS.money) : 0;
    const file = buildCharacterFile({ ...characterOfCard(character), items: args?.inventory !== false && things.length ? things : null, money: args?.money !== false && money > 0 ? money : null });
    return { ok: true, name: character.name, fileName: fileNameOf(character.name), text: fileText(file), own: character.own === true, level: character.level, points: character.points, items: things.length, money, currency: asked(tools, 'inventory.currency', {}, null) ?? DEFAULT_CURRENCY };
}
