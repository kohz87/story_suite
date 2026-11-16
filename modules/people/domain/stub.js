// `people.stub { id, record }`: a new person from a story line's one-line stub (NPC State's `+ npc Name | role | look`), made inside the reply's transaction.
// Only a module's own command may send it. It makes one record under a new id and appends the id to `order`; a person who is already there is refused
// (nothing is replaced), and the record must be plain JSON the slice's own validator accepts. It is the only way a story line makes a person.

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));

/** The stub command of the people domain named `domain`; `initial()` is the slice a chat's first people write starts from. */
export function peopleStub(domain, { initial, validate }) {
    return {
        'people.stub': {
            internal: false,
            handler(ctx, payload) {
                if (typeof ctx.caller !== 'string' || !ctx.caller || ctx.caller.startsWith('event:')) return ctx.fail('REFUSED', 'Only a module\'s own command may add a person from a story line.');
                const { id, record } = isObject(payload) ? payload : {};
                if (typeof id !== 'string' || !isObject(record) || record.id !== id || typeof record.name !== 'string' || !record.name.trim()) {
                    return ctx.fail('INVALID', 'people.stub takes { id, record } with the record\'s own id and a name.');
                }
                const draft = ctx.draft(domain);
                if (draft.v === undefined) Object.assign(draft, initial());   // (the first write of a chat: the deferred domain starts here)
                if (Object.hasOwn(draft.npcs, id) || draft.order.includes(id)) return ctx.fail('REFUSED', `${record.name} is already in this story.`);
                const next = { ...draft, order: [...draft.order, id], npcs: { ...draft.npcs, [id]: clone(record) } };
                const problems = validate(next);
                if (problems.length) return ctx.fail('INVALID', `The new person is not sound: ${problems.join(' ')}`);
                draft.npcs[id] = clone(record);
                draft.order.push(id);
                return { summary: `${record.name} added.`, data: { id, stub: true }, narrate: false };
            },
        },
    };
}
