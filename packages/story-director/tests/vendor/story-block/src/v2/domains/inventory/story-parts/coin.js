// Turns the story's `+ coin` / `- coin` lines, and an item named as money, into wallet receipts and payments.

import { labelOf } from '../../common.js';
import { cleanName, trimText } from '../../names.js';
import { countedMoney, coinValue, parseAmount } from '../../money.js';
import { currencyIn, receive, pay } from '../stacks.js';
import { lineQty, storyCoin } from '../lines.js';

// `+ item Marks | qty: 44`, `- item mark`: the party's wallet, as `+ coin 44` / `- coin 1` would.
export function itemAsCoin(ctx, line, env, currency) {
    if (line.op !== '+' && line.op !== '-') {
        ctx.fail('INVALID', `${currency.plural} are money, not an item; write + coin or - coin with the amount.`);
    }
    const count = lineQty(ctx, line, 1);
    if (count < 1) ctx.fail('INVALID', 'An amount of money must be more than nothing.');
    // `+ item Silver | qty: 3` is 3 silver: counted in the smallest unit (money.js coinValue); `+ item 3
    // silver coins` too (the number in the name times the quantity).
    const counted = countedMoney(cleanName(line?.name), currency);
    const amount = counted ? count * counted.count * counted.value : count * Math.max(1, coinValue(cleanName(line?.name), currency));
    if (!Number.isSafeInteger(amount)) ctx.fail('INVALID', 'That amount is too large.');
    const who = labelOf(line, line.op === '+' ? 'from' : 'to');
    const note = who ? `${line.op === '+' ? 'from' : 'to'} ${trimText(who, 80)}` : '';
    return line.op === '+'
        ? receiveStory(ctx, env, { owner: 'party', amount, note })
        : payStory(ctx, env, { owner: 'party', amount, note });
}

// A story line's money, counted for the reply (storyCoin); `vouched` for a module's payout
// that the story alone vouched for (wallet.receive { story: true }).
export function receiveStory(ctx, env, { owner, amount, note }, vouched = false) {
    storyCoin(ctx, ctx.draft('inventory'), amount, vouched);
    return receive(ctx, env, { owner, amount, note });
}

// A story payment can spend up to what the wallet holds.
function payStory(ctx, env, { owner, amount, note }) {
    return pay(ctx, env, { owner, amount, note });
}

/** `+ coin 30 | from: who`, `- coin 5 | to: who`: the party's wallet; only the number counts. */
export function captureCoin(ctx, line, env) {
    const written = labelOf(line, 'amount') ?? String(line?.name ?? '');
    if (line?.op !== '+' && line?.op !== '-') {
        ctx.fail('INVALID', `"${line?.op} coin" is not a change the wallet understands; use + coin or - coin.`);
    }
    // With coins, "3 silver" is read in the smallest unit here, before it is counted for the reply.
    const parsed = parseAmount(written, currencyIn(ctx));
    if (parsed.error) ctx.fail('INVALID', parsed.error);
    const who = labelOf(line, line.op === '+' ? 'from' : 'to');
    const note = who ? `${line.op === '+' ? 'from' : 'to'} ${trimText(who, 80)}` : '';
    return line.op === '+'
        ? receiveStory(ctx, env, { owner: 'party', amount: parsed.amount, note })
        : payStory(ctx, env, { owner: 'party', amount: parsed.amount, note });
}
