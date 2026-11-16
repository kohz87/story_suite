// Settles stages, the ladder and hidden notes after a change (rung checks, conflict hold, demotion on tick).
import { DEFAULT_CONFLICT_AT, isInt, MAX_UNLOCKED, needMet, own, stageAt, thresholdReached } from '../npc-meters-config.js';
import { meterValue } from './meter-value.js';

/** True when every need of `step` holds on `record` and its milestone (if any) is set. */
export function rungMet(record, step, defs) {
    const byId = new Map(defs.map(def => [def.id, def]));
    const needs = step.needs.every(need => byId.has(need.meter) && needMet(need, meterValue(record, byId.get(need.meter))));
    return needs && (!step.milestone || own(record.milestones, step.milestone.key));
}

export const conflictOn = (record, defs, conflictAt) => meterValue(record, defs.find(def => def.id === 'tension') ?? { id: 'tension', start: 0 }) > conflictAt;

// Stages, the ladder and notes after a change: moves each stage to where its meter now stands,
// promotes on the ladder while the next rung is met (never in a conflict), counts and demotes on
// Delta's tick (`tick`), and unlocks the notes whose rule is met.
// → { stages: [{ meter, from, to, text }], ranks: [{ from, to, text }], held: text | '', unlocked: [{ id, text }] }.
export function settle(record, { defs, stages, rules, name, rungs = [], conflictAt = DEFAULT_CONFLICT_AT, demoteAfter = 0, tick = false }) {
    const moves = [];
    for (const def of defs) {
        const list = stages[def.id] ?? [];
        const old = typeof record.stages[def.id] === 'string' ? record.stages[def.id] : null;
        if (!list.length) {
            // The reader took this meter's stages away: the old name goes quietly.
            if (old !== null) delete record.stages[def.id];
            continue;
        }
        const value = meterValue(record, def);
        const now = stageAt(list, value);
        if ((now?.name ?? null) === old) continue;
        if (now) record.stages[def.id] = now.name;
        else delete record.stages[def.id];
        const was = list.find(stage => stage.name === old) ?? null;
        const further = now && (!was || Math.sign(now.at) !== Math.sign(was.at) || Math.abs(now.at) > Math.abs(was.at));
        const text = now
            ? (further ? `${name}: ${def.label.toLocaleLowerCase()} reached ${now.name}` : `${name}: ${def.label.toLocaleLowerCase()} fell back to ${now.name}`)
            : `${name}: ${def.label.toLocaleLowerCase()} left ${old}`;
        moves.push({ meter: def.id, from: old, to: now?.name ?? null, text });
    }
    const ranks = [];
    let held = '';
    if (!rungs.length) {
        // No ladder for this NPC (the feature is off, or the reader took it away): quietly gone.
        delete record.rank;
        delete record.low;
    } else {
        let at = rungs.findIndex(step => step.key === record.rank);
        if (record.rank !== undefined && at < 0) { delete record.rank; delete record.low; }
        const from = at;
        while (at + 1 < rungs.length && rungMet(record, rungs[at + 1], defs)) {
            if (conflictOn(record, defs, conflictAt)) {
                held = `${name}: ${rungs[at + 1].name} waits while tension is above ${conflictAt}`;
                break;
            }
            at += 1;
        }
        if (at > from) {
            record.rank = rungs[at].key;
            delete record.low;
            // A pack stage's line for the story goes with it (only the rung finally reached).
            ranks.push({ from: from >= 0 ? rungs[from].key : null, to: rungs[at].key, text: `${name}: now ${rungs[at].name}${rungs[at].cue ? ` (${rungs[at].cue.replace(/[.!?]+$/, '')})` : ''}` });
        } else if (at >= 0) {
            if (rungMet(record, rungs[at], defs)) delete record.low;
            else if (tick && demoteAfter > 0) {
                record.low = (isInt(record.low) ? record.low : 0) + 1;
                if (record.low >= demoteAfter) {
                    delete record.low;
                    const lost = rungs[at];
                    at -= 1;
                    if (at >= 0) record.rank = rungs[at].key;
                    else delete record.rank;
                    ranks.push({ from: lost.key, to: at >= 0 ? rungs[at].key : null, text: at >= 0 ? `${name}: fell back to ${rungs[at].name}` : `${name}: no longer ${lost.name}` });
                }
            }
        }
    }
    const opened = [];
    const byId = new Map(defs.map(def => [def.id, def]));
    const shut = Array.isArray(record.held) ? record.held : [];
    for (const rule of Array.isArray(rules) ? rules : []) {
        if (!rule || typeof rule.id !== 'string' || record.unlocked.includes(rule.id) || record.unlocked.length >= MAX_UNLOCKED) continue;
        // A note the reader shut stays shut; one that opens only on a story event waits for the scan.
        if (shut.includes(rule.id)) continue;
        const def = byId.get(rule.meter);
        if (!def || !isInt(rule.at)) continue;
        const value = meterValue(record, def);
        if (!thresholdReached(value, rule.at)) continue;
        record.unlocked.push(rule.id);
        opened.push({ id: rule.id, text: `${name}: a hidden note opened (${def.label.toLocaleLowerCase()} ${value})` });
    }
    return { stages: moves, ranks, held, unlocked: opened };
}
