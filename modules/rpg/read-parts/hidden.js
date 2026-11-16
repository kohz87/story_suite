// Finds a block's definition, fields and the fields its pack hides.
import { dmHidden } from '../../../packages/story-block/src/v2/data-modules/schema.js';
import { isObject, TEXT_KEY } from './shared-plain.js';

export const definitionOf = (domain, id) => {
    const pin = domain.pins?.[domain.active?.[id]?.hash];
    return isObject(pin?.definition) ? pin.definition : null;
};
export const fieldsOf = (domain, id) => {
    const instance = domain.instances?.[id]?.chat;
    return isObject(instance?.fields) ? instance.fields : null;
};

// A field the pack hides (`prompt: false`) is hidden from the story, not from the rules (review 160). A hidden text (a name, Who, an
// About) is not read at all: it would reach the sheet text, the plan and the cue. A hidden number or choice (health, a stat, Soul Class,
// a rank, a foe's count, class or health, a skill's stat or resource) still counts for the dice; the entry lists it in `hidden`, and
// the sheet text leaves it out.

export const hiddenOf = definition => new Set(Object.entries(isObject(definition?.state) ? definition.state : {}).filter(([key, schema]) => key !== 'alive' && dmHidden(schema)).map(([key]) => key));
export const shownFields = (fields, hidden) => (hidden.size ? Object.fromEntries(Object.entries(fields).filter(([key]) => !(hidden.has(key) && TEXT_KEY.test(key)))) : fields);
