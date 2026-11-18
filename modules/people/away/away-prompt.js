// What the narrator is told of people away (pure): the fixed paragraph and grammar line, taught only while someone is followed or away
// (so a chat with neither sends the prompt it always did), and the `[Elsewhere]` tail, one line per away person within a token budget:
//   `Ren: away, scouting the north road, back Goldwane 18; latest: reached Wolfmere Outpost.`
// Ordered by the soonest return (no date last), then the newest news; over budget, the rest are left out of that reply (still kept).
// A back date that has passed moves nobody: the line says "due back" and the narrator brings them.

import { estimateTokens } from '../../atlas/relevance.js';
import { tables } from './away-domain.js';
import { cutPoints } from './away-text.js';
import { dateText } from './away-time.js';

const HEADER = '[Elsewhere] Away from the scene:';
const BUDGET = 300;

/** The paragraph and the kind's grammar line (NSD-WORDING.md, AWAYFOLLOW). */
export const TEXT = Object.freeze({
    static: 'When someone leaves the scene for a while (above all the people this story follows), write an away line with what they do and when they should be back; write a step line when news of them comes; write - away Name when they return. Under [Elsewhere] each away person has a line: let their story move on, and when one is due back, bring them back.',
    grammar: '+ away Name — what they are doing | back: date (~ away Name to change it; ! away Name — where they got to; - away Name when they are back)',
});

/** Whether the lines are taught: someone in the people store is followed (alive), or someone is away. */
export function awayTaught(state) {
    if (Object.keys(tables(state?.domains?.away).away).length) return true;
    const npcs = state?.domains?.people?.npcs;
    return Object.values(npcs && typeof npcs === 'object' ? npcs : {}).some(npc => npc?.followed === true && npc.lifeState !== 'deceased');
}

/** The away people in the tail's order: `[{ key, name, doing, since, back, due, last: { date, text } | null, steps }]`. `now`: the story clock, or null. */
export function awayEntries(slice, now) {
    const isInt = Number.isSafeInteger;
    const out = Object.entries(tables(slice).away).map(([key, away]) => {
        const back = isInt(away?.back) ? away.back : null;
        const steps = Array.isArray(away?.steps) ? away.steps.filter(step => step && typeof step === 'object') : [];
        const last = steps.at(-1) ?? null;
        return {
            key, name: String(away?.name ?? ''), doing: String(away?.doing ?? ''), since: isInt(away?.since) ? away.since : null, back,
            due: back !== null && isInt(now) && now >= back, last: last ? { date: isInt(last.date) ? last.date : null, text: String(last.text ?? '') } : null, steps,
        };
    });
    const soon = entry => (entry.back === null ? Infinity : entry.back);
    const late = entry => entry.last?.date ?? -Infinity;
    return out.sort((a, b) => soon(a) - soon(b) || late(b) - late(a) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

function awayLine(entry, calendar) {
    const doing = cutPoints(entry.doing, 90).replace(/[.!?…]+$/, '');
    const when = dateText(calendar, entry.back);
    const back = when ? (entry.due ? `, due back (${when})` : `, back ${when}`) : '';
    const latest = entry.last?.text ? `; latest: ${cutPoints(entry.last.text, 80).replace(/[.!?…]+$/, '')}` : '';
    return `${entry.name}: away${doing ? `, ${doing}` : ''}${back}${latest}.`;
}

/** The tail: `{ lines, tokens, left }`, the header and the lines that fit `budget` tokens; no lines when nobody is away or nothing fits. */
export function awayTail(slice, { now = null, calendar, budget = BUDGET } = {}) {
    const entries = awayEntries(slice, now);
    const lines = [HEADER];
    let left = 0;
    for (const entry of entries) {
        const line = awayLine(entry, calendar);
        if (left === 0 && estimateTokens([...lines, line].join('\n')) <= budget) lines.push(line);
        else left += 1;
    }
    if (lines.length < 2) return { lines: [], tokens: 0, left: entries.length };
    return { lines, tokens: estimateTokens(lines.join('\n')), left };
}
