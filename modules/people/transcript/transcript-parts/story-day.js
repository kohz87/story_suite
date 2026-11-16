// The story day of a message (its own dated block or the nearest earlier one), the tie day and the days a transcript names.
import { storyClockDayAt, storyDayFromText } from '../../core/core.js';
import { activeChat } from './gate.js';
import { readContext } from './source.js';

// Story day of a message: its own dated World State block, else the nearest earlier dated message
// (user turns and brief replies carry none). Null when nothing nearby is dated; callers then use turns.
export const STORY_DAY_LOOKBACK = 12;

export function storyDayAt(messageId) {
    const chat = activeChat(readContext().chat || []);
    const start = Number.isInteger(messageId) ? Math.min(messageId, chat.length - 1) : chat.length - 1;
    for (let i = start; i >= 0 && i > start - STORY_DAY_LOOKBACK; i -= 1) {
        // A hidden message (a faded reply is one) dates nothing: the prompts do not carry it, the story does not stand on it.
        if (chat[i]?.is_system) continue;
        const day = storyDayFromText(chat[i]?.mes || '');
        if (day !== null) return day;
    }
    return null;
}

// The day ties' last mention is kept in: Story Director's clock at that reply when hosted (v2, the source the dossier's dates use), else the
// message's story day above. A separate reader, so the stamps and prompts that use storyDayAt keep their day scheme. A reply's own day: a
// Re-read, swipe or replay gives the value live gave.
export function tieDayAt(messageId) {
    const chat = activeChat(readContext().chat || []);
    const at = Number.isInteger(messageId) ? Math.min(messageId, chat.length - 1) : chat.length - 1;
    const hosted = storyClockDayAt(at);
    return hosted !== null ? hosted : storyDayAt(messageId);
}

export function storyDaysForTranscript(transcript) {
    const days = {};
    for (const match of String(transcript || '').matchAll(/^\[m(\d+)\]/gm)) {
        const id = Number(match[1]);
        const day = storyDayAt(id);
        if (Number.isInteger(id) && day !== null) days[id] = day;
    }
    return days;
}
