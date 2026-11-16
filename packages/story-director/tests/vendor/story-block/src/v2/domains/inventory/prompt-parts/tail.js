// The inventory's tail: what is worn, the wallet and the carried items that fit.

import { ownerName } from '../../common.js';
import { formatWallet } from '../../money.js';
import { itemText } from '../validate.js';
import { listItems } from '../queries.js';
import { condText, itemPhrase, owners } from './phrases.js';
import { pack } from './packing.js';

// The wallet line says it is the purse BEFORE this reply, so a payment the story makes in this reply is not read as already counted.
// (The ask for a coin line is the coin kind's grammar line alone, once.)
export const WALLET_NOTE = 'before this reply';

/**
 * The inventory's tail: what is worn and the wallet always; carried items in `lines` while
 * they fit in `chars` characters, the rest in `optional` (dropped first by the host) up to
 * `optionalChars`, then a count of what is left out.
 */
export function inventoryTail(state, { currency, chars, optionalChars, gear = false }) {
    const inventory = state?.domains?.inventory;
    const items = listItems(inventory);
    const lines = [];
    const optional = [];
    for (const owner of owners(items.filter(item => item.equipped !== null))) {
        const worn = items.filter(item => item.owner === owner && item.equipped !== null)
            .map(item => `${itemText(item.name, item.qty)}${condText(item, gear)} [${item.equipped}]`);
        lines.push(`Equipped${owner === 'party' ? '' : ` (${ownerName(state, owner)})`}: ${worn.join(', ')}`);
    }
    const wallets = inventory?.wallets ?? {};
    const purse = [formatWallet(wallets.party, currency)];
    for (const owner of Object.keys(wallets).filter(key => key !== 'party').sort()) {
        if (Object.values(wallets[owner]).some(Boolean)) purse.push(`${ownerName(state, owner)} ${formatWallet(wallets[owner], currency)}`);
    }
    lines.push(`Wallet (${WALLET_NOTE}): ${purse.join('; ')}`);
    const carried = items.filter(item => item.equipped === null);
    if (!carried.length) {
        lines.push('Carried: nothing');
        return { lines, optional };
    }
    let room = chars - lines.reduce((sum, line) => sum + line.length + 1, 0);
    let spare = optionalChars;
    let left = 0;
    for (const owner of owners(carried)) {
        const label = owner === 'party' ? 'Carried' : `Carried (${ownerName(state, owner)})`;
        const phrases = carried.filter(item => item.owner === owner).map(item => itemPhrase(item, gear));
        const main = pack(label, phrases, Math.max(0, room));
        lines.push(...main.lines);
        room -= main.used;
        const more = pack(`Also ${label.toLowerCase()}`, phrases.slice(main.taken), Math.max(0, spare));
        optional.push(...more.lines);
        spare -= more.used;
        left += phrases.length - main.taken - more.taken;
    }
    if (left) optional.push(`…and ${left} more item${left === 1 ? '' : 's'}.`);
    return { lines, optional };
}
