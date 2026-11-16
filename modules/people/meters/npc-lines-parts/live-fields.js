// Applies the dossier labels of a `~ npc` line to the person: goal, status and where (and look, gender, age, birthday through ./look.js and ./facts.js)
// as one `people.fields` write on the people domain, and mood (one word → the fixed list's V/A/D numbers) on the meter record. Each refusal is a problem;
// the line's other labels still apply.
import { NPC_DOMAIN, clean, isInt, isReplyId, readLeaf } from '../npc-meters-config.js';
import { labelKey } from '../../cast/key-people.js';
import { applyWord, moodFromWord, restMood, restingMood } from '../npc-mood.js';
import { sentence, writeMood } from '../npc-meters-slice.js';
import { factFields, unknownWord } from './facts.js';
import { lookField } from './look.js';
import { guardFields } from './guard.js';

const LIVE = Object.freeze({ goal: 300, status: 300, where: 120 });

// The goal / status / where text as { value } (null = cleared), or a problem.
function liveOf(name, raw, { clearable, here }) {
    const text = clean(raw, LIVE[name]);
    if (!text || unknownWord(text)) return { problem: `${name}: "${clean(raw, 40)}" says nothing; not used.` };
    if (clearable && text.toLowerCase() === 'clear') return { value: null };
    if (name === 'where' && here) return { problem: 'where: is for someone away from the scene; this person is here (presence follows + present and - present only).' };
    return { value: text };
}

/** → { problems, wrote }. `world`: { present: Set (label keys), at, reply, minutes, date, moodOn }; `dossier`: the people record or null. */
function applyLive(ctx, { key, name, record, fields, dossier, world }) {
    const problems = [];
    const set = {};
    for (const field of ['goal', 'status', 'where']) {
        if (fields[field] === undefined) continue;
        const got = liveOf(field, fields[field], { clearable: field !== 'where', here: world.present.has(labelKey(name)) });
        if (got.problem) { problems.push(got.problem); continue; }
        set[field === 'where' ? 'location' : field] = got.value;
    }
    for (const part of [lookField(fields), factFields(fields, dossier)]) { Object.assign(set, part.set); problems.push(...part.problems); }
    const guarded = guardFields(set, dossier, name);
    problems.push(...guarded.problems);
    for (const key of Object.keys(set)) if (!(key in guarded.set)) delete set[key];
    let wrote = false;
    if (Object.keys(set).length && !dossier) problems.push(`${name} has no dossier yet; ${Object.keys(set).join(', ')} not stored.`);
    else if (Object.keys(set).length) { ctx.call('people.fields', { id: key, fields: set }); wrote = true; }
    if (fields.mood !== undefined) {
        const word = clean(fields.mood, 60);
        const target = world.moodOn && isInt(world.minutes) ? moodFromWord(word) : null;
        if (!world.moodOn) problems.push('mood is off; not used.');
        else if (!isInt(world.minutes)) problems.push('mood: there is no story clock; not used.');
        else if (!target) problems.push(`mood: "${clean(fields.mood, 40)}" is not a mood word on the list; not used.`);
        else {
            const prev = readLeaf(record.mood) ?? restMood(restingMood(), world.minutes);
            const { mood } = applyWord(prev, world.minutes, target, word, '');
            writeMood(ctx, key, record, { prev, mood, day: world.minutes, n: isInt(world.at) ? world.at : null, s: isReplyId(world.reply) ? world.reply : null, date: world.date });
            wrote = true;
        }
    }
    return { problems, wrote };
}

/** The line's dossier labels applied after its meters (`out`: the meters' receipt); their problems join the card's and the receipt's. */
export function labelFields(ctx, out, fields, { at, reply, clockMinutes, timeMinutes, clockDay, startDate, moodOn, note }) {
    const key = out.data.key;
    const here = ctx.query?.('scene.present', {});
    // Only this reply's own scene decides who is here (no fallback to NPC State's live flags: a Re-read or swipe must decide the same way).
    const present = new Set((Array.isArray(here) ? here : []).map(item => labelKey(typeof item === 'string' ? item : item?.name)).filter(Boolean));
    const minutes = clockMinutes(at) ?? timeMinutes(ctx);
    const world = { present, at, reply, minutes, moodOn, date: clockDay(at) === null ? '' : startDate(at) };
    const slice = ctx.draft(NPC_DOMAIN);
    const done = applyLive(ctx, { key, name: out.data.name, record: slice.npcs[key], fields, dossier: ctx.read('people')?.npcs?.[key] ?? null, world });
    if (!done.problems.length) return out;
    note(slice, ctx.rev, done.problems);
    return { ...out, summary: sentence([out.summary, ...done.problems]), data: { ...out.data, problems: [...out.data.problems, ...done.problems] } };
}
