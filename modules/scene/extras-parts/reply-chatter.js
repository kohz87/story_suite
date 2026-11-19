// Inner chatter of every reply (query `chatter.replies`): each reply's own thoughts, read from its own text.

/**
 * Every reply's own Inner chatter (query `chatter.replies`, for the lines drawn inside each reply): [{ index, lines: [{ name, text }] }] for the
 * replies that have any, in chat order, each read from its own text (`display(mes, message)`, as headChatter), so a swipe shows its own and a
 * delete leaves each remaining reply with its own. `chat` is the whole chat and `faded` the Set of the indexes of its faded messages (their
 * thoughts are left out); the reader's messages, system ones and the greeting (before the reader's first message) have none.
 */
export function replyChatter(chat, faded, display) {
    const list = Array.isArray(chat) ? chat : [];
    const firstUser = list.findIndex(message => message?.is_user);
    if (firstUser < 0 || typeof display !== 'function') return [];
    const out = [];
    for (let index = firstUser + 1; index < list.length; index += 1) {
        const message = list[index];
        if (!message || message.is_user || message.is_system || faded?.has?.(index)) continue;
        let read = {};
        try { read = display(String(message.mes ?? ''), message) ?? {}; } catch { read = {}; }
        const lines = (Array.isArray(read.chatter) ? read.chatter : []).filter(item => item?.name && item?.text).map(item => ({ name: String(item.name), text: String(item.text) }));
        if (lines.length) out.push({ index, lines });
    }
    return out;
}
