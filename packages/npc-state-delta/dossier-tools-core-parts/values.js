/* NPC State Delta supporting tools: the small value helpers (trim to text, safe number, clamp text, escape html). */
import { escapeHtml } from '../src/util/html.js';

export function plain(value) { return String(value ?? '').trim(); }
export { escapeHtml };
export function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
export function clampText(value, limit = 240) { return String(value ?? '').slice(0, limit); }
