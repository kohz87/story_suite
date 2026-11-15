/* NPC State Delta dossier surface: reply-number change stamps, the header label and the stamp markup. */
import { escapeHtml } from '../src/util/html.js';
import { wholeNumber } from './values.js';

// Reply numbers (1.2.3). A change recorded with its reply's chat message index shows "reply #N", the
// numbering Story Block shows (the greeting is reply #0). A record from before 1.2.3 has only Delta's
// own scan counter, which drifts from the chat with swipes and rescans; it keeps its old "turn N".
const LEGACY_TURN_NOTE = "Delta's own scan count, recorded before 1.2.3; it is not the reply number";

export function changeStamp(record = {}) {
    const message = wholeNumber(record?.message);
    if (message !== null) {
        return { message, legacy: false, text: `reply #${message}`, label: `Reply #${message}`, mark: `#${message}`, title: `Changed at reply #${message}` };
    }
    const turn = record?.turn === null || record?.turn === undefined || record?.turn === '' ? NaN : Number(record.turn);
    if (!Number.isFinite(turn)) return { message: null, legacy: false, text: '', label: '', mark: '', title: '' };
    return { message: null, legacy: true, text: `turn ${turn}`, label: `Turn ${turn}`, mark: `T${turn}`, title: `Changed at turn ${turn} (${LEGACY_TURN_NOTE})` };
}

// The dossier header: the latest assistant reply's message index, as Story Block's "reply #N".
export function replyHeaderLabel(projection = {}) {
    if (!projection?.chatKey || projection.chatKey === 'no-chat') return 'No chat';
    if (projection.hydrationStatus && projection.hydrationStatus !== 'ready') return projection.hydrationStatus === 'error' ? 'Unavailable' : 'Loading…';
    const reply = wholeNumber(projection.reply);
    return reply === null ? 'No replies yet' : `Reply #${reply}`;
}

function stampHtml(stamp, tag = 'small', className = '') {
    if (!stamp.label) return '';
    const classes = [className, stamp.legacy ? 'delta-legacy-turn' : ''].filter(Boolean).join(' ');
    return `<${tag}${classes ? ` class="${classes}"` : ''}${stamp.legacy ? ` title="${escapeHtml(stamp.title)}"` : ''}>${escapeHtml(stamp.label)}</${tag}>`;
}

export { stampHtml };
