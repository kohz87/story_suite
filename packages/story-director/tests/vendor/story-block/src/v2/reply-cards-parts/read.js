// Reads a module's raw card into a clean card: tone, icon, title, text, rows and actions.

import { oneLine } from '../../text.js';
import { isRecord } from './shared-record.js';

export const CARD_TONES = Object.freeze(['accent', 'bad', 'good', 'info']);
export const CARD_ROWS_MAX = 4;
export const CARD_ACTIONS_MAX = 4;
const ICON = /^(ph-[a-z0-9-]+(:fill)?|fa-[a-z0-9-]+)$/;
const COMMAND = /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i;

const iconOf = (value, fallback) => (typeof value === 'string' && ICON.test(value.trim()) ? value.trim() : fallback);

function rowOf(raw) {
    if (!isRecord(raw)) return null;
    const text = oneLine(raw.text ?? '', 120);
    if (!text) return null;
    const tag = oneLine(raw.tag ?? '', 24);
    return { icon: iconOf(raw.icon, ''), text, tag, tagTone: CARD_TONES.includes(raw.tagTone) ? raw.tagTone : 'info' };
}

// A payload as plain JSON (what a command or a dialog's draft takes), or {} when it cannot be copied (a loop, a BigInt, a getter that throws).
function payloadOf(value) {
    if (!isRecord(value)) return {};
    try {
        const copy = JSON.parse(JSON.stringify(value));
        return isRecord(copy) ? copy : {};
    } catch {
        return {};
    }
}

function actionOf(raw, at) {
    if (!isRecord(raw)) return null;
    // (32 code points, the way benchLabel counts: an emoji name must not lose its tail to a UTF-16 cut)
    const label = [...oneLine(raw.label ?? '', 128)].slice(0, 32).join('');
    const command = typeof raw.command === 'string' && COMMAND.test(raw.command) ? raw.command : '';
    const open = typeof raw.open === 'string' && /^[A-Za-z0-9._\-/]{1,120}$/.test(raw.open) ? raw.open : '';
    if (!label || (!command && !open)) return null;
    const id = oneLine(raw.id ?? '', 40) || `action-${at}`;
    return {
        id,
        label,
        icon: iconOf(raw.icon, ''),
        primary: raw.primary === true,
        command,
        payload: payloadOf(raw.payload),
        open,
    };
}

/** A module's card, read: { tone, icon, title, text, rows, actions, later } or null when it has no title. */
export function normalizeCard(raw) {
    if (!isRecord(raw)) return null;
    const title = oneLine(raw.title ?? '', 60);
    if (!title) return null;
    const rows = (Array.isArray(raw.rows) ? raw.rows : []).map(rowOf).filter(Boolean).slice(0, CARD_ROWS_MAX);
    const actions = (Array.isArray(raw.actions) ? raw.actions : []).map(actionOf).filter(Boolean).slice(0, CARD_ACTIONS_MAX);
    return {
        tone: CARD_TONES.includes(raw.tone) ? raw.tone : 'info',
        icon: iconOf(raw.icon, 'ph-star'),
        title,
        text: oneLine(raw.text ?? '', 200),
        rows,
        actions,
        later: raw.later === true,
    };
}
