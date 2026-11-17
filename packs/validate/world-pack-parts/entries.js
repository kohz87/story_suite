// The job: checking one condition string, anchor or threshold of an event or template against what the pack defines.
// `ctx`: { index, say(field, message, code?), placeholders (allowed or not), collect: { facts, warnings } }.

import { parseAnchor, parseCondition, parseEntry, parseThreshold } from './grammar.js';
import { STANDING } from '../../limits.js';

/** A condition string: its name is declared, its ref names a place, route, region or realm of the condition's scope (or a placeholder of that scope). */
export function checkConditionText(text, ctx, field, { duration = 'allow' } = {}) {
    const parsed = parseCondition(text, { duration });
    if (parsed.error) return ctx.say(field, parsed.error), null;
    const condition = ctx.index.condition(parsed.name);
    if (!condition) return ctx.say(field, `"${text}": "${parsed.name}" is not a condition this pack declares (content.conditions).`, 'UNKNOWN_REF'), null;
    if (parsed.placeholder) {
        if (!ctx.placeholders) return ctx.say(field, `"${text}": @${parsed.placeholder} binds to the place picked for a recurring event or a template; a one-off or chain stage names a fixed place, route, region or realm.`), null;
        if (parsed.placeholder !== condition.scope) return ctx.say(field, `"${text}": @${parsed.placeholder} is a ${parsed.placeholder}, but "${condition.name}" is a ${condition.scope}-scope condition.`), null;
        return parsed;
    }
    const scopes = ctx.index.ref(parsed.ref);
    if (!scopes.size) return ctx.say(field, `"${text}": "${parsed.ref}" is not a place, route, region or realm of this pack.`, 'UNKNOWN_REF'), null;
    if (!scopes.has(condition.scope)) return ctx.say(field, `"${text}": "${parsed.ref}" is a ${[...scopes].join(' or ')}, but "${condition.name}" is a ${condition.scope}-scope condition.`), null;
    return parsed;
}

/** A threshold: the power or score named by id exists, and N is inside its range. */
export function checkThresholdText(text, ctx, field) {
    const parsed = parseThreshold(text);
    if (parsed.error) return ctx.say(field, parsed.error), null;
    const owner = parsed.kind === 'power' ? ctx.index.power(parsed.id) : ctx.index.score(parsed.id);
    if (!owner) return ctx.say(field, `"${text}": there is no ${parsed.kind} with the id "${parsed.id}" in this pack.`, 'UNKNOWN_REF'), null;
    const [lo, hi] = owner.range ?? [STANDING.min, STANDING.max];
    if (parsed.n < lo || parsed.n > hi) return ctx.say(field, `"${text}": ${parsed.n} is outside the range of ${parsed.kind} "${parsed.id}" (${lo}..${hi}).`), null;
    return parsed;
}

/** An anchor. `fired:`, `ended:`, `lapsed:` and `stage:` take worldEvents ids only. */
export function checkAnchorText(text, ctx, field) {
    const anchor = parseAnchor(text);
    if (anchor.error) return ctx.say(field, anchor.error), null;
    return checkAnchorRecord(anchor, text, ctx, field);
}

function checkAnchorRecord(anchor, text, ctx, field) {
    const { kind, id } = anchor;
    if (['fired', 'ended', 'lapsed', 'stage'].includes(kind)) {
        if (ctx.index.legacyIds.has(id) && !ctx.index.eventIds.has(id)) return ctx.say(field, `"${text}": "${id}" is a legacy dated event (content.events); an anchor names content.worldEvents ids only.`, 'UNKNOWN_REF'), null;
        if (!ctx.index.eventIds.has(id)) return ctx.say(field, `"${text}": "${id}" is not an event in content.worldEvents.`, 'UNKNOWN_REF'), null;
    } else if (kind === 'died' || kind === 'departed') {
        if (ctx.index.refused.has(id)) ctx.collect.warnings.push([field, `"${text}": "${id}" was refused (see the cast Problems); the step skips what names them.`]);
        else if (!ctx.index.person(id)) return ctx.say(field, `"${text}": "${id}" is not a cast id; a person pointed at by id must be a cast entry.`, 'UNKNOWN_REF'), null;
    } else if (kind === 'fact') ctx.collect.factRefs.add(id);
    else if (kind === 'season' && !ctx.index.knowsSeason(id)) ctx.collect.warnings.push([field, `"${text}": "${id}" is not a season the built-in calendar or this pack's weather knows.`]);
    else if (kind === 'set' || kind === 'cleared') {
        if (!ctx.index.condition(id)) return ctx.say(field, `"${text}": "${id}" is not a condition this pack declares.`, 'UNKNOWN_REF'), null;
    }
    return anchor;
}

/** One requires / requires_any / any_of entry. `allow`: which of 'threshold', 'anchor', 'condition' this place takes. */
export function checkEntry(text, ctx, field, allow = ['threshold', 'anchor', 'condition']) {
    if (typeof text !== 'string' || !text.trim()) return ctx.say(field, 'an entry must be a non-empty string.'), null;
    const parsed = parseEntry(text);
    if (parsed.type === 'threshold' && !allow.includes('threshold')) return ctx.say(field, `"${text}": a threshold is not allowed here (it may gate requires, requires_any and ends_when.any_of); use a condition or an anchor.`), null;
    if (parsed.type === 'anchor' && !allow.includes('anchor')) return ctx.say(field, `"${text}": an anchor is not allowed here; write a condition.`), null;
    if (parsed.type === 'condition' && !allow.includes('condition')) return ctx.say(field, `"${text}": a condition is not allowed here.`), null;
    if (parsed.error) return ctx.say(field, parsed.error), null;
    if (parsed.type === 'threshold') return checkThresholdText(text, ctx, field);
    if (parsed.type === 'condition') return checkConditionText(text, ctx, field, { duration: 'forbid' });
    if (parsed.ref !== undefined && !ctx.index.ref(parsed.ref).size && !ctx.placeholders) return ctx.say(field, `"${text}": "${parsed.ref}" is not a place, route, region or realm of this pack.`, 'UNKNOWN_REF'), null;
    return checkAnchorRecord(parsed, text, ctx, field);
}
