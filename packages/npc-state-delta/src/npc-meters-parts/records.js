// Builds and edits one NPC's record: who a change is about, a new entry, problems, meter changes, stages, notes and impact tiers.
import { RELATIONSHIP_KEYS, applyRelationshipDelta, normalizeRelationshipCaps } from '../../core-mechanics.js';
import { CUSTOM_RANGE, MAX_NPCS, MAX_PROBLEMS, MAX_UNLOCKED, NAME_MAX, clamp, clean, intOr, isInt, isObject, npcKey, slug } from '../npc-meters-config.js';
import { findNpcKey, meterValue, settle } from '../npc-meters-slice.js';

/** The record helpers of one npc part, built on its hook readers. */
export function createNpcRecords({ resolve, setupFor, rulesFor, rungsFor }) {
    // Who a change is about: the entry key, the name it shows, the dossier's labels and numbers.
    function identify(npcs, label) {
        const asked = clean(label, NAME_MAX);
        if (!asked) return null;
        const dossier = resolve(asked);
        const name = clean(dossier?.name ?? asked, NAME_MAX);
        const labels = [name, asked, ...(Array.isArray(dossier?.aliases) ? dossier.aliases : [])].map(item => clean(item, NAME_MAX)).filter(Boolean);
        const key = findNpcKey(npcs, labels) ?? npcKey(name);
        if (!key) return null;
        return { key, name, labels, seed: isObject(dossier?.relationship) ? dossier.relationship : null };
    }

    function ensure(ctx, npcs, who, defs, seed) {
        if (Object.hasOwn(npcs, who.key)) return false;
        if (Object.keys(npcs).length >= MAX_NPCS) ctx.fail('REFUSED', `NPC State Delta keeps meters for up to ${MAX_NPCS} people; ${who.name} was not added.`);
        const meters = {};
        for (const def of defs) {
            const given = intOr(seed?.[def.id], null);
            meters[def.id] = given === null ? def.start : clamp(given, def.min, def.max);
        }
        // `milestones` is made with the entry, so a later reply's milestone is an add under an object
        // the entry's first reply made (a middle delete never leaves it without its parent).
        npcs[who.key] = { name: who.name, meters, stages: {}, unlocked: [], milestones: {} };
        return true;
    }

    function note(slice, rev, problems) {
        if (!problems.length) return;
        if (!Array.isArray(slice.problems)) slice.problems = [];
        for (const text of problems) slice.problems.push({ rev: isInt(rev) ? rev : 0, text });
        if (slice.problems.length > MAX_PROBLEMS) slice.problems.splice(0, slice.problems.length - MAX_PROBLEMS);
    }

    // Meter changes from a record of numbers ({ trust: 3 }); unknown names become problems.
    function changesFrom(meters, defs, mode, problems) {
        const byId = new Map(defs.flatMap(def => [[def.id, def], [slug(def.label), def]]));
        const changes = [];
        for (const [name, raw] of Object.entries(isObject(meters) ? meters : {})) {
            const def = byId.get(slug(name));
            if (!def) { problems.push(`"${name}" is not a meter (meters: ${defs.map(item => item.id).join(', ')}).`); continue; }
            const value = Number(raw);
            if (!Number.isFinite(value) || Math.abs(value) > CUSTOM_RANGE.max * 2) { problems.push(`${def.label} was given ${JSON.stringify(raw)}, which is not a whole number.`); continue; }
            changes.push({ meter: def.id, mode, value: Math.round(value) });
        }
        return changes;
    }

    // Stages, ladder and notes of one record, with this NPC's own setup.
    const settleRecord = (record, labels, settings, defs, tick = false) => {
        const setup = setupFor(record.name, labels);
        return settle(record, {
            defs, stages: settings.stages, rules: rulesFor(record.name, labels), name: record.name,
            rungs: rungsFor(settings, setup), conflictAt: settings.conflictAt, demoteAfter: settings.demoteAfter, tick,
        });
    };

    // Opens and shuts notes of one record. `notes`: { open: [id], close: [id], story: bool }. A story event may
    // only open a note that has an event (`when`); the reader's hand may open or shut any of its notes. A shut
    // note is kept in `held`, so a meter does not open it again; opening it takes it out of `held`.
    function openCloseNotes(record, rules, notes) {
        const known = new Map(rules.filter(rule => rule && typeof rule.id === 'string').map(rule => [rule.id, rule]));
        const ids = list => [...new Set(Array.isArray(list) ? list.filter(id => typeof id === 'string' && known.has(id)) : [])];
        const held = new Set(Array.isArray(record.held) ? record.held : []);
        const before = JSON.stringify([record.unlocked, [...held]]);
        const opened = [];
        if (!notes.story) {
            for (const id of ids(notes.close)) {
                const at = record.unlocked.indexOf(id);
                if (at >= 0) record.unlocked.splice(at, 1);
                if (held.size < MAX_UNLOCKED) held.add(id);
            }
        }
        for (const id of ids(notes.open)) {
            if (record.unlocked.includes(id) || record.unlocked.length >= MAX_UNLOCKED) continue;
            if (notes.story && (!known.get(id).when || held.has(id))) continue;
            record.unlocked.push(id);
            held.delete(id);
            opened.push({ id, text: `${record.name}: a hidden note opened (${notes.story ? 'the story' : 'by hand'})` });
        }
        if (held.size) record.held = [...held];
        else delete record.held;
        return { opened, changed: JSON.stringify([record.unlocked, [...held]]) !== before };
    }

    // A story line's moves through the impact tiers. The built-in meters move as Delta's scanner moves them
    // (applyRelationshipDelta: the tier's cap, the resistance of a deep value, the milestone gates), one meter at a
    // time, so a line that names two meters moves each; a move too small to show a whole point is kept on the record
    // as `progress` and adds up on the next line. A custom meter's step is held to the tier's cap. `=N` is a move
    // toward N. The per-reply cap and the meter's range still apply after (moveMeters).
    // → the changes as { meter, mode: 'add', value, ask } (`ask`: the value the line asked for).
    function tiered(record, changes, defs, { tier, caps }) {
        const byId = new Map(defs.map(def => [def.id, def]));
        const limits = normalizeRelationshipCaps(caps);
        const live = Object.fromEntries(RELATIONSHIP_KEYS.map(id => [id, meterValue(record, byId.get(id))]));
        const part = isObject(record.progress) ? { ...record.progress } : {};
        const out = [];
        for (const change of changes) {
            const def = byId.get(change.meter);
            if (!def) continue;
            const before = RELATIONSHIP_KEYS.includes(def.id) ? live[def.id] : meterValue(record, def);
            const asked = change.mode === 'add' ? before + change.value : change.value;
            const delta = asked - before;
            let step;
            if (RELATIONSHIP_KEYS.includes(def.id)) {
                const update = applyRelationshipDelta(live, { [def.id]: delta }, tier, limits, { [def.id]: Number(part[def.id]) || 0 });
                step = update.appliedDelta[def.id];
                live[def.id] = update.relationship[def.id];
                part[def.id] = update.relationshipProgress[def.id];
            } else {
                const cap = limits[tier];
                step = Math.max(-cap, Math.min(cap, delta));
            }
            out.push({ meter: def.id, mode: 'add', value: step, ask: asked });
        }
        const kept = Object.fromEntries(Object.entries(part).filter(([, value]) => value));
        if (Object.keys(kept).length) record.progress = kept;
        else delete record.progress;
        return out;
    }

    return { identify, ensure, note, changesFrom, settleRecord, openCloseNotes, tiered };
}
