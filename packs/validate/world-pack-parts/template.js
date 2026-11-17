// The job: checking one `content.templates` entry (spec §5): the happenings code and the Director may generate. Returns a plain copy.

import { EVENT_REACH, SLUG, TEMPLATE_FIELDS } from '../../limits.js';
import { SCOPES } from '../../../modules/world/chronicle/conditions/limits.js';
import { durationDays } from '../../../modules/world/daily/durations.js';
import { isObject, isText } from '../core.js';
import { checkConditionText, checkEntry } from './entries.js';
import { checkModifiers } from './modifiers.js';
import { checkArc, checkFallback, checkOpen, checkPer } from './template-open.js';

const CHANCE = /^(\d{1,3}(?:\.\d+)?)% (over the window|per season)$/;

/** `ctx` as the event check's: { index, say, placeholders: true, collect }. A template sets, clears and needs conditions and never touches a person. */
export function checkTemplate(record, ctx) {
    const { say } = ctx;
    for (const key of Object.keys(record)) {
        if (key === 'effects' || key === 'cast') say(key, `a template has no ${key}: it sets and clears conditions only and never touches a named person.`);
        else if (!TEMPLATE_FIELDS.includes(key)) say(key, `"${key}" is not a template field (expected ${TEMPLATE_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    }
    if (typeof record.template !== 'string' || !SLUG.test(record.template)) say('template', 'template must be a name in lower-case-with-hyphens.');
    if (record.scope !== undefined && !SCOPES.includes(record.scope)) say('scope', `scope must be one of ${SCOPES.join(', ')}.`);
    if (record.severity !== undefined && record.severity !== 'major' && record.severity !== 'minor') say('severity', 'severity must be "minor" or "major".');
    if (record.reach !== undefined && !EVENT_REACH.includes(record.reach)) say('reach', `reach must be one of ${EVENT_REACH.join(', ')}.`);
    if (record.summary !== undefined && (!isText(record.summary, 300) || !record.summary.trim())) say('summary', 'summary must be text of at most 300 characters.');
    const chance = record.chance === undefined ? null : CHANCE.exec(String(record.chance).trim());
    if (record.chance !== undefined && (!chance || Number(chance[1]) > 100)) say('chance', 'chance must read "20% over the window" or "30% per season" (0 to 100%).');
    if (record.cooldown !== undefined && !(durationDays(String(record.cooldown).replace(/ per place$/, '')) > 0)) say('cooldown', `"${String(record.cooldown)}" is not a duration, such as "1 season per place".`);
    if (record.where !== undefined && (!isObject(record.where) || !Array.isArray(record.where.kinds) || record.where.kinds.some(word => !ctx.index.placeKindKnown(word)))) say('where', 'where must be { "kinds": [...] } naming kinds from placeKinds or engine classes.');
    const lines = (field, make) => {
        if (record[field] === undefined) return;
        if (!Array.isArray(record[field]) || !record[field].length) return say(field, `${field} must be a non-empty list.`);
        record[field].forEach((text, n) => make(text, `${field}[${n}]`));
    };
    // v0.14.3: requires / requires_any / likelier_if / less_if, as an event has them (placeholders bind to the picked place).
    for (const field of ['requires', 'requires_any']) lines(field, (text, at) => checkEntry(text, ctx, at));
    for (const field of ['likelier_if', 'less_if']) if (record[field] !== undefined) checkModifiers(record[field], ctx, field);
    // v0.14: an open template (the Director fills the details from the menu), its slots, its arc and the fallback.
    if (record.per !== undefined) checkPer(record.per, ctx, 'per');
    if (record.open !== undefined) checkOpen(record.open, ctx, 'open');
    if (record.arc !== undefined) { if (record.open === undefined) say('arc', 'a template with no "open" cannot start an arc; add open (a menu) first.'); else checkArc(record.arc, ctx, 'arc'); }
    if (record.fallback !== undefined) checkFallback(record.fallback, ctx, 'fallback');
    lines('needs', (text, at) => checkEntry(text, ctx, at, ['anchor', 'condition']));
    lines('sets', (text, at) => {
        const parsed = checkConditionText(text, ctx, at);
        if (parsed?.duration) ctx.collect.timed.add(parsed.name);
        if (parsed && !parsed.placeholder && ctx.index.condition(parsed.name)?.placeStatus) {
            const place = ctx.index.placeByRef(parsed.ref);
            const keeper = place && ctx.index.cast.find(person => person.protected === true && [person.start?.place, person.homeBase].some(home => home && ctx.index.placeByRef(home)?.slug === place.slug));
            if (keeper) say(at, `"${text}" sets a place status on "${place.name}", where the protected person "${keeper.id}" lives; a template may not do that.`);
        }
    });
    lines('clears', (text, at) => {
        const parsed = checkConditionText(text, ctx, at, { duration: 'forbid' });
        if (parsed) ctx.collect.cleared.add(parsed.name);
    });
    return JSON.parse(JSON.stringify(record));
}
