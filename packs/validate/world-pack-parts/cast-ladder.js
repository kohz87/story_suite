// The job: the shape checks of a world-pack person's behaviour lines, starting meters and bond stages. Pure.

import { CAST_BEHAVIOUR_LEVELS, CAST_BEHAVIOUR_LEVERS, CAST_BUILT_IN_METERS, METER_LIMITS, SLUG, WORLD_CAST_LIMITS } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
import { isObject } from '../core.js';
import { plain } from './cast-fields.js';

const whole = value => Number.isInteger(value) && value >= -100 && value <= 100;
const only = (record, fields, at, say) => { for (const key of Object.keys(record)) if (!fields.includes(key)) say(`${at}.${key}`, `"${key}" is not a field here (expected ${fields.join(', ')}).`, 'UNKNOWN_FIELD'); };
const listOf = (value, field, max, say) => (value === undefined ? [] : !Array.isArray(value) || value.length > max ? (say(field, `${field} must be a list of at most ${max} entries.`), []) : value);

export function behaviour(value, say) {
    return listOf(value, 'behaviour', WORLD_CAST_LIMITS.behaviour, say).flatMap((line, n) => {
        const at = `behaviour[${n}]`;
        const match = typeof line === 'string' ? /^([^:]*?)\s*:\s*([^\s-]+)\s*[-–—]\s*(.+)$/u.exec(oneLine(line)) : null;
        const lever = match && CAST_BEHAVIOUR_LEVERS.find(word => word.toLowerCase() === match[1].trim().toLowerCase());
        if (!lever) return say(at, `${at} must read "Label: low, medium or high - what they do" (labels: ${CAST_BEHAVIOUR_LEVERS.join(', ')}).`), [];
        if (!CAST_BEHAVIOUR_LEVELS.includes(match[2].toLowerCase())) return say(at, `${at}: the level "${match[2]}" must be low, medium or high (not "mid").`), [];
        return [`${lever}: ${match[2].toLowerCase()} - ${match[3].trim()}`];
    });
}

/** Meters: starting values toward You, −100..100; the four built-ins, a preset id, or a custom meter id. */
export function meters(value, say) {
    if (value === undefined) return undefined;
    if (!isObject(value) || Object.keys(value).length > METER_LIMITS.meters + 2) return say('meters', 'meters must be an object like { "trust": 20, "tension": -10 }.'), undefined;
    const out = {};
    for (const [key, number] of Object.entries(value)) {
        if (key === 'preset') { if (typeof number === 'string' && SLUG.test(number)) out.preset = number; else say('meters.preset', 'meters.preset must be a meter preset id.'); }
        else if (!SLUG.test(key)) say(`meters.${key}`, `"${key}" is not a meter id.`);
        else if (!whole(number)) say(`meters.${key}`, `meters.${key} must be a whole number from -100 to 100.`);
        else out[key] = number;
    }
    return out;
}

/** Stages `{ name, needs: [{ meter, at }], text, milestone? }`: names unique, at most 8, every meter one the person has. */
export function stages(value, meterMap, say) {
    const seen = new Set();
    return listOf(value, 'stages', WORLD_CAST_LIMITS.stages, say).flatMap((stage, n) => {
        const at = `stages[${n}]`;
        if (!isObject(stage)) return say(at, `${at} must be { "name", "needs": [{ "meter", "at" }], "text", "milestone"? }.`), [];
        only(stage, ['name', 'needs', 'text', 'milestone'], at, say);
        if (!plain(stage.name, METER_LIMITS.name) || /[|:#]/.test(stage.name)) return say(`${at}.name`, `${at}.name must be plain text of 1 to ${METER_LIMITS.name} characters (no | : #).`), [];
        if (seen.has(stage.name)) return say(`${at}.name`, `two stages are named "${stage.name}".`, 'DUPLICATE'), [];
        seen.add(stage.name);
        if (!Array.isArray(stage.needs) || !stage.needs.length || stage.needs.length > METER_LIMITS.needs) return say(`${at}.needs`, `${at}.needs must be a list of 1 to ${METER_LIMITS.needs} { "meter", "at" }.`), [];
        for (const [k, need] of stage.needs.entries()) {
            const where = `${at}.needs[${k}]`;
            if (!isObject(need) || Object.keys(need).some(key => key !== 'meter' && key !== 'at')) return say(where, `${where} must be { "meter": …, "at": … }.`), [];
            if (typeof need.meter !== 'string' || !(CAST_BUILT_IN_METERS.includes(need.meter) || Object.hasOwn(meterMap ?? {}, need.meter) || typeof meterMap?.preset === 'string')) return say(`${where}.meter`, `"${String(need.meter)}" is not one of this person's meters.`, 'UNKNOWN_REF'), [];
            if (!whole(need.at)) return say(`${where}.at`, `${where}.at must be a whole number from -100 to 100.`), [];
        }
        if (!plain(stage.text, WORLD_CAST_LIMITS.line * 2)) return say(`${at}.text`, `${at}.text is the stage's description: plain text of 1 to ${WORLD_CAST_LIMITS.line * 2} characters.`), [];
        if (stage.milestone !== undefined && !plain(stage.milestone, METER_LIMITS.milestone)) return say(`${at}.milestone`, `${at}.milestone must be plain text (an NPC State milestone).`), [];
        return [{ name: stage.name, needs: stage.needs.map(need => ({ meter: need.meter, at: need.at })), text: oneLine(stage.text), ...(stage.milestone === undefined ? {} : { milestone: oneLine(stage.milestone) }) }];
    });
}
