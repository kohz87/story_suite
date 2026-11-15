// Cards under replies (fix 8e): the socket a module uses to put a card under an assistant message (WIDGETS.md, "Cards under
// replies"; the README's "How modules connect" table). A module declares `cards: { <id>: { for(state, message, ctx) → card | null } }`.
// `for` is asked once per card, about the HEAD reply (the newest assistant message; in a chat that holds only the greeting, the
// greeting), with the head's state, its SillyTavern message object and `ctx.head === true`. When it answers, the card is drawn under
// the head reply with its actions enabled; older replies carry no module cards. So a card follows the story: a start card goes when
// the character exists, and a second fight's battle card sits under the newest reply, not the first fight's. A card the module
// stops returning goes away on the next draw (a character made, a fight ended); a swipe or a delete moves it with the head.
//
// A card: { tone: 'accent'|'bad'|'good'|'info', icon: 'ph-…' | 'fa-…', title, text?, rows?: [{ icon?, text, tag?, tagTone? }] (at most 4),
// actions?: [{ id, label, icon?, primary?, command?, payload?, open? }] (at most 4), later?: true|false }. An action runs its `command`
// (sdk.command, recorded with the reply) or opens its `open` screen in the game view; `later` adds a Later button that folds the card
// into one line. Text is plain: the host prints it, never parses it. `normalizeCard` drops what it cannot read; a card without a title
// is no card.
//
// The Later state is the viewer's (localStorage, per chat and card key): it is not game state, so it is never in a command or a save.
// It is cleared when the card stops being drawn, so a later card of the same id starts unfolded.
// Pure except for the storage that `laterStore` takes; no DOM.
// Public face: re-exports its parts.

export { CARD_TONES, CARD_ROWS_MAX, CARD_ACTIONS_MAX, normalizeCard } from './reply-cards-parts/read.js';
export { scanReplyCards } from './reply-cards-parts/scan.js';
export { laterStore } from './reply-cards-parts/later.js';
export { replyEdits, replyRules } from './reply-cards-parts/rules.js';
export { THIS_REPLY_ID, orderSections, sectionHeading } from './reply-cards-parts/sections.js';
export { SUMMARY_JOIN, mergeSummaries } from './reply-cards-parts/summary.js';
