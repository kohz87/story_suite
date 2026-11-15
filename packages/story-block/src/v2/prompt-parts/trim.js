// Story Suite v2: dropping tail lines to fit a token budget and writing the counted [Happened] lines.

import { HAPPENED, MIN_HAPPENED } from './markers.js';
import { estimateTokens } from './shared-helpers.js';

// Drops lines from `section` until its text fits `budget` tokens: optional ones from the end,
// then required ones from the end. Returns how many it dropped.
export function fit(section, budget) {
    let dropped = 0;
    const cost = () => estimateTokens([...section.lines, ...section.optional].join('\n'));
    while (cost() > budget && section.optional.length) { section.optional.pop(); dropped += 1; }
    while (cost() > budget && dropLast(section, section.lines)) dropped += 1;
    return dropped;
}

// Drops the last line of `list` that is not pinned (a pinned cue outranks ordinary notes and is never dropped); false when none is left.
export function dropLast(section, list) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
        if (section.pinned.has(list[i])) continue;
        list.splice(i, 1);
        return true;
    }
    return false;
}

// The [Happened] lines that fit `budget` tokens (at least the first MIN_HAPPENED), the rest told as
// one counted line.
export function happenedLines(lines, budget) {
    const out = [HAPPENED];
    let cost = estimateTokens(HAPPENED);
    for (let i = 0; i < lines.length; i += 1) {
        const left = lines.length - i;
        const next = estimateTokens(lines[i]) + 1;
        // Room is kept for the closing line whenever lines would be left over.
        const closing = left > 1 ? estimateTokens(`…and ${left - 1} more things happened.`) + 1 : 0;
        if (i >= MIN_HAPPENED && cost + next + closing > budget) {
            out.push(left === 1 ? '…and 1 more thing happened.' : `…and ${left} more things happened.`);
            return out;
        }
        out.push(lines[i]);
        cost += next;
    }
    return out;
}
