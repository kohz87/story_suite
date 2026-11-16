// Words one item, one skill, an amount of money and a count of things for the dialogs.

import { RANK_NAMES } from '../names.js';
import { formatAmount } from '../../inventory/money.js';
import { RPG_STRINGS, fill } from '../strings.js';

/** "Torch ×2", "Oilskin Coat (waxed, a little too big)": one thing as the dialogs list it. */
export const itemLine = item => `${item.name}${item.qty === 1 ? '' : ` ×${item.qty}`}${item.note ? ` (${item.note})` : ''}`;

/** "Iron Breath (Expert)": one skill with its rank. */
export const skillLine = skill => `${skill.name} (${RANK_NAMES[skill.rank] ?? RANK_NAMES[0]})`;

/** An amount of money as the wallet words it (the chat's coins), with thousands separators on every long number: "10,000,000 gold", "1,200 silver 5 copper". */
export const moneyText = (amount, currency) => formatAmount(amount, currency).replace(/\d{4,}/g, digits => Number(digits).toLocaleString('en-US'));

/** "4 things" / "1 thing" for a number of things (stacks as the file lists them). */
export const thingsWord = n => fill(n === 1 ? RPG_STRINGS.wizard.thing : RPG_STRINGS.wizard.things, { n });
