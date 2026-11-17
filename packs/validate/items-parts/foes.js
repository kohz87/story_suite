// Checking a foe of the bestiary (`content.foes`): a name, other names, the tier, the level and a line about it.

import { FOE_FIELDS, FOE_TIERS, FOE_LIMITS, RECORD_LIMITS, LIMITS } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
import { isInt } from '../core.js';

export function checkFoe(record, path, label, add) {
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!FOE_FIELDS.includes(key)) say(key, `"${key}" is not a foe field (expected ${FOE_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    const tier = typeof record.tier === 'string' ? record.tier.trim().toLowerCase() : '';
    if (!FOE_TIERS.includes(tier)) say('tier', `tier must be one of ${FOE_TIERS.join(', ')}.`);
    const level = record.level;
    if (level !== undefined && !(isInt(level, FOE_LIMITS.level.min) && level <= FOE_LIMITS.level.max)) say('level', `level must be a whole number from ${FOE_LIMITS.level.min} to ${FOE_LIMITS.level.max}, or left out.`);
    const about = record.about ?? '';
    if (typeof about !== 'string' || oneLine(about).length > FOE_LIMITS.about) say('about', `about must be text of at most ${FOE_LIMITS.about} characters.`);
    const aliases = record.aliases ?? [];
    if (!Array.isArray(aliases) || aliases.length > FOE_LIMITS.aliases || aliases.some(alias => typeof alias !== 'string' || !alias.trim() || alias.length > LIMITS.name)) say('aliases', `aliases must be a list of up to ${FOE_LIMITS.aliases} other names for the foe.`);
    const tags = record.tags ?? [];
    if (!Array.isArray(tags) || tags.length > FOE_LIMITS.tags || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > RECORD_LIMITS.word)) say('tags', `tags must be a list of up to ${FOE_LIMITS.tags} short words.`);
    if (!ok) return null;
    return {
        name: oneLine(record.name, LIMITS.name), aliases: [...new Set(aliases.map(alias => oneLine(alias, LIMITS.name)))], tier,
        ...(level !== undefined ? { level } : {}), about: oneLine(about), tags: [...new Set(tags.map(tag => tag.trim()))],
    };
}
