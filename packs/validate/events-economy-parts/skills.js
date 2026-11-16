// Checking skill templates and presets.

import { RECORD_LIMITS, LIMITS, SKILL_FIELDS, SKILL_TYPES, STAT_NAME, SKILL_TARGETS, PRESET_FIELDS } from '../../limits.js';
import { oneLine } from '../../../../../../../core/text.js';
import { isObject, isText, isInt } from '../core.js';

// A skill template describes a skill; its numbers are supplied by the consuming module.
export function checkSkill(record, path, label, add) {
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!SKILL_FIELDS.includes(key)) say(key, `"${key}" is not a skill field (expected ${SKILL_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const type = record.type ?? 'physical';
    if (!SKILL_TYPES.includes(type)) say('type', `type must be one of ${SKILL_TYPES.join(', ')}.`);
    const stat = record.stat ?? null;
    if (stat !== null && (typeof stat !== 'string' || !STAT_NAME.test(stat))) say('stat', 'stat must be a stat name like "DEX".');
    const target = record.target ?? 'one';
    if (!SKILL_TARGETS.includes(target)) say('target', `target must be one of ${SKILL_TARGETS.join(', ')}.`);
    const element = record.element ?? null;
    if (element !== null && (typeof element !== 'string' || (!/^[a-z]+$/.test(element) || element.length > RECORD_LIMITS.element))) say('element', 'element must be one short lowercase word, like "fire", or left out.');
    const note = record.note ?? '';
    if (!isText(note, RECORD_LIMITS.note)) say('note', 'note must be text of at most 500 characters.');
    const tags = record.tags ?? [];
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > RECORD_LIMITS.word)) say('tags', 'tags must be a list of short words.');
    if (!ok) return null;
    return { name: oneLine(record.name, LIMITS.name), type, stat, target, element, note, tags: tags.map(tag => tag.trim()) };
}

// A ready-made character for the creation wizard: a race, talents and the points spent on each
// stat (on top of the race and talents), plus skills to offer. The name and background come
// from the persona; creation checks the point budget, this only checks the form.
export function checkPreset(record, path, label, add, choose) {
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!PRESET_FIELDS.includes(key)) say(key, `"${key}" is not a preset field (expected ${PRESET_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const note = record.note ?? '';
    if (!isText(note, RECORD_LIMITS.note)) say('note', 'note must be text of at most 500 characters.');
    let race = null;
    if (record.race !== undefined && record.race !== null) {
        race = choose.race(record.race);
        if (!race) say('race', `"${record.race}" is not a race of this pack.`, 'UNKNOWN_REF');
    }
    const refs = (field, ref, word) => {
        const list = record[field] ?? [];
        if (!Array.isArray(list)) { say(field, `${field} must be a list of ${word} ids or names of this pack.`); return []; }
        const out = [];
        list.forEach((entry, index) => {
            const id = ref(entry);
            if (!id) say(`${field}[${index}]`, `"${entry}" is not a ${word} of this pack.`, 'UNKNOWN_REF');
            else if (out.includes(id)) say(`${field}[${index}]`, `"${entry}" is listed twice.`, 'DUPLICATE');
            else out.push(id);
        });
        return out;
    };
    const talents = refs('talents', choose.talent, 'talent');
    const skills = refs('skills', choose.skill, 'skill');
    const points = record.points ?? {};
    if (!isObject(points) || Object.entries(points).some(([stat, n]) => !STAT_NAME.test(stat) || !isInt(n))) say('points', 'points must map stat names to whole numbers of 0 or more: { "DEX": 3 }.');
    if (!ok) return null;
    return { name: oneLine(record.name, LIMITS.name), note, race, talents, points: { ...points }, skills };
}
