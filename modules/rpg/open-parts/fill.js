// Fills free foe slots of the Foes blocks for each opened foe, and clears the Down groups left from earlier replies.
import { createEvaluation } from '../../data-modules/interpreter.js';
import { classOfLevel, levelOfClass } from '../foes.js';
import { fold, readSheet } from '../read.js';

// The level and class an entry stands for, so a Foes block of either rules takes it (a block of the earlier rules has a class, one of the Levels rules a level).
const argsOf = entry => (entry.level !== undefined
    ? { level: entry.level, class: classOfLevel(entry.level) }
    : { class: entry.class ?? 1, level: levelOfClass(entry.class) ?? 1 });

/** The foe-slot rules mark an opening is made with (2: stage 65, 3: `then:`). */
export const FIX_VERSION = 3;

/**
 * Fills a free slot (empty or Down) of the Foes blocks in `domain` (the data-module domain) for each entry of `open`, in order, through the block's
 * own `set-slot-N` kind (its effects, run by the block interpreter); a block with no such kind (a bare sheet) has the same four fields set, the
 * health full. An entry whose name is on a standing slot already, or that finds no free (empty or Down) slot, is passed over; a Down group of the same name is replaced in its own slot. The domain is changed in place.
 * An entry carries its `level` (the Levels rules, once resolve.js has settled it) or its `class` (a plan from before). → [{ slot, module, name, count, level | class }] the
 * slots filled (the sheet's slot numbers).
 */
export function openFoes(domain, open, { fix = FIX_VERSION, stale = [] } = {}) {
    const placed = [];
    // `stale`: slots of standing groups the pre-check put down (a scene that moved on, precall.js). Under `fix` 2+ they count as Down here: replaced when the
    // same name is opened, else free for a new group, else cleared after the new fight is placed, so the fight does not carry them.
    const old = new Set(fix >= 2 && Array.isArray(stale) ? stale : []);
    const down = foe => foe.filled && (foe.hurt === 0 || old.has(foe.slot));
    for (const entry of open ?? []) {
        const sheet = readSheet({ domains: { dataModules: domain } });
        // A group of that name that is standing is the one already there. A Down group (filled, hurt 0) is a beaten one and no longer holds its slot: a new
        // group of the same name replaces it, else the first empty or Down slot takes the new group, so five fights in a row never stall the block.
        const same = sheet.foes.find(foe => foe.filled && fold(foe.name) === fold(entry.name));
        // (A roll made before `fix: 2` keeps the earlier rule exactly: a filled group of the name stops the entry, only an empty slot is free, nothing is cleared.)
        if (fix < 2 ? same : same && !down(same)) continue;
        const free = fix < 2 ? sheet.foes.find(foe => foe.count === 0) : same ?? sheet.foes.find(foe => foe.count === 0 || down(foe));
        if (!free) continue;
        const n = free.local ?? ((free.slot - 1) % 4) + 1;
        const pin = domain.pins?.[domain.active?.[free.module]?.hash];
        const definition = pin?.definition;
        const instance = domain.instances?.[free.module]?.chat;
        if (!instance?.fields) continue;
        const kind = definition?.kinds?.[`set-slot-${n}`];
        if (kind?.effects && definition.state) {
            const evaluation = createEvaluation(definition, instance, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
            evaluation.effects(kind.effects, { arg: { name: entry.name, count: entry.count, ...argsOf(entry), ...(entry.tier !== undefined ? { tier: entry.tier } : {}) } });
            evaluation.rules();
            evaluation.finish();
        } else Object.assign(instance.fields, { [`foe${n}`]: entry.name, [`count${n}`]: entry.count, ...(entry.level !== undefined ? { [`level${n}`]: entry.level } : { [`class${n}`]: entry.class ?? 1 }), [`hurt${n}`]: 5 });
        placed.push({ slot: free.slot, module: free.module, name: entry.name, count: entry.count, ...(entry.level !== undefined ? { level: entry.level } : { class: entry.class ?? 1 }), ...(entry.tier !== undefined ? { tier: entry.tier } : {}) });
    }
    // A new fight has opened: the Down groups left from earlier replies are cleared in the same step (the block's own clear kind, else its four fields), so the Foes
    // block, the log's Status and the prompts show only this fight's foes. Opening happens before this reply's rolls, so a group that goes Down in this reply stays
    // until the next fight opens and its XP is still paid.
    if (placed.length && fix >= 2) {
        const taken = new Set(placed.map(entry => entry.slot));
        for (const stale of readSheet({ domains: { dataModules: domain } }).foes.filter(foe => down(foe) && !taken.has(foe.slot))) {
            const n = stale.local ?? ((stale.slot - 1) % 4) + 1;
            const definition = domain.pins?.[domain.active?.[stale.module]?.hash]?.definition;
            const instance = domain.instances?.[stale.module]?.chat;
            if (!instance?.fields) continue;
            const kind = definition?.kinds?.[`clear-${n}`];
            if (kind?.effects && definition.state) {
                const evaluation = createEvaluation(definition, instance, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
                evaluation.effects(kind.effects, { arg: { why: 'gone' } });
                evaluation.rules();
                evaluation.finish();
            } else Object.assign(instance.fields, { [`foe${n}`]: '', [`count${n}`]: 0, [`hurt${n}`]: 5 });
        }
    }
    return placed;
}
