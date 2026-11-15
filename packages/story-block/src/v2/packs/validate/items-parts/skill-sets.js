// Checking skill sets and meter presets.

import { SLUG, TERM_SEPARATORS, LEAN_RPG_LIMITS, SKILL_SET_FIELDS, SKILL_SET_SKILL_FIELDS, METER_PRESET_FIELDS, METER_LIMITS, METER_FIELDS, METER_RESERVED, METER_STAGE_FIELDS } from '../../limits.js';
import { oneLine, foldKey } from '../../../../text.js';
import { isObject } from '../core.js';

export function checkSkillSet(record, path, label, add) {
    const L = LEAN_RPG_LIMITS;
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!SKILL_SET_FIELDS.includes(key)) say(key, `"${key}" is not a skill set field (expected ${SKILL_SET_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    if (oneLine(record.name).length > L.name) say('name', `name must be text of at most ${L.name} characters.`);
    const about = record.about === undefined ? '' : record.about;
    if (typeof about !== 'string' || oneLine(about).length > L.about) say('about', `about must be text of at most ${L.about} characters.`);
    const skills = [];
    if (!Array.isArray(record.skills) || !record.skills.length || record.skills.length > L.skills) say('skills', `skills must be a list of 1 to ${L.skills} skills: [{ "name": "Spark", "about": "A small burst of magic.", "stat": "int", "uses": "mana" }].`);
    else record.skills.forEach((skill, index) => {
        const at = `skills[${index}]`;
        if (!isObject(skill)) return say(at, `${at} must be an object.`);
        for (const key of Object.keys(skill)) if (!SKILL_SET_SKILL_FIELDS.includes(key)) say(`${at}.${key}`, `"${key}" is not a skill field (expected ${SKILL_SET_SKILL_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        const name = typeof skill.name === 'string' ? oneLine(skill.name) : '';
        if (!name || name.length > L.skillName) say(`${at}.name`, `${at}.name must be text of 1 to ${L.skillName} characters.`);
        else if (skills.some(other => foldKey(other.name) === foldKey(name))) say(`${at}.name`, `${at}.name repeats "${name}"; a set names each skill once.`, 'DUPLICATE');
        const what = typeof skill.about === 'string' ? oneLine(skill.about) : '';
        if (!what || what.length > L.skillAbout) say(`${at}.about`, `${at}.about must be text of 1 to ${L.skillAbout} characters (what the skill does; the story reads it).`);
        const stat = typeof skill.stat === 'string' ? skill.stat.trim().toLowerCase() : '';
        if (!L.stats.includes(stat)) say(`${at}.stat`, `${at}.stat must be one of ${L.stats.join(', ')}.`);
        const uses = skill.uses === undefined ? L.uses[0] : typeof skill.uses === 'string' ? skill.uses.trim().toLowerCase() : '';
        if (!L.uses.includes(uses)) say(`${at}.uses`, `${at}.uses must be ${L.uses.join(' or ')}.`);
        if (name && what && L.stats.includes(stat) && L.uses.includes(uses)) skills.push({ name, about: what, stat, uses });
    });
    return ok ? { name: oneLine(record.name), about: oneLine(about), skills } : null;
}

