// Routing a learn or practice line to a skill slot (the typed-pool learn rule included).
import { fill } from '../../../../../../../core/strings.js';
import { fold } from '../../../lean-rpg/read.js';
import { SKILL_SLOTS_BASE, SKILL_SLOTS_EVERY, SKILL_SLOTS_MAX, SKILL_FIELDS_MAX, SLOT_NUMBER, STANCE_TYPES, UTILITY_SLOTS, isTypedSkills, skillTypeOf, signatureAt } from '../../../../../../../core/runtime/skill-slots.js';
import { J } from '../shared.js';
import { skillsNamed } from './naming.js';

// The Skills block's story lines never overwrite a slot (USER, 3 Nov). `learn-N` of a name some slot already holds updates that slot (a signature skill, one a
// pack's cast member brought, is never updated: it keeps its name and slot); a new name goes to slot N if it is empty and open, else the first open one, else the
// line is refused. A slot is open when the block has it and the character's level has opened it (names.js skillSlots: 5, a sixth at Lv 20, a seventh at 40, an
// eighth at 60; a level drop only closes the empty ones). `practice-N` whose reason names one of the skills credits that skill's slot.
// → { kind, slot, name, update? } | { refuse } | null (not one of these lines: as written).
export function skillRoute(fields, kindName, args, reason, room = SKILL_SLOTS_BASE, options = {}) {
    const typed = isTypedSkills(fields), top = typed ? SKILL_FIELDS_MAX : SKILL_SLOTS_MAX;
    const learn = new RegExp(`^learn-(${SLOT_NUMBER})$`, 'u').exec(kindName), practice = new RegExp(`^practice-(${SLOT_NUMBER})$`, 'u').exec(kindName);
    if ((!learn && !practice) || Number((learn ?? practice)[1]) > top) return null;
    const slots = Array.from({ length: top }, (_, i) => ({ n: i + 1, type: skillTypeOf(fields, i + 1), name: typeof fields[`skill${i + 1}`] === 'string' ? fields[`skill${i + 1}`] : '', signature: signatureAt(fields.sig, i + 1) }));
    if (learn) {
        const wanted = fold(args.name);
        const same = wanted ? slots.find(slot => slot.name && fold(slot.name) === wanted) : undefined;
        if (same?.signature) return { refuse: fill(J.signature, { who: typeof fields.who === 'string' ? fields.who : '', skill: same.name }) };
        if (same) return { kind: `learn-${same.n}`, slot: same.n, name: same.name, update: true };
        if (typed) return typedLearn(slots, learn, args, fields, room);
        const at = Number(learn[1]);
        const free = at <= room && !slots[at - 1].name ? at : slots.find(slot => slot.n <= room && !slot.name)?.n;
        if (free) return { kind: `learn-${free}`, slot: free, name: args.name };
        // (`full`: no open slot is free, the only reason a block is extended; the words say when the next slot opens, or that all eight hold a skill)
        const held = slots.filter(slot => slot.name).length;
        return { refuse: `No free skill slot for ${args.name}. ${held >= SKILL_SLOTS_MAX ? J.slotsFull : fill(J.slotLater, { level: Math.max(0, held + 1 - SKILL_SLOTS_BASE) * SKILL_SLOTS_EVERY })}`, full: true };
    }
    const named = options.skill !== undefined ? slots.filter(slot => slot.name && fold(slot.name) === fold(options.skill)) : skillsNamed(slots, reason);
    if (options.strict && (named.length > 1 || (options.skill !== undefined && named.length !== 1))) return { refuse: 'Name exactly one known skill to practise.' };
    const slot = named.length === 1 ? named[0].n : Number(practice[1]);
    return { kind: `practice-${slot}`, slot, name: slots[slot - 1].name };
}
// A learn line for a new name in a block with types: the line's `type` (utility, else combat) names the pool. A combat skill needs a free one of the slots the level opens (`room`), a
// utility skill one of the three; the skill goes to the slot the line names if it is empty, else the first empty one (any slot holds either type).
function typedLearn(slots, learn, args, fields, room) {
    // Combat Rules v1: an owner holds at most one stance skill (defence, evasion, movement or support). Only a v1 block has those types, so an earlier block never reaches this.
    if (STANCE_TYPES.includes(args.type) && slots.some(slot => slot.name && STANCE_TYPES.includes(fields[`type${slot.n}`]))) return { refuse: fill(J.stanceHeld, { skill: args.name }) };
    const type = args.type === 'utility' ? 'utility' : 'combat', cap = type === 'utility' ? UTILITY_SLOTS : room;
    const held = slots.filter(slot => slot.name && slot.type === type).length, empty = slots.filter(slot => !slot.name);
    if (held >= cap || !empty.length) {
        return { refuse: type === 'utility' ? fill(J.utilityFull, { skill: args.name, max: UTILITY_SLOTS })
            : `No free skill slot for ${args.name}. ${held >= SKILL_SLOTS_MAX ? J.slotsFull : fill(J.slotLater, { level: Math.max(0, held + 1 - SKILL_SLOTS_BASE) * SKILL_SLOTS_EVERY })}`, full: true };
    }
    const at = Number(learn[1]), free = empty.find(slot => slot.n === at) ?? empty[0];
    return { kind: `learn-${free.n}`, slot: free.n, name: args.name };
}
