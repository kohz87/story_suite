// The reader's narrow edits of one person in the people domain, stored on the head's reply as reader edits (`data.edit`, so the reply card lists them):
//   people.edit { id, fields: { [field]: value } }: sets dossier fields of an existing record (never its id; an undefined/null value removes the field);
//   people.follow { id, on }: the Follow star (`followed: true`, removed when off);
//   people.portrait.set { id, portrait: { path, type, hash } | null }: the person's portrait as a file reference (never image bytes), or none.
// The domain's validator checks the whole slice after each edit (plain JSON, no image bytes, file-ref portraits), so a bad value refuses the command.

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

/** The narrow edit commands of the people domain named `domain`. */
export function peopleEdits(domain) {
    return {
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
