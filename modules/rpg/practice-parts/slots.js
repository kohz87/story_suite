// Finds the Skills block slots the used skills sit in, what the story lines kept of them, and the witness of both.
import { skillFieldSlots } from '../../../../../../core/runtime/skill-slots.js';
import { fold } from '../read.js';
import { isObject, whole, text, pairKey } from './shared-values.js';

// The Skills block of a character and the slot of a skill in it, as readSheet joins them (the first block with that Who that holds a skill), or null.
export function slotOf(domain, who, skill) {
    for (const module of Object.keys(isObject(domain?.active) ? domain.active : {}).sort()) {
        const definition = domain.pins?.[domain.active[module]?.hash]?.definition;
        const fields = domain.instances?.[module]?.chat?.fields;
        if (definition?.role !== 'skills' || !isObject(fields) || fold(text(fields.who)) !== fold(who)) continue;
        for (let slot = 1; slot <= skillFieldSlots(fields); slot += 1) {
            if (text(fields[`skill${slot}`]) && fold(text(fields[`skill${slot}`])) === fold(skill)) return { module, slot, name: text(fields[`skill${slot}`]) };
        }
        if (Array.from({ length: skillFieldSlots(fields) }, (_, i) => text(fields[`skill${i + 1}`])).some(Boolean)) return null;
    }
    return null;
}

// What the reply's story lines kept of the slots they practised: `perReply[<sid>/<swipeKey>].practiceFrom` = { [module]: { [slot]: { practice, rank } } }.
export function fromOf(domain, source) {
    const out = {};
    const kept = domain?.perReply?.[pairKey(source)]?.practiceFrom;
    if (!isObject(kept)) return out;
    for (const [module, slots] of Object.entries(kept)) {
        if (!isObject(slots)) continue;
        for (const [slot, was] of Object.entries(slots)) {
            if (isObject(was) && whole(was.practice) && whole(was.rank)) (out[module] ??= {})[slot] = { practice: was.practice, rank: was.rank };
        }
    }
    return out;
}

// The skills the uses name, joined by slot: [{ module, slot, who, skill, n, practice, rank }] (a skill no longer on a sheet is left out), practice summed per slot.
export function itemsOf(domain, uses) {
    const items = new Map();
    for (const use of uses) {
        const found = slotOf(domain, use.who, use.skill);
        if (!found) continue;
        const key = `${found.module}\u0000${found.slot}`;
        const fields = domain.instances[found.module].chat.fields;
        const item = items.get(key) ?? { module: found.module, slot: found.slot, who: use.who, skill: found.name, n: 0, practice: fields[`practice${found.slot}`], rank: fields[`rank${found.slot}`] };
        item.n += use.n;
        items.set(key, item);
    }
    return [...items.values()];
}

export const witnessOf = (domain, source, uses) => ({ items: itemsOf(domain, uses), from: fromOf(domain, source) });
