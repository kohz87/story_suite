// Builds the [Rolls] cue text for rounds and checks at a given shape.

import { BATTLE_MARKER } from '../names.js';
import { wearLine } from './words.js';
import { NAME_CUT, cut } from './shared-text.js';
import { shortNames } from './short-names.js';
import { lineText } from './lines.js';
import { barsLine } from './bars.js';

const IDLE_WHY = Object.freeze({ down: 'Down', beaten: 'beaten', 'no-target': 'no target left', 'no-resource': 'the skill\'s resource is Empty' });

const STOP_POINTS = 'Stop earlier at the first stop point (a foe falls, flees or yields; anyone on your side is Down or Badly wounded; new foes arrive).';

// How the cue ends from the flow of stage 49 (resolve.js FLOW_VERSION): the last line says what stopped the rolls.
// A won fight tells the narrator code gives the XP (fight.js) and the beaten groups stay on the Foes block.
const FLOW_ENDS = Object.freeze({
    won: 'every foe is Down: the fight is won. Stop there and tell it as the end of the fight. Code gives the party its XP for it: write no XP line for this fight, and leave the beaten groups on the Foes block (Down).',
    lost: 'everyone on your side is Down. Stop there and tell it.',
    heavy: 'a party member is badly hurt or Down. Stop there at the latest.',
});
const flowEnd = (n, end, noXp) => (end ? `Round ${n} ends the rolls: ${end === 'won' && noXp ? 'every foe is Down: the fight is won. Stop there and tell it as the end of the fight, and leave the beaten groups on the Foes block (Down).' : FLOW_ENDS[end]}` : `Round ${n} is the last rolled: stop there at the latest. ${STOP_POINTS}`);

// A refusal in fewer words: without its bracketed reason, and cut.
const shortRefusal = text => cut(String(text).replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(), 70);

/**
 * The cue for `rounds` (the first `count` of them) and the checks: `{ checks: [line], rounds: [{ n, decisive, lines }],
 * refused: [text], plainRefused?: [text], decisive }` (`plainRefused`: the refusals as if nothing were hidden, used only when `plain`). `decisive`: whether the last round told is the one that settles the fight. `shape` (0 to 3)
 * is how much it is shortened to fit the budget: 0 as written; 1 checks without their skill and refusals without their
 * reasons; 2 the refusals as one count; 3 names cut as well.
 */
export function cueText(parts, shape = 0, { plain = false } = {}) {
    const { checks, rounds, refused, plainRefused, decisive } = parts;
    const fight = rounds.length > 0;
    const std = parts.standard ?? null;
    const head = fight
        ? `[Rolls] Code rolled these${std ? ' and has already moved the bars they hit, heal or spend (Health, and the Stamina or Mana a skill uses; the last line says where those stand): never set those yourself' : ''}. Tell them in this order and as given${parts.legacy ? ', and' : '. Name only the skill a line names, and'} never invent a roll; write ${BATTLE_MARKER} on its own line where the fight is told.`
        : '[Rolls] Code rolled these. Tell them as given, and never invent a roll.';
    // Shape 3 cuts every name, and each stays different from the others, so the narrator can tell who earned which result.
    const options = { compact: shape >= 1, names: shape >= 3 ? NAME_CUT : 0, plain, legacy: !!parts.legacy };
    if (shape >= 3) {
        const told = [...checks, ...rounds.flatMap(round => round.lines)];
        const map = shortNames(told.flatMap(line => [line.pc.who, ...(line.foe ? [line.foe.name] : [])]));
        options.shown = name => map.get(name) ?? name;
    }
    const lines = [head];
    if (parts.opened?.length) lines.push(`New foes: ${parts.opened.map(entry => `${options.shown ? options.shown(entry.name) : entry.name} \u00d7${entry.count}${Number.isInteger(entry.level) ? ` (Lv ${entry.level})` : ''}`).join(', ')}.`);
    if (parts.carriedDrop) lines.push('Ambush from last time: the party strikes first.');
    for (const line of checks) lines.push(lineText(line, options));
    if (std && fight) {
        // (names only; a quick start and its opening action come before round 1)
        if (shape < 2 && std.order.length) lines.push(`Turn order: ${std.order.map(entry => options.shown ? options.shown(entry.name) : entry.name).join(', ')}.`);
        for (const item of std.quick) lines.push(`${item.who} is quick enough to act first against ${item.against} (an opening action).`);
        for (const line of std.opening) lines.push(`Opening: ${lineText(line, options)}`);
    }
    for (const round of rounds) {
        for (const line of round.lines) lines.push(`Round ${round.n}: ${lineText(line, options)}`);
        for (const item of round.idle ?? []) lines.push(`Round ${round.n}: ${item.who} does not act: ${IDLE_WHY[item.why] ?? item.why}.`);
    }
    // measuring (`plain`), each refusal as if nothing were hidden (`plainRefused`, the same count; review 166)
    const notes = plain && plainRefused?.length === refused.length ? plainRefused : refused;
    if (shape >= 2 && notes.length) lines.push(`${notes.length} more ${notes.length === 1 ? 'action was' : 'actions were'} not rolled as planned.`);
    else for (const text of notes) lines.push(shape >= 1 ? shortRefusal(text) : text);
    if (std && fight) {
        const standing = barsLine(std.start, [...std.opening, ...rounds.flatMap(round => round.lines)]);
        if (standing) lines.push(`Bars now: ${standing}.`);
    }
    if (fight && parts.flow === 2) lines.push(flowEnd(rounds.at(-1).n, parts.end ?? null, parts.noXp === true));
    else if (fight) lines.push(`Round ${rounds.at(-1).n} is ${decisive ? (rounds.at(-1).decisive || !std ? 'decisive' : 'the end of the fight') : 'the last rolled'}: stop there at the latest. ${STOP_POINTS}`);
    for (const event of parts.wear ?? []) lines.push(`Round ${event.n}: ${wearLine(event)}.`);
    return lines.join('\n');
}
