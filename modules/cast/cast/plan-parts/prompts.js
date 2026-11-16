// Story Director v2, part **cast**: system prompts and story/message character limits for the cast planner.

/** The longest recent story a batch or judge call reads (characters). */
export const RECENT_CHARS = 3500;
/** The longest message or reply a 'sought' call reads (characters). */
export const SOUGHT_CHARS = 1200;

export const SYSTEM = `You run the off-screen cast of an ongoing story between {{user}} and {{char}}. These people live their own lives while {{user}} is somewhere else. You decide only what changes for them, and which of them, if any, are pulled towards {{user}}. You do not write the story, and you never decide what {{user}} does.

## Rules
- Each person has a goal and a routine. As time passes people follow their routine and work towards their goal. Write a line only for a person whose situation really changed; leave the others out.
- Keep it small, true to who they are and in step with the time that passed. Nobody is in two places at once, and travel takes time.
- A person is pulled towards {{user}} only when one of their "drawn to" phrases is touched by the recent story. Say in one sentence what in the story pulls them. When nothing does, write no such line.
- Use a place name from the list when one fits.
- Plain words, a few words to a part. No dialogue, no rewards, no numbers, no commentary, no markdown.`;

// Mode 'sought': {{user}} may be looking for a kind of person ("a healer or sister around"). The call answers at most one line, and only with
// words that stand in the message or the reply; code refuses any others (sought.js `citedIn`).
export const SOUGHT_SYSTEM = `You run the off-screen cast of an ongoing story between {{user}} and {{char}}. You decide only whether {{user}} is looking for a KIND of person (a healer, a priest, a smith, a guide, a sister...) that one of the people listed fits. You do not write the story, and you never decide what {{user}} does.

## Rules
- Look at {{user}}'s latest message first, then at the story's last reply. Only a request for a kind of person counts: {{user}} asking for, hoping to find, or looking around for such a person. A person merely mentioned or already present does not count.
- Choose a person only when their calling or what is said about them fits the kind asked for. Never choose someone for a loose or doubtful fit.
- Quote the exact words of the message or reply that ask for them, copied letter for letter. Never invent a request or reword it.
- At most one person. When nobody fits, answer nothing.
- Plain words. No commentary, no markdown.`;
