/* NPC State Delta supporting tools: the bounded tool-event log (what was opened, saved or failed, never private payloads). */
import { clampText } from './values.js';

const TOOL_EVENT_LIMIT = 60;

export const toolEvents = [];
export function boundedAppend(list, value, limit = TOOL_EVENT_LIMIT) {
    if (!Array.isArray(list)) return [];
    list.push(value);
    if (list.length > limit) list.splice(0, list.length - limit);
    return list;
}
function safeToolEvent(type, values = {}) {
    const allowed = {};
    for (const key of ['chatKey', 'npcId', 'action', 'outcome', 'detail', 'persisted', 'stale']) {
        if (!(key in values)) continue;
        const value = values[key];
        if (key === 'detail') continue; // UI may show errors transiently; records never retain private payloads.
        allowed[key] = typeof value === 'boolean' ? value : clampText(value, 120);
    }
    return { type: clampText(type, 80), at: Date.now(), ...allowed };
}

export function recordToolEvent(type, values = {}) {
    boundedAppend(toolEvents, safeToolEvent(type, values), TOOL_EVENT_LIMIT);
}
