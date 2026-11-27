/* NPC State injection: the narrator's line on when a pack person would join the party, and the reader's view without it. */

const LEAD = 'would join the party: ';
const KEEP = ' (keep this to yourself; let it come about through the story, never say it outright)';
// The whole wording, in this one place (pending the owner's approval).
const JOIN_LINE = text => LEAD + text + KEEP;

// A line cut short by a budget has lost its ending: it then goes to the end of its line.
const literal = words => words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SENT = new RegExp(`(?:; )?${literal(LEAD)}[^\\n]*?(?:${literal(KEEP)}|$)`, 'gm');

/** The sent text as the reader may see it: the join line is left out. */
const hideJoinLines = text => String(text ?? '').replace(SENT, '');

export { JOIN_LINE, hideJoinLines };
