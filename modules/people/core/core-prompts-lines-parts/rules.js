/* NPC State one-pass lines builder: the rules part (cached; byte-identical every reply). Unwired: nothing sends it until N7.
   The approved NSD4 (goal and status), NSD5 (where, never presence) and NSD9 (what is not written; look, gender, age, birthday) texts;
   The approved NSD8 (memories come from the lines; ~ memory only for a moment no line covers) text;
   The approved NSD6 (a new person is a one-line stub) and NSD7 (changed fields only; the identity sentence kept) texts.
   The approved NSD13 (death is a line) text.
   `moodWord` (default off, A/B-gated) adds the held NSD3 mood text. The relationships paragraph (NSD2) is not here: see src/npc-meters-prompt-parts/lines-text.js. */
const GOAL_STATUS = 'goal and status describe what someone is after and what they are doing now. Write them only when they changed in this reply, or for a person who is away from the scene. Never restate an unchanged one. When one has ended, write it as "clear" (goal: clear). Never write "Unknown".';
const WHERE = 'Do not write who is present; the scene says. Write where: only for a named person who is somewhere other than the scene, and only when the reply tells you where (~ npc Name | where: the harbour office). Never write where for someone in the scene, and never "Unknown".';
const NOT_WRITTEN = 'Do not write habits, tics, personality, speech style or how someone decides. They are written later from several scenes. The one exception is a change you can see in this reply: write ~ npc Name | look: what changed (clothes, a wound, a new form) as the full current look in one sentence. If the story states a person\'s gender, age or birthday outright, write it (gender: female) once.';
const NEW_PEOPLE = 'New people: the first time a named person appears who is not in the list above, write + npc Name | role | look. role is two or three words (the harbour clerk). look is one short phrase of what you wrote about their appearance, at most 100 characters; leave it out for someone from the character card. That is all. Do not write their background, speech, mannerisms, secrets or anything else here; the full profile is filled in from the story afterwards. Never write + npc for a person already listed, and never for the player or the character you play. A title alone (the guard) is not a person until the story gives a name.';
const CHANGED_ONLY = 'Write only what changed in this reply. Never write "keep", an empty value, a summary of the relationship, or a field again with the same value. Match people by the names in the list above; a person already listed with only a title who now has a name is the same person: use the listed name.';
const MEMORIES = 'Memories: the words of a line you write (why:, a lie, a milestone) are saved as that person\'s memory. Do not write them again. Only for a moment no line covers (a confession, a promise, a shared joke) write ~ memory Name | what happened in one past-tense sentence. At most two a reply. Never repeat or reword a memory already stored.';
const DEATH = 'Death: when the story shows that a named person died (not "almost", not a rumour, not a wound), write ~ npc Name | died | how: one sentence. This is final: never write that person as alive, present or speaking afterwards. Never write died for someone whose death you are unsure of.';
const MOOD_WORD = 'Write mood as one plain word (mood: wary). Never write numbers for it.';

export function buildLinesRules({ moodWord = false } = {}) {
    return [GOAL_STATUS, WHERE, NOT_WRITTEN, NEW_PEOPLE, CHANGED_ONLY, MEMORIES, DEATH, ...(moodWord ? [MOOD_WORD] : [])].join('\n');
}
