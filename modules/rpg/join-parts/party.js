// Join: who is in the story's party, from the character blocks.

import { activeDefinition, instanceOf } from '../../../packages/story-block/src/v2/data-modules/adapters.js';
import { oneLine } from '../../../core/text.js';
import { newSoul } from '../view/wizard-data.js';
import { classOfLevel, levelOfClass } from '../formula.js';
import { soulReading } from '../soul.js';
import { isRecord } from './shared-record.js';

/** What this story's party calls the Soul Class: the first Character block's own field (companions who left too), else the template's. */
export function soulNaming(state) {
    const domain = state?.domains?.dataModules;
    for (const module of Object.keys(isRecord(domain?.active) ? domain.active : {})) {
        const definition = activeDefinition(state, module);
        if (definition?.role === 'character' && definition.scope === 'chat' && isRecord(definition.state?.soul)) return soulReading(definition.state.soul);
    }
    return newSoul();
}

/** The characters of the story's party, from a state: `[{ module, name, soul, level, left, canLeave }]` in block order (the ones who left too). `soul` is the Soul Class of an earlier block, else the class the level stands for (formula.js classOfLevel). */
export function partyOf(state) {
    const domain = state?.domains?.dataModules;
    const out = [];
    for (const module of Object.keys(isRecord(domain?.active) ? domain.active : {})) {
        const definition = activeDefinition(state, module);
        if (definition?.role !== 'character' || definition.scope !== 'chat') continue;
        const fields = instanceOf(state, module)?.fields;
        if (!isRecord(fields)) continue;
        const name = oneLine(fields.who) || oneLine(definition.name);
        if (!name) continue;
        out.push({ module, name, soul: Number.isSafeInteger(fields.soul) ? fields.soul : Number.isSafeInteger(fields.level) ? classOfLevel(fields.level) : 1, level: Number.isSafeInteger(fields.level) ? fields.level : levelOfClass(Number.isSafeInteger(fields.soul) ? fields.soul : 1), left: fields.left === true, canLeave: Object.hasOwn(definition.state ?? {}, 'left') });
    }
    return out;
}

/** The highest Soul Class among the characters who are in the party (1 when there is none). */
export const partyCap = party => Math.max(1, ...party.filter(person => !person.left).map(person => person.soul));

/**
 * The members a full party's card offers to bench: active ones with a Left field, never the reader's own character (the one named like the
 * persona, `isMe(name)`; with none named so, the first block, as the rolls take it). → [{ module, name, level }] in block order.
 */
export function benchable(state, isMe = () => false) {
    const active = partyOf(state).filter(person => !person.left);
    const mine = active.some(person => isMe(person.name));
    return active.filter((person, at) => (mine ? !isMe(person.name) : at > 0) && person.canLeave).map(({ module, name, level }) => ({ module, name, level }));
}
