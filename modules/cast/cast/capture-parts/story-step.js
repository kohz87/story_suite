// Story Director v2, part **cast**: `cast.story { set?, clear?, told? }` (cause `system`, switch story-director.world-events), the
// story's own moves after a reply's lines (world-parts/story-bases.js): a story base or a stays record becomes the person's `base`
// slot (the latest base wins, spec v0.14.7 §8; an event's later move replaces it), a rejoin clears it, and what was seen is kept in
// `told`. Recorded on the reply, so a swipe, a delete or a Re-read takes it back or decides again; replay applies it as written.

import { MAX_DOING, MAX_PEOPLE, MAX_PLACE, cutPoints, cutWords, isRecord } from '../domain.js';
import { envOf, keyOk, only, textOk } from './shared-helpers.js';

const BY = ['story', 'stays'];

function checkStory(payload) {
    const list = value => value === undefined || (Array.isArray(value) && value.length <= MAX_PEOPLE);
    if (!isRecord(payload) || Object.keys(payload).some(field => !['set', 'clear', 'told'].includes(field)) || ![payload.set, payload.clear, payload.told].every(list)) return 'cast.story takes { set?, clear?, told? }.';
    for (const item of payload.set ?? []) {
        if (!isRecord(item) || !keyOk(item.key) || !textOk(item.at, MAX_PLACE) || !item.at || !BY.includes(item.by) || !textOk(item.routine ?? '', MAX_DOING)) return 'cast.story: each of set is { key, at, by: story | stays, routine }.';
    }
    if ((payload.clear ?? []).some(key => !keyOk(key))) return 'cast.story: clear is a list of keys.';
    for (const item of payload.told ?? []) {
        if (!isRecord(item) || !keyOk(item.key) || !textOk(item.where, MAX_PLACE) || ![true, false, null].includes(item.left)) return 'cast.story: each of told is { key, where, left }.';
    }
    return '';
}

/** `cast.story` (cause `system`): see the header. */
export function story(ctx, payload = {}) {
    only(ctx, 'Where the story has put the cast');
    const bad = checkStory(payload);
    if (bad) return ctx.fail('INVALID', bad);
    const cast = ctx.draft('cast');
    const env = envOf(ctx, cast);
    const person = key => (Object.hasOwn(cast.people, key) && isRecord(cast.people[key]) ? cast.people[key] : null);
    let moved = 0;
    for (const item of payload.told ?? []) {
        const one = person(item.key);
        if (!one) continue;
        env.touch(item.key);
        one.told = [{ where: cutPoints(item.where, MAX_PLACE), left: item.left }];
    }
    for (const item of payload.set ?? []) {
        const one = person(item.key);
        if (!one || one.alive === false) continue;
        env.touch(item.key);
        one.base = [{ at: cutPoints(item.at, MAX_PLACE), since: env.now, routine: cutWords(item.routine ?? '', MAX_DOING), by: item.by }];
        one.where = one.base[0].at;
        one.doing = one.base[0].routine;
        if (one.coming != null) one.coming = null;
        moved += 1;
    }
    for (const key of payload.clear ?? []) {
        const one = person(key);
        if (!one) continue;
        env.touch(key);
        one.base = null;
    }
    return { summary: moved ? 'The story moved someone; the world keeps them there.' : 'The cast: noted.', narrate: false, data: { moved, cleared: (payload.clear ?? []).length } };
}
