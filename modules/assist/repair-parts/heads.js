// The fixed text blocks of the repair prompt (model-facing): its head, the foot and the labels of the parts after it.

export const REPAIR_HEAD = [
    'A reply in an interactive story should have ended with a block of change lines, but it came with none. Read the reply and write the block it should have had, as change lines, one per line:',
    'op kind Name[ — text][ | label: value]',
    'op: + new or gained, - gone or lost, ~ changed, ! happened.',
    'Use only these kinds:',
].join('\n');

export const REPAIR_FOOT = [
    'Write a line for each thing the reply clearly tells, with numbers only where it gives them: time passing, a new place, who is there at the end, coin paid or received, items gained, given away or used up, quest and hook progress, a person who joins or changes.',
    'The state lines below are the story as it stood before this reply. Use them for the exact names of places, people and items, and never write a line that only repeats them (an item already under Carried is not gained again). A lead already listed under Open hooks or Open quests is never added again, whatever words the reply uses for it: write ~ or - for it only when the reply changes or closes it.',
    'Coin and items: write + coin, - coin, + item or - item only for what the reply plainly shows changing hands, once for each thing, with the amount or count the reply gives.',
    'Place: name where the reply ENDS, the last place the story is at, never a stop on the way; use the exact name of a known place when the story is at one. If the scene ends where it was, write no place line.',
    'Presence is the scene at the END: + present only for someone there when the reply ends; - present for someone present before who is gone at the end.',
    'Time: "~ time 9:30 am" sets a clock time today, only when the reply gives one; "! time +Nm", "! time +Nh" or "! time +Nd" moves the story on by a stretch of minutes, hours or days. Write a time line whenever what happens in the reply takes time, even with no clock time given: walking across the village and buying bread is about ! time +20m. When the reply says time passed ("by dusk", "next morning", "after a long walk"), estimate the stretch from the story time given below (e.g. morning to dusk is about ! time +10h). Count only the time the reply itself tells, counted from the story time given below: a walk from first light to late afternoon is about ! time +10h, never a day more. Write a stretch of a day or more only when the reply says a day or more passed ("the next morning", "two days later"). After a stretch of a day or more, when the reply also gives the time of day ("after dusk", "at noon", "by candlelight"), write the clock time on the next line: "! time +10d" then "~ time 7:00 pm". Never write a date, and write no time line when no time passed.',
    'If nothing changed, answer with an empty block: <Changes></Changes>',
    'Answer with the lines only, between <Changes> and </Changes>.',
].join('\n');

export const STATE_HEAD = 'The story before this reply:';
export const REPAIR_REPLY_HEAD = 'The reply:';
