// The two thrown markers for an operation that ends early without a result of its own: the chat file took nothing, or another chat is open.

// Two ways an operation ends early that are not a result of its own: the chat file could not take what the journal says
// (nothing may go on, be retried as if it had, or be announced), and the chat that was open when the operation began is no
// longer the open one (nothing it has left to write belongs to the chat that is). Both are thrown and answered by `guarded`.
const NOT_DURABLE = Symbol.for('story-block.timeline.not-durable');
const STALE_CHAT = Symbol.for('story-block.timeline.stale-chat');
/** The chat file could not be written. */
export function notDurable(message) {
    const error = new Error(message);
    error[NOT_DURABLE] = true;
    return error;
}
export const isNotDurable = error => Boolean(error) && error[NOT_DURABLE] === true;
/** Another chat is open than the one this operation began in. */
export function staleChat(message = 'Another chat was opened while this was done; nothing was changed in the chat that is open now.') {
    const error = new Error(message);
    error[STALE_CHAT] = true;
    return error;
}
export const isStaleChat = error => Boolean(error) && error[STALE_CHAT] === true;
