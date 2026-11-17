// The repair's own grammar lines: for coin, item, time and the hook/quest family the repair is shown a short line of its own instead of the shared one
// (the shared lines teach the narrator across a whole story: "an earlier reply", "whenever paid", dates; a repair sees one reply and must write less).

import { grammarKind } from '../extractor.js';

const LINES = Object.freeze({
    coin: '+ coin 30 gold | from: who (- coin 8 copper | to: who): write the coin name the reply uses; only coin that changes hands in this reply, with the amount the reply gives; never a price that is only talked about',
    item: '+ item Name | qty: 1 (- item Name | qty: 1 when used up, lost or given away): never + item for something already under Carried unless the reply gives a second one',
    hook: '+ hook|quest Name — summary (hook: a lead or job offered; quest: a job {{user}} accepted); - quest Name — outcome or - hook Name when the reply plainly shows it finished or closed; accept or close only what the reply plainly shows',
    time: '~ time 9:30 am (a clock time today, only when the reply gives one) or ! time +2h / ! time +1d (time passes; hours or days, never a date)',
});

/** The shared grammar `lines` with the repair's own line in place of the coin, item, hook and time lines (other lines as they are). */
export function repairGrammar(lines) {
    return lines.map(line => LINES[grammarKind(line)] ?? line);
}
