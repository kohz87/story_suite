// Applies one change to the npc slice: pacing, the anti-lever gate, tiers, meters, mood, milestones, notes and settling.
import { normalizeRelationshipCaps } from '../../core-mechanics.js';
import { applyEvents, eventsFromMoves } from '../../npc-mood.js';
import { gateStoryLine } from '../../npc-meters-gate.js';
import { FEATURE_GATE, FEATURE_MOOD_PULL, MAX_MILESTONES, NPC_DOMAIN, isInt, isObject, isReplyId, readLeaf, replyKey, sameReply } from '../npc-meters-config.js';
import { logKept, meterValue, moodStands, moveMeters, reasonKept, result, writeMood } from '../npc-meters-slice.js';
import { pacedTier, spendFlatEvent } from '../relationship-pacing.js';
import { askedOf, cutToTier, dayRuleFor, movesOf, nextEvent, pacingNote, withEvidence } from '../npc-meters-pacing.js';

/** The change runner of one npc part, built on its readers and record helpers. */
export function createNpcRun({ normalized, defsFrom, identify, ensure, setupFor, timeMinutes, tierAllowance, clockDay, clockMinutes, dateOf, featureOn, tiered, tierCaps, limitsFor, rulesFor, openCloseNotes, settleRecord, note }) {
    // `milestone`: { add: [{ key, name }], remove: [key] } (the reader's or a story line's).
    function run(ctx, { label, changes, problems, limit, reply, at = null, seed, disposition, allowEmpty = false, milestone = null, notes = null, impact = null, story = false, yieldToStory = false, scanTier = null, scanWhy = '', via = null, reason = '', leaf = null, evidence = null }) {
        const settings = normalized(ctx.settings(), ctx);
        const defs = defsFrom(settings);
        if (!changes.length && disposition === undefined && !allowEmpty) {
            ctx.fail('REFUSED', problems.length ? problems.join(' ') : 'It names no meter to change.');
        }
        const slice = ctx.draft(NPC_DOMAIN);
        if (!isObject(slice.npcs)) slice.npcs = {};
        if (!Array.isArray(slice.problems)) slice.problems = [];
        const who = identify(slice.npcs, label);
        if (!who) ctx.fail('INVALID', 'The change does not name anyone.');
        const created = ensure(ctx, slice.npcs, who, defs, seed ?? who.seed);
        const record = slice.npcs[who.key];
        if (!isObject(record.stages)) record.stages = {};
        if (!Array.isArray(record.unlocked)) record.unlocked = [];
        const setup = setupFor(record.name, who.labels);
        // Delta's scan of a reply whose story line already moved a meter leaves that meter to the line (one move, not two).
        const left = yieldToStory && limit && record.turn && sameReply(record.turn, reply) && Array.isArray(record.turn.story) ? record.turn.story : [];
        let mine = left.length ? changes.filter(change => !left.includes(change.meter)) : changes;
        // That scan's one-pass evidence is the reason of the line's event that gave none (a Re-read of an older read keeps none); nothing else: refused, unwritten.
        const stamped = evidence && left.length ? withEvidence(record.lastEvent, replyKey(reply, reply), reasonKept(ctx, who.key, evidence)) : null;
        if (stamped) record.lastEvent = stamped; else if (evidence && !changes.length) ctx.fail('REFUSED', 'Nothing to update.');
        // Pacing (relationship-pacing.js): one event per line or scanner change, counted once whatever number of meters it names.
        // A story line (`impact`) and a forwarded scanner change (`scanTier`) share the record's count; a change with neither is not paced.
        const asked = impact?.tier ?? pacedTier(scanTier);
        const rule = dayRuleFor(ctx, who.key), now = rule ? timeMinutes(ctx) : null;
        const spent = asked && mine.length && limit ? spendFlatEvent(record.impactDay, { tier: asked, reply: replyKey(reply, reply), clockDay: clockDay(at, now), allowance: tierAllowance() }) : null;
        if (spent?.next) record.impactDay = spent.next;
        const pace = spent ? pacingNote(asked, spent.used, spent.skipped, rule ? dateOf(at, now) : '', rule ? clockDay(at, now) : null) : '';
        const askedNow = spent ? askedOf(mine, id => meterValue(record, defs.find(def => def.id === id))) : null;
        // The anti-lever gate (npc-meters-gate.js): a story line's named approach, repeated to this person within the window, gives
        // less, then backfires; the ring is written with the move. Not a scan's, not a line the day's allowance held, not without a story day.
        const gated = via && story && limit && featureOn(FEATURE_GATE, ctx) && !(spent && !spent.used) ? gateStoryLine({
            changes: mine, read: id => meterValue(record, defs.find(def => def.id === id)), via, day: clockDay(at, now), reply: replyKey(reply, reply), name: record.name, settings: ctx.settings(), stored: record.via, cap: impact ? normalizeRelationshipCaps(impact.caps)[spent?.used ?? impact.tier] : null,
        }) : null;
        if (gated) { mine = gated.changes; if (gated.ring) record.via = gated.ring; }
        let stepped = mine;
        if (spent && !spent.used) stepped = [];
        else if (impact) stepped = tiered(record, mine, defs, { ...impact, tier: spent?.used ?? impact.tier });
        else if (spent?.used && spent.used !== asked) stepped = cutToTier(mine, spent.used, normalizeRelationshipCaps(tierCaps() ?? {}), id => meterValue(record, defs.find(def => def.id === id)));
        const moved = moveMeters(record, stepped, { defs, cap: settings.changeCap, reply, at, limit, limits: limitsFor(settings, setup), story });
        // Mood (npc-mood.js; feature mood-pull): the trust this line moved, as code reads it, is a trust drop or a betrayal.
        if (limit && moved.length && featureOn(FEATURE_MOOD_PULL, ctx) && moodStands(ctx, who.key)) {
            const day = clockMinutes(at, now) ?? timeMinutes(ctx);
            const events = day === null ? [] : eventsFromMoves(moved.map(item => ({ meter: item.meter, change: item.after - item.before })), { reason, impact: spent?.used ?? asked });
            if (events.length) writeMood(ctx, who.key, record, { prev: readLeaf(record.mood), mood: applyEvents(readLeaf(record.mood), day, events), day, n: isInt(at) ? at : null, s: isReplyId(reply) ? reply : null, date: dateOf(at, now) });
        }
        // This event's outcome, written whole on the record (display only; the card's tier, held and asked).
        if (spent && replyKey(reply, reply) !== null) {
            const text = nextEvent(record.lastEvent, { reply: replyKey(reply, reply), date: dateOf(at, now), src: impact ? 'story' : 'scan', ask: askedNow, tier: spent.used ?? asked, held: !spent.used, note: pace, via: gated?.via, gate: gated?.event, why: reasonKept(ctx, who.key, reason || scanWhy), mv: movesOf(moved), n: isInt(at) ? at : null, log: logKept(ctx, who.key, replyKey(reply, reply)) });
            if (text) record.lastEvent = text;
        }
        if (!limit) {
            // The reader's own value for a built-in meter ends the part-points the story lines had gathered on it.
            for (const change of changes) if (record.progress) delete record.progress[change.meter];
            if (record.progress && !Object.keys(record.progress).length) delete record.progress;
        }
        if (disposition !== undefined) {
            if (disposition) record.disposition = disposition;
            else delete record.disposition;
        }
        // A note kind's new leaf (npc-notes-kinds.js), written whole in this line's op; an empty text drops the leaf.
        if (leaf?.field) { if (leaf.text) record[leaf.field] = leaf.text; else delete record[leaf.field]; }
        let marked = null;
        if (milestone) {
            const had = isObject(record.milestones) ? record.milestones : {};
            const next = { ...had };
            for (const key of milestone.remove ?? []) delete next[key];
            const added = (milestone.add ?? []).filter(item => !Object.hasOwn(had, item.key));
            for (const item of added) next[item.key] = item.name;
            if (Object.keys(next).length > MAX_MILESTONES) ctx.fail('REFUSED', `${record.name} can keep up to ${MAX_MILESTONES} milestones.`);
            if (JSON.stringify(next) === JSON.stringify(had)) {
                ctx.fail('REFUSED', milestone.add?.length === 1 && !milestone.remove?.length
                    ? `${record.name} already has the milestone “${had[milestone.add[0].key] ?? milestone.add[0].name}”.` : 'Those milestones are already as given.');
            }
            // Each milestone is its own key: added and taken away by key, never as a list.
            if (!isObject(record.milestones)) record.milestones = {};
            for (const key of milestone.remove ?? []) delete record.milestones[key];
            for (const item of added) record.milestones[item.key] = item.name;
            marked = added.length === 1 ? added[0] : null;
        }
        // Notes opened or shut by hand or by a story event, before the meters are looked at again.
        const handled = notes ? openCloseNotes(record, rulesFor(record.name, who.labels), notes) : null;
        const settled = settleRecord(record, who.labels, settings, defs);
        if (handled?.opened.length) settled.unlocked.unshift(...handled.opened);
        if (notes && !handled.changed && !settled.stages.length && !settled.ranks.length && !settled.unlocked.length) {
            ctx.fail('REFUSED', 'Nothing to update.');
        }
        note(slice, ctx.rev, problems);
        return result({ name: record.name, key: who.key, moved, settled, problems, created, disposition, milestone: marked, pace, dayRule: rule });
    }

    return { run };
}
