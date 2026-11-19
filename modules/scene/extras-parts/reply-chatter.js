// Inner chatter and Choices of every reply (queries `chatter.replies` and `choices.replies`): each reply's own display lines, read from its own text.

// Each story reply's display read (`display(mes, message)`, as headChatter) in chat order, from the reader's first message on; the reader's
// messages, system ones, the greeting (before the reader's first message) and faded ones (`faded`: a Set of indexes) are left out.
function eachReply(chat, faded, display, take) {
    const list = Array.isArray(chat) ? chat : [];
    const firstUser = list.findIndex(message => message?.is_user);
    if (firstUser < 0 || typeof display !== 'function') return [];
    const out = [];
    for (let index = firstUser + 1; index < list.length; index += 1) {
        const message = list[index];
        if (!message || message.is_user || message.is_system || faded?.has?.(index)) continue;
        let read = {};
        try { read = display(String(message.mes ?? ''), message) ?? {}; } catch { read = {}; }
        const item = take(read, index);
        if (item) out.push(item);
    }
    return out;
}

/**
 * Every reply's own Inner chatter (query `chatter.replies`, for the Chatter tab of each reply's card): [{ index, lines: [{ name, text }] }] for the
 * replies that have any, in chat order, each read from its own text, so a swipe shows its own and a delete leaves each remaining reply with its own.
 */
export function replyChatter(chat, faded, display) {
    return eachReply(chat, faded, display, (read, index) => {
        const lines = (Array.isArray(read.chatter) ? read.chatter : []).filter(item => item?.name && item?.text).map(item => ({ name: String(item.name), text: String(item.text) }));
        return lines.length ? { index, lines } : null;
    });
}

/** Every reply's own Choices (query `choices.replies`, for the Choices tab of each reply's card): [{ index, choices: [text] }], the same rules as replyChatter. */
export function replyChoices(chat, faded, display) {
    return eachReply(chat, faded, display, (read, index) => {
        const choices = (Array.isArray(read.choice) ? read.choice : []).map(item => String(item?.text ?? '').trim()).filter(Boolean);
        return choices.length ? { index, choices } : null;
    });
}
