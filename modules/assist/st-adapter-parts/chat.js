// Reads SillyTavern's chat array and the open chat's id.

import { context } from './shared-context.js';

/** SillyTavern's chat array (empty without SillyTavern). */
export function stChat() {
    const chat = context()?.chat;
    return Array.isArray(chat) ? chat : [];
}

/** The open chat's id ('' when there is none). */
export function stChatId() {
    const ctx = context();
    try {
        return String(ctx?.getCurrentChatId?.() ?? ctx?.chatId ?? '');
    } catch {
        return '';
    }
}
