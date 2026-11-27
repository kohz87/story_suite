/* NPC State injection: the narrator's line on when a pack person would join the party, and the reader's view without it. */

const LEAD = 'would join the party: ';
const KEEP = ' (keep this to yourself; let it come about through the story, never say it outright)';
// The whole wording, in this one place (approved by the owner, 27 Nov).
const JOIN_LINE = text => LEAD + text + KEEP;

// Only the generated shape is hidden: after its "; " separator, either cut short by a budget (the line then ends in "…") or up to the exact ending.
// The join line is the last thing on its person's line, so the ending meant is the line's last one: the words themselves may quote it.
const literal = words => words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SENT = new RegExp(`; ${literal(LEAD)}(?:[^\\n]*…$|[^\\n]*${literal(KEEP)})`, 'gm');

/** The sent text as the reader may see it: the join line is left out. */
const hideJoinLines = text => String(text ?? '').replace(SENT, '');

export { JOIN_LINE, hideJoinLines };
