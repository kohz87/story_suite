// The prompt foot: the plain one and the one with the world and faction lines, chosen by the grammar.

import { grammarKind } from './grammar.js';

const FOOT_LINES = [
    'Write a line only for what the reply clearly tells and its own lines (below) do not already say, with numbers only where it gives them. If nothing is missing, answer: none',
    'Write a place line only when the reply moves the scene. Name where the reply ENDS, the last place the story is at, never a stop on the way. If the scene ends at the place it is at now, write no place line.',
    'Presence is the scene at the END: + present only for someone there when the reply ends, never someone met at a stop on the way; - present for someone present before who is gone at the end.',
    'A place line uses the exact name of a known place whenever the reply is at one the map has (known places are listed below). A time line needs a clock time like the story date and time below (~ time <date>, 9:30 am sets it; ! time +2h moves it on): "midday" and "mid-morning" are not times, so write no time line unless the reply gives a clock time or a stretch. A line with an unknown name for a known place, or a time without a clock time, is refused.',
];
const FOOT_LAST = 'Answer with the lines only, between <Changes> and </Changes>.';
// The two lines added only when a world or faction kind is allowed (other readers' prompts stay as they were).
export const WORLD_FOOT = [
    'Parts after the first | are always written label: value (place: Dragonfang, factions: Ashen Court, area: the north, state: ongoing).',
    'World news and faction lines: when an open world event or a faction is listed below as already kept, reuse its exact name with ~ to update it; write + only for something new. Never change a stance the reply does not show changing, and never make a faction out of a place or a city name.',
];
export const EXTRACTOR_FOOT = [...FOOT_LINES, FOOT_LAST].join('\n');
/** The foot for the kinds' grammar lines: EXTRACTOR_FOOT, with WORLD_FOOT before its last line when a world or faction kind is among them. */
export function footFor(grammar = []) {
    return grammar.some(line => ['world', 'faction'].includes(grammarKind(line))) ? [...FOOT_LINES, ...WORLD_FOOT, FOOT_LAST].join('\n') : EXTRACTOR_FOOT;
}
