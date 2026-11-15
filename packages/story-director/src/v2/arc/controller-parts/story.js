// Extracts clean story text and recent chat history for the arc planner prompt.

// The most of the recent story the planner reads, in characters (the newest kept).
const RECENT_CHARS = 24000;
const MARKUP = /<!--[\s\S]*?-->|<(think|thinking|reasoning|Changes)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/** A message's story text for the planner: the hidden change lines and reasoning taken out. */
export function storyText(message) {
    return String(message?.mes ?? '').replace(MARKUP, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** The last `count` messages of the story as "Name: text", the newest RECENT_CHARS characters at most. */
export function recentStory(chat, count) {
    const messages = (Array.isArray(chat) ? chat : []).filter(message => message && !message.is_system).slice(-Math.max(1, count));
    const parts = messages.map(message => `${message.name || (message.is_user ? 'User' : 'Narrator')}: ${storyText(message)}`);
    let text = parts.join('\n\n');
    if (text.length > RECENT_CHARS) text = text.slice(text.length - RECENT_CHARS);
    return text;
}
