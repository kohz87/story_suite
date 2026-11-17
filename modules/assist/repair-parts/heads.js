// The fixed text blocks of the repair prompt (model-facing): its head, the foot and the labels of the parts after it.

export const REPAIR_HEAD = [
    'A reply in an interactive story should have ended with a block of change lines, but it came with none. Read the reply and write the block it should have had, as change lines, one per line:',
    'op kind Name[ — text][ | label: value]',
    'op: + new or gained, - gone or lost, ~ changed, ! happened.',
    'Use only these kinds:',
].join('\n');

export const REPAIR_FOOT = [
    'Write a line for each thing the reply clearly tells, with numbers only where it gives them: time passing, a new place, who is there at the end, coin paid or received, items gained, given away or used up, quest and hook progress, a person who joins or changes.',
    'The state lines below are the story as it stood before this reply. Use them for the exact names of places, people and items, and never write a line that only repeats them.',
    'Coin and items: write + coin, - coin, + item or - item only for what the reply plainly shows changing hands, once for each thing, with the amount or count the reply gives.',
    'Place: name where the reply ENDS, the last place the story is at, never a stop on the way; use the exact name of a known place when the story is at one. If the scene ends where it was, write no place line.',
    'Presence is the scene at the END: + present only for someone there when the reply ends; - present for someone present before who is gone at the end.',
    'A time line needs a clock time like the story date and time below (~ time <date>, 9:30 am sets it; ! time +2h moves it on): "midday" is not a time, so write no time line unless the reply gives a clock time or a stretch.',
    'If nothing changed, answer with an empty block: <Changes></Changes>',
    'Answer with the lines only, between <Changes> and </Changes>.',
].join('\n');

export const STATE_HEAD = 'The story before this reply:';
export const REPAIR_REPLY_HEAD = 'The reply:';
