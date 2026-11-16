// Reading the stored last event of a reply: whether a stored text is a valid event (with its log rows) and its parsed form.
import { PACING_TIERS } from '../../legacy/relationship-pacing.js';
import { gateEventProblems, normalizeApproachKind } from '../npc-meters-gate.js';
import { AXES, EVENT_MAX, EVENT_TEXT_MAX, LOG_MAX } from './shared-limits.js';
import { DATE_MAX, NOTE_MAX, WHY_MAX, wholeInt } from './shared-fields.js';

// ---- the last event of a reply (record.lastEvent): what the reply's meter lines and scans asked, and what the day's allowance made of it ----
//
// Stored as ONE text leaf (compact JSON), so the host always writes and replays it whole: { at: reply, date, events: [{ src, ask, tier,
// held, note, mv }] } (up to 4 events, the oldest of its kind making room for a fifth; `ask`: the four built-in axes' asked amounts;
// `mv`: the signed amounts the event actually moved; `date`: the story date before the reply). Another event of the same reply writes the whole longer list.
// A new reply starts a new current event and keeps the one it replaces as the first of `prev` (the previous two replies' events, newest first, each
// squeezed to one row by snapshotOf), so the dossier lists the last three changes. Only a text that has `prev` keeps one: an older text (no `prev`) is
// written as it was (rule mark: old replies and their Re-reads stay byte-identical) until its reply is replaced; it then starts a log, never a made-up one.
// Nothing that decides meters reads it; it feeds the card and the next prompt's gate cue (npc-meters-prompt.js), so a gate event stays.

const SOURCES = ['story', 'scan'];
const axesOk = map => Boolean(map) && typeof map === 'object' && !Array.isArray(map) && Object.keys(map).every(axis => AXES.includes(axis) && wholeInt(map[axis]) && map[axis] !== 0 && Math.abs(map[axis]) <= 400);
const replyOk = value => (typeof value === 'string' && value.length > 0 && value.length <= 80) || (wholeInt(value) && value >= 0);

export function validEvent(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !SOURCES.includes(item.src) || !PACING_TIERS.includes(item.tier)) return false;
    if (typeof item.held !== 'boolean' || typeof item.note !== 'string' || item.note.length > NOTE_MAX) return false;
    // The anti-lever gate's part (npc-meters-gate.js): the approach the story line named, and the outcome when the gate fired.
    if (item.why !== undefined && (typeof item.why !== 'string' || !item.why || item.why.length > WHY_MAX)) return false;   // the story line's (or, rule NSDFOLLOW-3, the scan's) own reason, or its one-pass evidence (withEvidence)
    if (item.via !== undefined && !normalizeApproachKind(item.via)) return false;
    if (item.gate !== undefined && (!item.via || gateEventProblems(item.gate).length)) return false;
    if (item.mv !== undefined && !axesOk(item.mv)) return false;
    const ask = item.ask;
    return Boolean(ask) && typeof ask === 'object' && !Array.isArray(ask) && Object.keys(ask).every(axis => AXES.includes(axis) && wholeInt(ask[axis]) && ask[axis] !== 0);
}

/** The parsed last event ({ at, date, events }) of stored text, or null when it is absent or not valid in every part. */
export function readEvent(text) {
    if (typeof text !== 'string' || !text || text.length > EVENT_TEXT_MAX) return null;
    let value;
    try { value = JSON.parse(text); } catch { return null; }
    if (!value || typeof value !== 'object' || !replyOk(value.at) || typeof value.date !== 'string' || value.date.length > DATE_MAX) return null;
    if (!Array.isArray(value.events) || !value.events.length || value.events.length > EVENT_MAX || !value.events.every(validEvent)) return null;
    if (value.n !== undefined && !(wholeInt(value.n) && value.n >= 0)) return null;
    if (value.prev !== undefined && (!Array.isArray(value.prev) || value.prev.length > LOG_MAX || !value.prev.every(validRow))) return null;
    return value;
}

// One earlier reply as a row of the log: { at, n?, date, mv? | ask?, held, note?, why? } (mv: signed amounts moved; ask only for a text from before mv was kept).
function validRow(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !replyOk(row.at) || typeof row.date !== 'string' || row.date.length > DATE_MAX || typeof row.held !== 'boolean') return false;
    if (row.n !== undefined && !(wholeInt(row.n) && row.n >= 0)) return false;
    if (row.note !== undefined && (typeof row.note !== 'string' || row.note.length > NOTE_MAX)) return false;
    if (row.why !== undefined && (typeof row.why !== 'string' || !row.why || row.why.length > WHY_MAX)) return false;
    return [row.mv, row.ask].every(map => map === undefined || axesOk(map));
}
