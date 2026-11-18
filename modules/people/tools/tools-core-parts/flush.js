/* NPC State Delta supporting tools: flushing the canonical state durably and logging the outcome. */
import { recordToolEvent } from './events.js';
import { api } from './host-api.js';
import { activeChatKey } from './host-chat.js';

export async function flushDurably(chatKey, context) {
    if (activeChatKey() !== chatKey) throw new Error('The active chat changed before persistence completed.');
    try {
        const runtime = api();
        if (typeof runtime?.flush !== 'function') throw new Error('Canonical durable flush API is unavailable.');
        await runtime.flush();
        recordToolEvent('persistence', { chatKey, action: context, outcome: 'saved', persisted: true });
        return { persisted: true, error: null };
    } catch (error) {
        recordToolEvent('persistence', { chatKey, action: context, outcome: 'failed', persisted: false, detail: error?.message || error });
        return { persisted: false, error };
    }
}
