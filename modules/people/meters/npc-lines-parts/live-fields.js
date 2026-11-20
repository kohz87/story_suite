// Applies the dossier labels of a `~ npc` line to the person: goal, status and where (and look, gender, age, birthday through ./look.js and ./facts.js, level through ./level.js, learns and keepsake through ./abilities.js, aka through ./aka.js)
// as one `people.fields` write on the people domain, and mood (one word → the fixed list's V/A/D numbers) on the meter record. Each refusal is a problem;
// the line's other labels still apply.
import { NPC_DOMAIN, clean, isInt, isReplyId, readLeaf } from '../npc-meters-config.js';
import { labelKey } from '../../dossier/cast-dossier-parts/shared-text.js';
import { applyWord, moodFromWord, restMood, restingMood } from '../npc-mood.js';
import { sentence, writeMood } from '../npc-meters-slice.js';
import { factFields, unknownWord } from './facts.js';
import { lookField } from './look.js';
import { levelField } from './level.js';
import { abilityFields } from './abilities.js';
import { guardFields } from './guard.js';
import { noted, fieldWords } from './noted.js';
import { akaField } from './aka.js';

const LIVE = Object.freeze({ goal: 300, status: 300, where: 120 });

// The goal / status / where text as { value } (null = cleared), or a problem.
function liveOf(name, raw, { clearable, here }) {
    const text = clean(raw, LIVE[name]);
    if (!text || unknownWord(text)) return { problem: `${name}: "${clean(raw, 40)}" says nothing; not used.` };
    if (clearable && text.toLowerCase() === 'clear') return { value: null };
    if (name === 'where' && here) return { problem: 'where: is for someone away from the scene; this person is here (presence follows + present and - present only).' };
    return { value: text };
}

// The receipt's words for a Level, an ability or a keepsake a line stored, with its value (SFF4 #9): "keepsake Guild licence added", "learns Snare craft", "Level 12".
// Any other field is only named (F2, ./noted.js: "place, goal stored").
const VALUED = new Set(['level', 'learns', 'keepsake']);
const nameOf = text => String(text ?? '').replace(/^[+-]\s*/, '').split(' — ')[0].trim();
function valuedWords(set) {
    const words = [];
    for (const [field, value] of Object.entries(set)) {
        if (field === 'level') words.push(`Level ${value}`);
        else if (field === 'learns') words.push(`learns ${nameOf(value)}`);
        else if (field === 'keepsake') words.push(`keepsake ${nameOf(value)} ${String(value).startsWith('-') ? 'removed' : 'added'}`);
    }
    return words;
}

// The receipt telling what the line stored. With a Level, an ability or a keepsake (SFF4 #9): "<Name>: keepsake Guild licence added, goal stored." in place of
// "<Name>: nothing moved." (after the meters' words when meters moved). Only other fields (F2): "<Name>: nothing moved; place, goal stored", which the Journal
// still reads as upkeep; a receipt whose meters moved is then left as it is.
function toldOf(out, done) {
    if (!done.wrote) return out;
    const valued = valuedWords(done.set);
    if (!valued.length) return noted(out, fieldWords(done.stored));
    const rest = done.stored.filter(field => !VALUED.has(field));
    const name = out.data.name;
    const words = sentence([`${name}: ${[...valued, ...(rest.length ? [fieldWords(rest)] : [])].join(', ')}`]);
    const idle = `${name}: nothing moved.`;
    return { ...out, summary: String(out.summary).includes(idle) ? out.summary.replace(idle, words) : sentence([out.summary, words]) };
}

/** → { problems, wrote, stored (the fields written), set (their values on the dossier) }. `world`: { present: Set (label keys), at, reply, minutes, date, moodOn }; `dossier`: the people record or null. */
function applyLive(ctx, { key, name, record, fields, dossier, world, lines }) {
    const problems = [];
    const set = {};
    for (const field of ['goal', 'status', 'where']) {
        if (fields[field] === undefined) continue;
        const got = liveOf(field, fields[field], { clearable: field !== 'where', here: world.present.has(labelKey(name)) });
        if (got.problem) { problems.push(got.problem); continue; }
        set[field === 'where' ? 'location' : field] = got.value;
    }
    for (const part of [lookField(fields), factFields(fields, dossier, lines), levelField(fields, dossier), abilityFields(fields, dossier), akaField(fields, { key, people: ctx.read('people')?.npcs })]) { Object.assign(set, part.set); problems.push(...part.problems); }
    const guarded = guardFields(set, dossier, name);
    problems.push(...guarded.problems);
    for (const key of Object.keys(set)) { if (key in guarded.set) set[key] = guarded.set[key]; else delete set[key]; }
    let wrote = false;
    const stored = [];
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
            // (the dossier's mood word too, as a new person's first fill writes it: the headline read the old word until a Refresh, owner 20 Nov)
            if (dossier) { const kept = guardFields({ mood: word }, dossier, name); if ('mood' in kept.set) set.mood = kept.set.mood; else problems.push(...kept.problems); }
            else { wrote = true; stored.push('mood'); }
        }
    }
    if (Object.keys(set).length && !dossier) problems.push(`${name} has no dossier yet; ${Object.keys(set).join(', ')} not stored.`);
    else if (Object.keys(set).length) { ctx.call('people.fields', { id: key, fields: set }); wrote = true; stored.push(...Object.keys(set)); }
    return { problems, wrote, stored, set: dossier ? set : {} };
}

/** The line's dossier labels applied after its meters (`out`: the meters' receipt); their problems join the card's and the receipt's. */
export function labelFields(ctx, out, fields, { at, reply, clockMinutes, timeMinutes, clockDay, startDate, moodOn, note, lines = false }) {
    const key = out.data.key;
    const here = ctx.query?.('scene.present', {});
    // Only this reply's own scene decides who is here (no fallback to NPC State's live flags: a Re-read or swipe must decide the same way).
    const present = new Set((Array.isArray(here) ? here : []).map(item => labelKey(typeof item === 'string' ? item : item?.name)).filter(Boolean));
    const minutes = clockMinutes(at) ?? timeMinutes(ctx);
    const world = { present, at, reply, minutes, moodOn, date: clockDay(at) === null ? '' : startDate(at) };
    const slice = ctx.draft(NPC_DOMAIN);
    const done = applyLive(ctx, { key, name: out.data.name, record: slice.npcs[key], fields, dossier: ctx.read('people')?.npcs?.[key] ?? null, world, lines });
    const told = toldOf(out, done);
    if (!done.problems.length) return told;
    note(slice, ctx.rev, done.problems);
    return { ...told, summary: sentence([told.summary, ...done.problems]), data: { ...out.data, problems: [...out.data.problems, ...done.problems] } };
}
