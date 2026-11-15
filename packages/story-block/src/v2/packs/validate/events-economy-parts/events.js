// Checking event records and linking the events of a pack to each other.

import { EVENT_FIELDS, EVENT_LIMITS, SLUG, COMMAND } from '../../limits.js';
import { compile } from '../../../events/condition.js';
import { isObject, fullId } from '../core.js';

// Commands the host makes for itself (registry.js CAPTURE_PREFIX, INIT_PREFIX; events/engine.js FIRE):
// a change line the story never wrote, a module's state reset, an event firing another. Not for packs.
const HOST_COMMAND = /^(?:capture\.|module\.)|^events\.fire$/;

export function checkEvent(record, path, add, readableConditions = true) {
    const label = `Event "${record.id}"`;
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!EVENT_FIELDS.includes(key)) say(key, `"${key}" is not an event field (expected ${EVENT_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    if (typeof record.when !== 'string' || !record.when.trim() || record.when.length > EVENT_LIMITS.when) say('when', `when must be a condition of 1 to ${EVENT_LIMITS.when} characters.`);
    else if (readableConditions) {
        // The parser the events use while the story plays: a condition it cannot read would only fail at play time.
        const parsed = compile(record.when);
        if (!parsed.ok) say('when', `the condition can't be read: ${parsed.error.message}${/never closed/.test(parsed.error.message) ? ' A name with an apostrophe in it needs double quotes around it.' : ''}`);
    }
    if (typeof record.cue !== 'string' || !record.cue.trim() || record.cue.trim().length > EVENT_LIMITS.cue) say('cue', `cue must be text of 1 to ${EVENT_LIMITS.cue} characters.`);
    if (record.once !== undefined && typeof record.once !== 'boolean') say('once', 'once must be true or false.');
    if (record.after !== undefined && (typeof record.after !== 'string' || !SLUG.test(record.after))) say('after', 'after must be the id of another event in this pack.');
    if (record.decision !== undefined && (typeof record.decision !== 'string' || !SLUG.test(record.decision) || record.once === false)) say('decision', 'decision must be a slug on a once event.');
    const then = record.then ?? [];
    if (!Array.isArray(then) || then.length > EVENT_LIMITS.then) say('then', `then must be a list of at most ${EVENT_LIMITS.then} { "command": …, "payload": { … } }.`);
    else then.forEach((step, index) => {
        if (!isObject(step) || typeof step.command !== 'string' || !COMMAND.test(step.command)) say(`then[${index}].command`, `then[${index}] needs a command name like "wallet.receive".`);
        else if (HOST_COMMAND.test(step.command)) say(`then[${index}].command`, `then[${index}] names "${step.command}", a command Story Block runs itself; an event runs only module commands (like "wallet.receive").`);
        else if (step.payload !== undefined && !isObject(step.payload)) say(`then[${index}].payload`, `then[${index}].payload must be an object.`);
        else if (Object.keys(step).some(key => key !== 'command' && key !== 'payload')) say(`then[${index}]`, `then[${index}] holds only command and payload.`);
    });
    if (!ok) return null;
    return {
        when: record.when.trim(),
        cue: record.cue.trim(),
        once: record.once ?? true,
        after: record.after ?? null,
        ...(record.decision === undefined ? {} : { decision: record.decision }),
        then: then.map(step => ({ command: step.command, payload: { ...(step.payload ?? {}) } })),
    };
}

// `after` names an event of the same pack; written as its full ID, and no loops.
export function linkEvents(events, packId, add) {
    const ids = new Set(events.map(event => event.slug));
    for (const event of events) {
        if (event.after === null) continue;
        if (!ids.has(event.after) || event.after === event.slug) {
            add('UNKNOWN_REF', `content.events.${event.slug}.after`, `Event "${event.slug}" comes after "${event.after}", which is not another event of this pack.`);
            continue;
        }
        // Only a once event leaves the claim that `after` waits for.
        if (events.find(other => other.slug === event.after).once === false) {
            add('BAD_RECORD', `content.events.${event.slug}.after`, `Event "${event.slug}" comes after "${event.after}", which repeats (once: false) and so never counts as happened.`);
            continue;
        }
        event.after = fullId(packId, event.after);
    }
    const bySlug = new Map(events.map(event => [event.id, event]));
    for (const event of events) {
        const chain = new Set([event.id]);
        for (let next = bySlug.get(event.after); next; next = bySlug.get(next.after)) {
            if (chain.has(next.id)) {
                add('BAD_RECORD', `content.events.${event.slug}.after`, `Event "${event.slug}" is part of an "after" loop.`);
                break;
            }
            chain.add(next.id);
        }
    }
}
