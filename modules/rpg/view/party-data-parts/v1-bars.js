// A Combat Rules v1 Character on the Party tab: HP, MP and SP are plain numbers (fields hp, mp, sp) with their largest value kept in a hidden field (hp-max, mp-max, sp-max).

import { STATS_V1 } from '../../names.js';
import { whole } from './shared-basics.js';
import { stageTone } from './stages.js';

/** The field each of the party tab's three bars is stored in on a v1 Character. */
export const V1_BAR_FIELDS = Object.freeze({ health: 'hp', mana: 'mp', stamina: 'sp' });

/** Is this Character block one made under Combat Rules v1 (it has an `hp` field)? */
export const isV1Character = definition => Boolean(definition?.state?.hp) && typeof definition.state.hp === 'object';

/** The three bars of a v1 Character as the tab draws them: `{ value, max, word: '', text: "6 of 9", tone, numbers: true, field }`. */
export function v1Bars(definition, fields) {
    return Object.fromEntries(Object.entries(V1_BAR_FIELDS).map(([key, field]) => {
        const max = Math.max(1, whole(fields?.[`${field}-max`], whole(definition.state[field]?.max, 1))), value = Math.min(max, Math.max(0, whole(fields?.[field], 0)));
        return [key, { value, max, word: '', text: `${value} of ${max}`, tone: stageTone(value, max), numbers: true, field }];
    }));
}

/** The seven stats of a v1 Character, as the card lists them: [{ key, label, value, min, max }]. */
export const v1Stats = (definition, fields) => STATS_V1.map(key => {
    const schema = definition.state?.[key] ?? {};
    return { key, label: typeof schema.label === 'string' && schema.label && [...schema.label].length <= 4 ? schema.label : key.toUpperCase(), value: whole(fields?.[key], schema.min ?? 1), min: whole(schema.min, 1), max: whole(schema.max, 30) };
});
