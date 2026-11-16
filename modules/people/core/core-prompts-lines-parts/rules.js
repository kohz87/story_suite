/* NPC State one-pass lines builder: the rules part (cached; byte-identical every reply). Unwired: nothing sends it until N7.
   The approved NSD4 (goal and status), NSD5 (where, never presence) and NSD9 (what is not written; look, gender, age, birthday) texts;
   `moodWord` (default off, A/B-gated) adds the held NSD3 mood text. The relationships paragraph (NSD2) is not here: see src/npc-meters-prompt-parts/lines-text.js. */
const GOAL_STATUS = 'goal and status describe what someone is after and what they are doing now. Write them only when they changed in this reply, or for a person who is away from the scene. Never restate an unchanged one. When one has ended, write it as "clear" (goal: clear). Never write "Unknown".';
const WHERE = 'Do not write who is present; the scene says. Write where: only for a named person who is somewhere other than the scene, and only when the reply tells you where (~ npc Name | where: the harbour office). Never write where for someone in the scene, and never "Unknown".';
const NOT_WRITTEN = 'Do not write habits, tics, personality, speech style or how someone decides. They are written later from several scenes. The one exception is a change you can see in this reply: write ~ npc Name | look: what changed (clothes, a wound, a new form) as the full current look in one sentence. If the story states a person\'s gender, age or birthday outright, write it (gender: female) once.';
const MOOD_WORD = 'Write mood as one plain word (mood: wary). Never write numbers for it.';

export function buildLinesRules({ moodWord = false } = {}) {
    return [GOAL_STATUS, WHERE, NOT_WRITTEN, ...(moodWord ? [MOOD_WORD] : [])].join('\n');
}
