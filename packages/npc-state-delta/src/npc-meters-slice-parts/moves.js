// Moves meters on a record within the reply cap, the NPC limits and the range.
import { clamp, isInt, isObject, isReplyId, replyKey, sameReply } from '../npc-meters-config.js';
import { meterValue } from './meter-value.js';

// Moves meters on `record` (in place). `changes`: [{ meter (id), mode: 'add' | 'set', value }].
// `limit` holds each meter within cap of the value the reply `reply` (replyKey: its record ID, else its
// index) started from (story lines and scans) and within the NPC's own `limits` (growth stops at a
// ceiling, a fall at a floor; a value already past one moves only back toward it); without it (the
// reader's own set) only the range applies. `at`: the reply's index now, kept beside a record ID for
// "moved lately" in the tail.
export function moveMeters(record, changes, { defs, cap, reply, at = null, limit, limits = {}, story = false }) {
    const byId = new Map(defs.map(def => [def.id, def]));
    const known = replyKey(reply, reply) !== null;
    const windowOf = () => ({ reply, ...(isReplyId(reply) && isInt(at) && at >= 0 ? { at } : {}), from: { ...record.meters } });
    if (limit && known && !sameReply(record.turn, reply)) record.turn = windowOf();
    const moved = [];
    for (const change of changes) {
        const def = byId.get(change.meter);
        if (!def) continue;
        const before = meterValue(record, def);
        const asked = change.mode === 'add' ? before + change.value : change.value;
        let low = def.min;
        let high = def.max;
        let why = '';
        if (limit) {
            if (record.turn && known && !isInt(record.turn.from[def.id])) record.turn.from[def.id] = before;
            const base = known && isInt(record.turn?.from?.[def.id]) ? record.turn.from[def.id] : before;
            low = Math.min(Math.max(low, base - cap), before);
            high = Math.max(Math.min(high, base + cap), before);
            const bound = isObject(limits[def.id]) ? limits[def.id] : null;
            if (bound && isInt(bound.ceiling) && asked > before && bound.ceiling < high) { high = Math.max(bound.ceiling, before); why = 'ceiling'; }
            if (bound && isInt(bound.floor) && asked < before && bound.floor > low) { low = Math.min(bound.floor, before); why = 'floor'; }
        }
        const after = clamp(asked, low, high);
        record.meters[def.id] = after;
        const stop = after !== asked && why && after === (why === 'ceiling' ? high : low) ? why : '';
        // `ask`: what the line asked for before its impact tier cut the step.
        const wanted = isInt(change.ask) ? change.ask : asked;
        moved.push({ meter: def.id, label: def.label, before, after, asked: wanted, held: after !== wanted, ...(stop ? { stop } : {}) });
    }
    // The meters a story line named in this reply: Delta's own scan of the same reply leaves them to the story.
    if (story && limit && known && record.turn && sameReply(record.turn, reply)) {
        const named = new Set([...(Array.isArray(record.turn.story) ? record.turn.story : []), ...changes.map(change => change.meter)]);
        record.turn.story = [...named].filter(id => byId.has(id));
    }
    // The reader's own values are the new start of this reply's window (or end it).
    if (!limit && moved.length) {
        if (known) record.turn = windowOf();
        else delete record.turn;
    }
    return moved;
}
