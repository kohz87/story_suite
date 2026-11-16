// Story Director: fixed change-line instruction and NPC-plans-only rule for the note.

// About 165 tokens. {{user}} stays a literal macro: SillyTavern substitutes it.
export const CHANGE_INSTRUCTION = [
    'End your reply with one <Director>…</Director> block of change lines, one per line:',
    '+ kind Key — summary | label: value (new; kind: agenda, event, hook, quest, clock, beat or secret)',
    '~ Key — label: value (change only what changed)',
    '- Key — reason (resolved)',
    '! Key — what happened (a due item fired)',
    'Fields: now, then, on, due, leg, arrive, shown, encounter; a quest (a job {{user}} accepted, not an errand; a job only offered: + hook with giver, reward; done or failed: - it): type, giver, goal, reward, step, due, difficulty. Dates go only in on, due and arrive, with a clock time.',
    'Write only changes, never the whole list. Never write actions for {{user}}.',
].join('\n');
// While NPC State Delta is the source of truth for who an NPC is (Story Suite, area `npc`),
// about 20 tokens after the instruction (and in the planner's and capture's request), so an
// agenda never restates a dossier the reader keeps there.
export const NPC_PLANS_ONLY = 'NPC State Delta keeps who each NPC is: agenda lines give only what they plan and when.';
