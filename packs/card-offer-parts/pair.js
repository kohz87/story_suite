// The card offer's grouping: one offer for the pack of a format 3 card, or one offer for the world and the game of a format 4 card
// (pack-format-4 §4.3). Installing selects both. Nothing here touches the DOM.

import { isAddOn } from '../selection.js';

const ORDER = { world: 0, game: 1 };

/** Whether any of the card's format 4 packs is new or newer than the installed one. */
export const memberNeeded = members => members.some(member => member.newer);

/**
 * A card's packs as one offer: `members` are `{ entry, pack, raw, installedVersion }`, the world first. One member gives the offer
 * exactly the fields a single pack always had; two give the pair joined by "and" (names) and "+" (versions, ids).
 */
export function groupOffer(list) {
    const members = [...list].sort((a, b) => (ORDER[a.pack.kind] ?? 2) - (ORDER[b.pack.kind] ?? 2));
    const each = field => members.map(member => member.pack[field]);
    const have = members.map(member => member.installedVersion);
    const update = have.every(version => version !== null);
    return {
        id: members.map(member => `${member.pack.id}@${member.pack.version}`).join('+'),
        packId: each('id').join('+'),
        name: each('name').join(' and '),
        version: each('version').join(' + '),
        installedVersion: update ? have.join(' + ') : null,
        update,
        members,
        state: 'offer',
        result: '',
    };
}

/**
 * Selects the installed world and game of an offer (a click on Install is the owner's choice). `done`: the members that installed.
 * → the words for the notice: "Ersveil is the world and Ersveil rules the game now.", or '' when nothing was selected.
 */
export async function selectMembers(packs, done) {
    const parts = [];
    for (const { pack } of done) {
        if (!pack.kind || isAddOn(pack)) continue;
        if (typeof packs.select === 'function' && await packs.select(pack.kind, pack.id)) parts.push(`${pack.name} is the ${pack.kind}`);
    }
    return parts.length ? `${parts.join(' and ')} now.` : '';
}
