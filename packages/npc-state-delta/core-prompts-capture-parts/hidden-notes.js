/* Writes the hidden-note rules, story-event paragraph and targeted-prompt addendum for the prompts. */
const LAYERED_SECRETS_RULE = 'HIDDEN NOTES: for each NEW dossier-worthy NPC only (never an existing one), also return "secrets" in its npcs[] row: 2 to 5 layered hidden notes, light to deep, as many as the person is deep (a passing shopkeeper 2, someone central 4-5). Ground them in the established background; never contradict it or invent a rival backstory. Each {"title":"<=60 chars","text":"<=300 chars, one fact the player does not know yet","meter":"trust|affection|desire|tension","at":whole number 1..100, higher for deeper layers} or, for a layer that opens on a story event instead, {"title","text","when":"short event <=120 chars"}. Written once; never repeat or rewrite them later.';
// A targeted pass (backfill) is about one NEW dossier: the same notes, asked for that person.
const LAYERED_SECRETS_RULE_TARGET = LAYERED_SECRETS_RULE.replace('for each NEW dossier-worthy NPC only (never an existing one), also return "secrets" in its npcs[] row', 'this dossier is NEW: also return "secrets" in the npcs[] row of the target');
const watchItems = eventWatch => (Array.isArray(eventWatch) ? eventWatch : []).filter(item => item && item.key && item.event);
// `window`: the story given is a window of recent replies (a targeted pass), not only the current exchange.
function eventWatchRule(eventWatch, { window = false } = {}) {
    const watch = watchItems(eventWatch);
    if (!watch.length) return '';
    const where = window ? 'the supplied story shows happened' : 'the CURRENT exchange clearly shows happened (never from earlier history, never a guess)';
    return `STORY EVENTS to look for (present NPCs' hidden notes): ${watch.map(item => `${item.key} = ${item.name}: ${item.event}`).join(' | ')}. Return top-level "secretEvents":["<key>",...] with ONLY the keys whose event ${window ? where + ' (clearly, never a guess)' : where}; [] or omit when none. ${EVENT_STRICT_RULE}`;
}

// The event must happen as written, by the actor it names; each returned key carries a quote the code checks (secretEventsShown).
const EVENT_STRICT_RULE = 'An event counts only when it happens as written, by the actor it names ("pressed" needs someone to press that person on it); the person raising the topic themselves, a mention, a hint or something about to happen does not. Also return "secretEventEvidence":{"<key>":"short exact quote showing the event"} for every key; no quote, no key.';

/**
 * The scanner prompt's rules about hidden notes ('' when neither is asked), numbered from `start` after the last rule.
 * `layeredSecrets`: also write 2 to 5 layered notes for each NEW dossier-worthy NPC. `eventWatch`: [{ key, name, event }], the
 * story events of present NPCs' locked notes; the scan answers `secretEvents` with the keys of those the CURRENT exchange
 * clearly shows. `events: false` leaves the watch out (a one-pass capture carries it in its context part, where the list that
 * changes from reply to reply belongs: hiddenNoteEventParagraph).
 */
export function hiddenNotePromptRules({ layeredSecrets = false, eventWatch = null, start = 16, events = true } = {}) {
    const lines = [];
    if (layeredSecrets) lines.push(LAYERED_SECRETS_RULE);
    if (events) {
        const rule = eventWatchRule(eventWatch);
        if (rule) lines.push(rule);
    }
    return lines.length ? lines.map((line, index) => `\n${start + index}. ${line}`).join('') : '';
}

/** The story events to look for, as a paragraph of its own ('' with none): the dynamic part of a one-pass capture. */
export function hiddenNoteEventParagraph(eventWatch) {
    const rule = eventWatchRule(eventWatch);
    return rule ? `\n\n${rule}` : '';
}

/**
 * A targeted prompt (backfill, Refresh) with the hidden notes it was asked for, as paragraphs at its end. `layeredSecrets`
 * (a backfill of a NEW dossier only) and `eventWatch` (this one person's locked event notes) are the only options; given
 * neither, the prompt is returned as it is.
 */
export function appendHiddenNotePrompt(prompt, { layeredSecrets = false, eventWatch = null } = {}) {
    const parts = [];
    if (layeredSecrets) parts.push(LAYERED_SECRETS_RULE_TARGET);
    const rule = eventWatchRule(eventWatch, { window: true });
    if (rule) parts.push(rule);
    return parts.length ? `${prompt}\n\n${parts.join('\n\n')}` : prompt;
}
