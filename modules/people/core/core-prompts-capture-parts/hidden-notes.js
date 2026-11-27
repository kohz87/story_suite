/* Writes the hidden-note rules, the lines builder's story-event paragraph and the targeted-prompt addendum for the prompts. */
import { storyWatch } from './secret-watch.js';

const LAYERED_SECRETS_RULE = 'HIDDEN NOTES: for each NEW dossier-worthy NPC only (never an existing one), also return "secrets" in its npcs[] row: 2 to 5 layered hidden notes, light to deep, as many as the person is deep (a passing shopkeeper 2, someone central 4-5). Ground them in the established background; never contradict it or invent a rival backstory. Each {"title":"<=60 chars","text":"<=300 chars, one fact the player does not know yet","meter":"trust|affection|desire|tension","at":whole number 1..100, higher for deeper layers} or, for a layer that opens on a story event instead, {"title","text","when":"short event <=120 chars"}. Written once; never repeat or rewrite them later.';
// A targeted pass (backfill) is about one NEW dossier: the same notes, asked for that person.
const LAYERED_SECRETS_RULE_TARGET = LAYERED_SECRETS_RULE.replace('for each NEW dossier-worthy NPC only (never an existing one), also return "secrets" in its npcs[] row', 'this dossier is NEW: also return "secrets" in the npcs[] row of the target');
const watchItems = eventWatch => (Array.isArray(eventWatch) ? eventWatch : []).filter(item => item && item.key && item.event);
// `window`: the story given is a window of recent replies (a targeted pass), not only the current exchange.
function eventWatchRule(eventWatch, { window = false } = {}) {
    const watch = watchItems(eventWatch);
    if (!watch.length) return '';
    return storyWatch(window ? 'window' : 'current', watch);
}

/**
 * The scanner prompt's rules about hidden notes ('' when neither is asked), numbered from `start` after the last rule.
 * `layeredSecrets`: also write 2 to 5 layered notes for each NEW dossier-worthy NPC. `eventWatch`: [{ key, name, event }], the
 * story events of present NPCs' locked notes; the scan answers `secretEvents` with the keys of those the CURRENT exchange
 * clearly shows.
 */
export function hiddenNotePromptRules({ layeredSecrets = false, eventWatch = null, start = 16 } = {}) {
    const lines = [];
    if (layeredSecrets) lines.push(LAYERED_SECRETS_RULE);
    const rule = eventWatchRule(eventWatch);
    if (rule) lines.push(rule);
    return lines.length ? lines.map((line, index) => `\n${start + index}. ${line}`).join('') : '';
}

/**
 * The story events to look for in the lines builder ('' with none): [{ key, name, event, note? }]. The key the line is taught is the note's own id (`note`, as
 * the watch carries it beside the scan's short `sN` key; S2PA B3: a `~ reveal` line takes only a note id), else `key`.
 */
export function hiddenNoteEventLinesParagraph(eventWatch) {
    const watch = watchItems(eventWatch);
    if (!watch.length) return '';
    const keyOf = item => (typeof item.note === 'string' && item.note ? item.note : item.key);
    return `\n\n${storyWatch('lines', watch.map(item => ({ key: keyOf(item), name: item.name, event: item.event })))}`;
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