// One ready-made set of NPC meters for NPC State Delta (MODULES §F81, §F90). Each meter is a whole-number
// range with a start; `bands` name stretches of it (a band reaches from its `at` to the next band's),
// `drift` pulls it toward a value by `perDay` each story day. A stage is reached when every one of its
// `needs` is: `at` 0 or more means the meter at or above it, a negative `at` at or below it (NPC State
// Delta's own rule). Code moves meters and stages; the story only proposes.
export function checkMeterPreset(record, path, add) {
    const label = typeof record.id === 'string' ? `Meter preset "${record.id}"` : path;
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!METER_PRESET_FIELDS.includes(key)) say(key, `"${key}" is not a meter preset field (expected ${METER_PRESET_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const words = (field, value, max, what) => {
        if (typeof value !== 'string' || !value.trim() || oneLine(value).length > max) { say(field, `${what} must be text of 1 to ${max} characters.`); return false; }
        if (TERM_SEPARATORS.test(value)) { say(field, `${what} may not hold | : # < > or a line break (it is a label in the story's blocks).`); return false; }
        return true;
    };
    words('title', record.title, METER_LIMITS.title, 'title');
    const meters = [];
    const byId = new Map();
    if (!Array.isArray(record.meters) || !record.meters.length || record.meters.length > METER_LIMITS.meters) {
        say('meters', `meters must be a list of 1 to ${METER_LIMITS.meters} meters: [{ "id": "regard", "name": "Regard", "min": -100, "max": 100, "start": 0 }].`);
    } else record.meters.forEach((meter, index) => {
        const at = `meters[${index}]`;
        if (!isObject(meter)) return say(at, `${at} must be an object.`);
        const before = ok;
        ok = true;
        for (const key of Object.keys(meter)) if (!METER_FIELDS.includes(key)) say(`${at}.${key}`, `"${key}" is not a meter field (expected ${METER_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (typeof meter.id !== 'string' || !SLUG.test(meter.id) || meter.id.length > METER_LIMITS.id) say(`${at}.id`, `${at}.id must be lowercase letters, digits and dashes, at most ${METER_LIMITS.id} (like "regard").`);
        else if (METER_RESERVED.includes(meter.id)) say(`${at}.id`, `"${meter.id}" is a word NPC State Delta keeps for itself; pick another meter id.`);
        else if (byId.has(meter.id)) say(`${at}.id`, `two meters share the id "${meter.id}".`, 'DUPLICATE');
        words(`${at}.name`, meter.name, METER_LIMITS.name, `${at}.name`);
        const whole = value => Number.isInteger(value) && value >= METER_LIMITS.min && value <= METER_LIMITS.max;
        const range = `whole numbers from ${METER_LIMITS.min} to ${METER_LIMITS.max}`;
        let fits = () => false;
        if (!whole(meter.min) || !whole(meter.max) || meter.min >= meter.max) say(`${at}.min`, `${at}: min and max must be ${range}, min below max.`);
        else {
            fits = value => Number.isInteger(value) && value >= meter.min && value <= meter.max;
            if (!fits(meter.start)) say(`${at}.start`, `${at}.start must be a whole number from ${meter.min} to ${meter.max}.`);
        }
        if (meter.describe !== undefined && (typeof meter.describe !== 'string' || oneLine(meter.describe).length > METER_LIMITS.describe)) say(`${at}.describe`, `${at}.describe must be text of at most ${METER_LIMITS.describe} characters.`);
        let bands = [];
        if (meter.bands !== undefined) {
            if (!Array.isArray(meter.bands) || !meter.bands.length || meter.bands.length > METER_LIMITS.bands) say(`${at}.bands`, `${at}.bands must be a list of 1 to ${METER_LIMITS.bands} { "at": …, "word": … }, lowest first.`);
            else meter.bands.forEach((band, n) => {
                const where = `${at}.bands[${n}]`;
                if (!isObject(band) || Object.keys(band).some(key => key !== 'at' && key !== 'word')) return say(where, `${where} must be { "at": …, "word": … }.`);
                if (!fits(band.at)) say(`${where}.at`, `${where}.at must be a whole number inside the meter's range.`);
                else if (n > 0 && isObject(meter.bands[n - 1]) && Number.isInteger(meter.bands[n - 1].at) && band.at <= meter.bands[n - 1].at) say(`${where}.at`, `${where}.at must be above the band before it (bands go lowest first).`);
                if (words(`${where}.word`, band.word, METER_LIMITS.word, `${where}.word`)) bands.push({ at: band.at, word: oneLine(band.word) });
            });
        }
        let drift = null;
        if (meter.drift !== undefined) {
            const value = meter.drift;
            if (!isObject(value) || Object.keys(value).some(key => key !== 'toward' && key !== 'perDay') || !fits(value.toward)
                || !Number.isInteger(value.perDay) || value.perDay < 1 || value.perDay > meter.max - meter.min) {
                say(`${at}.drift`, `${at}.drift must be { "toward": a value inside the meter's range, "perDay": a whole number of 1 or more }.`);
            } else drift = { toward: value.toward, perDay: value.perDay };
        }
        if (ok) {
            const out = { id: meter.id, name: oneLine(meter.name), min: meter.min, max: meter.max, start: meter.start };
            if (meter.describe !== undefined && meter.describe.trim()) out.describe = oneLine(meter.describe);
            if (meter.bands !== undefined) out.bands = bands;
            if (drift) out.drift = drift;
            meters.push(out);
            byId.set(meter.id, out);
        }
        ok = before && ok;
    });
    const stages = [];
    if (record.stages !== undefined) {
        const seen = new Set();
        if (!Array.isArray(record.stages) || record.stages.length > METER_LIMITS.stages) say('stages', `stages must be a list of at most ${METER_LIMITS.stages} { "id", "name", "needs": [{ "meter", "at" }] }.`);
        else record.stages.forEach((stage, index) => {
            const at = `stages[${index}]`;
            if (!isObject(stage)) return say(at, `${at} must be an object.`);
            for (const key of Object.keys(stage)) if (!METER_STAGE_FIELDS.includes(key)) say(`${at}.${key}`, `"${key}" is not a stage field (expected ${METER_STAGE_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
            if (typeof stage.id !== 'string' || !SLUG.test(stage.id)) say(`${at}.id`, `${at}.id must be lowercase letters, digits and dashes (like "trusted").`);
            else if (seen.has(stage.id)) say(`${at}.id`, `two stages share the id "${stage.id}".`, 'DUPLICATE');
            else seen.add(stage.id);
            const named = words(`${at}.name`, stage.name, METER_LIMITS.name, `${at}.name`);
            const needs = [];
            if (!Array.isArray(stage.needs) || !stage.needs.length || stage.needs.length > METER_LIMITS.needs) say(`${at}.needs`, `${at}.needs must be a list of 1 to ${METER_LIMITS.needs} { "meter": …, "at": … }.`);
            else stage.needs.forEach((need, n) => {
                const where = `${at}.needs[${n}]`;
                if (!isObject(need) || Object.keys(need).some(key => key !== 'meter' && key !== 'at')) return say(where, `${where} must be { "meter": …, "at": … }.`);
                const meter = byId.get(need.meter);
                if (!meter) return say(`${where}.meter`, `"${need.meter ?? ''}" is not a meter of this preset.`, 'UNKNOWN_REF');
                if (needs.some(other => other.meter === need.meter)) return say(`${where}.meter`, `${at} names the meter "${need.meter}" twice.`, 'DUPLICATE');
                if (!Number.isInteger(need.at) || need.at < meter.min || need.at > meter.max) return say(`${where}.at`, `${where}.at must be a whole number from ${meter.min} to ${meter.max} (0 or more: at or above it; below 0: at or below it).`);
                needs.push({ meter: need.meter, at: need.at });
            });
            if (stage.milestone !== undefined && (typeof stage.milestone !== 'string' || !stage.milestone.trim() || oneLine(stage.milestone).length > METER_LIMITS.milestone)) say(`${at}.milestone`, `${at}.milestone must be text of 1 to ${METER_LIMITS.milestone} characters (what the story is told when the stage is first reached).`);
            if (ok && named) stages.push({ id: stage.id, name: oneLine(stage.name), needs, ...(stage.milestone !== undefined ? { milestone: oneLine(stage.milestone) } : {}) });
        });
    }
    if (!ok) return null;
    return { title: oneLine(record.title), meters, ...(record.stages !== undefined ? { stages } : {}) };
}
