// `people.memory { id, memories, stamps? }`: a person's important memories as a story line leaves them (NPC State's `~ memory` line, and the words of a why:, a lie or a milestone), written inside the
// reply's transaction. Only a module's own command may send it. NPC State works the list out (who, day, no repeat or rewording; the five-memory cap applies where a record is read); this command stores the list as given
// and its dates (`stamps`: { normalized text: { m: reply index, d: story day text } }) and nothing else of the record. A bad list is refused and nothing is stored.

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const LIST_MAX = 500;
const TEXT_MAX = 400;
const STAMP_DATE_MAX = 40;

const stampOk = stamp => isObject(stamp) && Number.isInteger(stamp.m) && stamp.m >= 0 && (stamp.d === undefined || (typeof stamp.d === 'string' && stamp.d.length <= STAMP_DATE_MAX));

/** The memory command of the people domain named `domain`. */
export function peopleMemory(domain) {
    return {
        'people.memory': {
            internal: false,
            handler(ctx, payload) {
                if (typeof ctx.caller !== 'string' || !ctx.caller || ctx.caller.startsWith('event:')) return ctx.fail('REFUSED', 'Only a module\'s own command may write a person\'s memories.');
                const { id, memories, stamps } = isObject(payload) ? payload : {};
                if (typeof id !== 'string' || !id) return ctx.fail('INVALID', 'Say which person: { id }.');
                if (!Array.isArray(memories) || memories.length > LIST_MAX || memories.some(text => typeof text !== 'string' || !text.trim() || text.length > TEXT_MAX)) return ctx.fail('INVALID', 'people.memory takes { id, memories: [short text] }.');
                if (stamps !== undefined && (!isObject(stamps) || Object.keys(stamps).length > LIST_MAX || Object.values(stamps).some(stamp => !stampOk(stamp)))) return ctx.fail('INVALID', 'The memory dates are not sound.');
                const slice = ctx.read(domain);
                if (!isObject(slice?.npcs) || !isObject(slice.npcs[id])) return ctx.fail('REFUSED', 'There is no such person in this story.');
                const record = ctx.draft(domain).npcs[id];
                record.memories = [...memories];
                if (stamps && Object.keys(stamps).length) record.memoryStamps = JSON.parse(JSON.stringify(stamps));
                else delete record.memoryStamps;
                return { summary: `${record.name ?? 'someone'}: memories.`, data: { id, memories: memories.length }, narrate: false };
            },
        },
    };
}
