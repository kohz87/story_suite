// The `judge` field of a chronicle entry (switch story-director.world-events, setting "the Director judges new world lines"): a narrator's
// new world entry waits for the Director's verdict (`pending`, heard as rumour), then holds what the verdict did. Pure.

export const JUDGE_STATES = Object.freeze(['pending', 'accepted', 'reshaped', 'kept', 'refused']);
const KEY = /^[0-9a-f]{12}$/;
const MAX_CONDITIONS = 6;
const MAX_WHY = 200;
const FIELDS = new Set(['state', 'key', 'conditions', 'why']);

/** `validateJudgeField(value, at)` → string[]: `{ state, key, conditions?: ['name@ref'], why? }`, or no field at all. */
export function validateJudgeField(value, at) {
    if (value === undefined) return [];
    const ok = value !== null && typeof value === 'object' && !Array.isArray(value)
        && JUDGE_STATES.includes(value.state) && typeof value.key === 'string' && KEY.test(value.key)
        && (value.conditions === undefined || (Array.isArray(value.conditions) && value.conditions.length <= MAX_CONDITIONS && value.conditions.every(key => typeof key === 'string' && key.includes('@') && key.length <= 200)))
        && (value.why === undefined || (typeof value.why === 'string' && value.why.length <= MAX_WHY))
        && Object.keys(value).every(key => FIELDS.has(key));
    return ok ? [] : [`${at}.judge must be { state (${JUDGE_STATES.join(', ')}), key, conditions?, why? }.`];
}
