// Checking skill templates and presets.

import { RECORD_LIMITS, LIMITS, SKILL_FIELDS, SKILL_TYPES, STAT_NAME, SKILL_TARGETS } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
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
