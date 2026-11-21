// The reader's narrow edits of one person in the people domain, stored on the head's reply as reader edits (`data.edit`, so the reply card lists them):
//   people.edit { id, fields: { [field]: value } }: sets dossier fields of an existing record (never its id; an undefined/null value removes the field);
//   people.follow { id, on }: the Follow star (`followed: true`, removed when off);
//   people.portrait.set { id, portrait: { path, type, hash } | null }: the person's portrait as a file reference (never image bytes), or none.
// The domain's validator checks the whole slice after each edit (plain JSON, no image bytes, file-ref portraits), so a bad value refuses the command.

import { BUILT_IN_LIMITS, normalizeLevel, normalizeStoryList } from '../core/core-record-parts/built-in-fields.js';
import { storedLevel } from '../core/core-record-parts/stored-level.js';

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const NOT_EDITABLE = new Set(['id', '__proto__', 'constructor', 'prototype']);

// The record the edit is about, or a refusal.
function recordOf(ctx, domain, id) {
    if (typeof id !== 'string' || !id) return ctx.fail('INVALID', 'Say which person: { id }.');
    const slice = ctx.read(domain);
    if (!isObject(slice?.npcs) || !isObject(slice.npcs[id])) return ctx.fail('REFUSED', 'There is no such person in this story.');
    return ctx.draft(domain).npcs[id];
}
const nameOf = record => (typeof record?.name === 'string' && record.name ? record.name : 'someone');
const edited = (summary, data) => ({ summary, data: { ...data, edit: true }, narrate: false });

// people.fields { id, fields }: the dossier fields a story change line states (NPC State's `~ npc` labels); only a module's own command may send it, and only
// these fields, as short text (null removes one). It is a story change, not a reader edit: the reply card does not list it as one.
const LINE_FIELDS = new Set(['goal', 'status', 'location', 'appearance', 'gender', 'age', 'birthday', 'level', 'learns', 'keepsake', 'aka', 'mood']);
const ALIASES_MAX = 8;   // (npc-lines-parts/aka.js has already refused a name that is someone else's)
const LINE_TEXT_MAX = 300;

// `level` is the built-in whole Level (1-99), written as a number text and never lowered. `learns` adds one ability and `keepsake` adds ("+ Name — line") or removes
// ("- Name") one keepsake, on the built-in lists (names unique without regard to case, at most 16 and 12); the narrator's line reader has already checked the lists.
function writeLevel(record, text) {
    const value = normalizeLevel(text);
    if (value === null || value <= (storedLevel(record) ?? 0)) return;
    record.level = value;
}
function writeList(record, key, max, entries) {
    const list = normalizeStoryList(record[key], max);
    const next = normalizeStoryList([...list, ...entries], max);
    if (next.length) record[key] = next; else delete record[key];
}
// `aka` adds one alias (another name the story uses for them), unique without regard to case, at most ALIASES_MAX.
function writeAlias(record, text) {
    const aliases = Array.isArray(record.aliases) ? record.aliases.filter(item => typeof item === 'string') : [];
    if (aliases.length >= ALIASES_MAX || aliases.some(item => item.toLowerCase() === text.toLowerCase()) || String(record.name ?? '').toLowerCase() === text.toLowerCase()) return;
    record.aliases = [...aliases, text];
}
function writeKeepsake(record, text) {
    if (text.startsWith('-')) {
        const name = text.slice(1).trim().toLowerCase();
        const left = normalizeStoryList(record.keepsakes, BUILT_IN_LIMITS.keepsakes).filter(entry => entry.name.toLowerCase() !== name);
        if (left.length) record.keepsakes = left; else delete record.keepsakes;
    } else if (text.startsWith('+')) writeList(record, 'keepsakes', BUILT_IN_LIMITS.keepsakes, [text.slice(1).trim()]);
}

/** The narrow edit commands of the people domain named `domain`. */
export function peopleEdits(domain) {
    return {
        'people.fields': {
            internal: false,
            handler(ctx, payload) {
                if (typeof ctx.caller !== 'string' || !ctx.caller || ctx.caller.startsWith('event:')) return ctx.fail('REFUSED', 'Only a module\'s own command may write a person\'s story fields.');
                const fields = payload?.fields;
                const names = isObject(fields) ? Object.keys(fields) : [];
                if (!names.length || names.some(name => !LINE_FIELDS.has(name) || !(fields[name] === null || (typeof fields[name] === 'string' && fields[name].length <= LINE_TEXT_MAX)))) return ctx.fail('INVALID', 'people.fields takes { id, fields } of goal, status, location, mood, appearance, gender, age, birthday, level, learns, keepsake or aka as short text (or null).');
                const record = recordOf(ctx, domain, payload.id);
                for (const name of names) {
                    if (name === 'level') { if (/^\d+$/.test(fields.level ?? '')) writeLevel(record, fields.level); continue; }
                    if (name === 'learns') { if (fields.learns) writeList(record, 'abilities', BUILT_IN_LIMITS.abilities, [fields.learns]); continue; }
                    if (name === 'keepsake') { if (fields.keepsake) writeKeepsake(record, fields.keepsake); continue; }
                    if (name === 'aka') { if (fields.aka) writeAlias(record, fields.aka); continue; }
                    if (fields[name] === null || fields[name] === '') delete record[name];
                    else record[name] = fields[name];
                }
                return { summary: `${nameOf(record)}: ${names.join(', ')}.`, data: { id: payload.id, fields: names }, narrate: false };
            },
        },
        'people.edit': {
            handler(ctx, payload) {
                const fields = payload?.fields;
                if (!isObject(fields) || !Object.keys(fields).length) return ctx.fail('INVALID', 'people.edit takes { id, fields } with at least one field.');
                const names = Object.keys(fields);
                if (names.some(name => !FIELD.test(name) || NOT_EDITABLE.has(name))) return ctx.fail('INVALID', 'A field name is not one that can be edited.');
                const record = recordOf(ctx, domain, payload.id);
                for (const name of names) {
                    const value = fields[name];
                    if (value === undefined || value === null) delete record[name];
                    else record[name] = clone(value);
                }
                return edited(`Edited ${nameOf(record)}: ${names.join(', ')}.`, { id: payload.id, fields: names });
            },
        },
        'people.follow': {
            handler(ctx, payload) {
                if (typeof payload?.on !== 'boolean') return ctx.fail('INVALID', 'people.follow takes { id, on: true | false }.');
                const record = recordOf(ctx, domain, payload.id);
                if (payload.on) record.followed = true;
                else delete record.followed;
                return edited(`${payload.on ? 'Following' : 'No longer following'} ${nameOf(record)}.`, { id: payload.id, followed: payload.on });
            },
        },
        'people.portrait.set': {
            handler(ctx, payload) {
                const portrait = payload?.portrait;
                if (portrait !== null && !isObject(portrait)) return ctx.fail('INVALID', 'people.portrait.set takes { id, portrait: { path, type, hash } | null }.');
                const record = recordOf(ctx, domain, payload.id);
                const draft = ctx.draft(domain);
                if (portrait === null) {
                    if (isObject(draft.portraitAssets)) delete draft.portraitAssets[payload.id];
                } else {
                    if (!isObject(draft.portraitAssets)) draft.portraitAssets = {};
                    draft.portraitAssets[payload.id] = { path: portrait.path, type: portrait.type, hash: portrait.hash };
                }
                return edited(`${portrait === null ? 'Removed the portrait of' : 'New portrait for'} ${nameOf(record)}.`, { id: payload.id });
            },
        },
    };
}
