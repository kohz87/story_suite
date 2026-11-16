// The chat's counts: messages, replies, records and bytes.

/** The chat's counts: { messages, replies, records, bytes } (bytes: the messages as JSON, about the file's size). */
export function chatCounts(chat) {
    const list = Array.isArray(chat) ? chat : [];
    let replies = 0;
    let records = 0;
    let bytes = 0;
    const encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    for (const message of list) {
        if (message && !message.is_user && !message.is_system) replies += 1;
        if (message?.extra?.storySuite && typeof message.extra.storySuite === 'object') records += 1;
        let line = '';
        try { line = JSON.stringify(message) ?? ''; } catch { line = ''; }
        bytes += (encoder ? encoder.encode(line).length : line.length) + 1;
    }
    return { messages: list.length, replies, records, bytes };
}
