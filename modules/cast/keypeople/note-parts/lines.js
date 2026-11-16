// Story Director v2, part **keypeople**: writes one away person's tail line and fits the lines to the token budget.

import { estimateTokens } from '../../../relevance.js';
import { DEFAULT_TOKENS, cutPoints } from '../domain.js';
import { dateText } from '../time.js';
import { awayEntries } from './entries.js';
import { TAIL_HEADER } from './prompt-text.js';

const MAX_DOING = 90;
const MAX_LATEST = 80;

/** One away person's tail line. */
export function awayLine(entry, calendar) {
    const doing = cutPoints(entry.doing, MAX_DOING).replace(/[.!?…]+$/, '');
    const when = dateText(calendar, entry.back);
    const back = when ? (entry.due ? `, due back (${when})` : `, back ${when}`) : '';
    const latest = entry.last?.text ? `; latest: ${cutPoints(entry.last.text, MAX_LATEST).replace(/[.!?…]+$/, '')}` : '';
    return `${entry.name}: away${doing ? `, ${doing}` : ''}${back}${latest}.`;
}

/**
 * The tail for a state: `{ lines, tokens, left }` — the header and the lines that fit `budget` tokens (estimated at four
 * characters a token), `tokens` what they cost, `left` how many away people did not fit. No lines when none is away or
 * nothing fits.
 */
export function keyTail(slice, { now = null, calendar, budget = DEFAULT_TOKENS } = {}) {
    const entries = awayEntries(slice, now);
    const lines = [TAIL_HEADER];
    let left = 0;
    for (const entry of entries) {
        const line = awayLine(entry, calendar);
        if (left === 0 && estimateTokens([...lines, line].join('\n')) <= budget) lines.push(line);
        else left += 1;
    }
    if (lines.length < 2) return { lines: [], tokens: 0, left: entries.length };
    return { lines, tokens: estimateTokens(lines.join('\n')), left };
}
