// Story Director v2, part **cast**: stripping hidden markup from messages and extracting recent story and sought texts.

// The hidden parts of a message out, as the arc planner reads the story.
const MARKUP = /<!--[\s\S]*?-->|<(think|thinking|reasoning|Changes|Changes-assist|Changes-assist-next)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/** The words of a message as the reader sees them: hidden comments and the change block out. */
export const shownText = mes => String(mes ?? '').replace(MARKUP, ' ');

/** The last few messages of the story as plain text, the newest characters kept. */
export function recentStory(chat, { messages = 3, chars = 3500 } = {}) {
    const list = (Array.isArray(chat) ? chat : []).filter(message => message && !message.is_system).slice(-messages);
    const text = list.map(message => `${message.name || (message.is_user ? 'User' : 'Narrator')}: ${String(message.mes ?? '').replace(MARKUP, '').replace(/\n{3,}/g, '\n\n').trim()}`).join('\n\n');
    return text.length > chars ? text.slice(text.length - chars) : text;
}

// ---- what the reader asked for -------------------------------------------------------------------------------------------------------

const byReader = message => Boolean(message) && message.is_user === true && !message.is_system;
const byStory = message => Boolean(message) && !message.is_user && !message.is_system;

/** The reader's latest message and the story's last reply as the reader sees them, or null when neither has words. */
export function soughtTexts(chat) {
    const list = Array.isArray(chat) ? chat : [];
    const reader = list.findLast(byReader);
    const reply = list.findLast(byStory);
    const texts = { reader: shownText(reader?.mes).trim(), reply: shownText(reply?.mes).trim() };
    return texts.reader || texts.reply ? texts : null;
}
