// `people.died { id, reason, sid }`: a person's death from a story line (NPC State's `~ npc Name | died | how: …`), made inside the reply's transaction.
// Only a module's own command may send it. It marks the record dead the way a confirmed death is (terminal, explicit, no longer here
// or active; the closed field list has no archive fields, so the death is `lifeState` alone); `sid` is the reply's own and no clock is written, so a Re-read of the same line makes the same record
// (replay equals live). A record that is already dead is refused (nothing changes); deleting the reply that wrote it brings the person back.

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const REASON_MAX = 300;

/** The death command of the people domain named `domain`. */
export function peopleDied(domain) {
    return {
        'people.died': {
            internal: false,
            handler(ctx, payload) {
                if (typeof ctx.caller !== 'string' || !ctx.caller || ctx.caller.startsWith('event:')) return ctx.fail('REFUSED', 'Only a module\'s own command may record a death from a story line.');
                const { id, reason, sid } = isObject(payload) ? payload : {};
                if (typeof id !== 'string' || typeof reason !== 'string' || !reason || reason.length > REASON_MAX || (sid !== null && typeof sid !== 'string')) {
                    return ctx.fail('INVALID', 'people.died takes { id, reason, sid }.');
                }
                const slice = ctx.read(domain);
                const found = isObject(slice?.npcs) ? slice.npcs[id] : null;
                if (!isObject(found)) return ctx.fail('REFUSED', 'There is no such person in this story.');
                if (found.lifeState === 'deceased') return ctx.fail('REFUSED', `${found.name ?? 'This person'} has already died.`);
                Object.assign(ctx.draft(domain).npcs[id], {
                    lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: reason,
                    present: false, worldActive: false,
                });
                return { summary: `${found.name ?? 'Someone'} died.`, data: { id, died: true }, narrate: false };
            },
        },
    };
}
