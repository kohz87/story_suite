// The story facts a settled fight shares with NPC State (pack format 4, §5.4). The sheet owns the numbers; NPC State's Level is a story fact the two keep in step, in the settle's own change set:
// a Level NPC State holds that is higher than the sheet's raises the sheet first (never lowers it), and a level the fight's XP then gained is written back to the person (people.fields; only up).
// Both read the people slice of the reply's prefix and the Character block, so a swipe, a Re-read, a middle delete, a rewind and a reload (which run the settle again) write the same.
import { createEvaluation } from '../../data-modules/interpreter.js';
import { personOf } from '../join-parts/from-person.js';
import { V1 } from '../combat/numbers.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const levelOf = fields => (Number.isSafeInteger(fields?.level) ? fields.level : 0);

function fieldsOf(draft, module) {
    const fields = draft.instances?.[module]?.chat?.fields;
    return plain(fields) && Number.isSafeInteger(fields.level) ? fields : null;
}

/** The heroes this settle touches, once each: `[{ module, who }]` from the XP awards and the practised skills. */
export function heroesOf(awards, items) {
    const seen = new Map();
    for (const hero of [...awards, ...items]) if (hero.module && hero.who && !seen.has(hero.module)) seen.set(hero.module, { module: hero.module, who: hero.who });
    return [...seen.values()];
}

/** Raises a sheet to the Level NPC State holds for that person when it is higher (held to the sheet's cap); one point per level gained, as a rise by XP gives. Returns `{ [module]: level now }`. */
export function raiseToStory(ctx, heroes) {
    const draft = ctx.draft('dataModules'), people = { domains: { people: ctx.read('people') } }, now = {};
    for (const { module, who } of heroes) {
        const fields = fieldsOf(draft, module);
        if (!fields) continue;
        const stated = personOf(people, who)?.level, cap = Number.isSafeInteger(fields.cap) ? fields.cap : V1.level.max;
        const level = Number.isSafeInteger(stated) ? Math.min(stated, cap, V1.level.max) : 0;
        now[module] = fields.level;
        if (level <= fields.level) continue;
        const gained = level - fields.level, definition = draft.pins?.[draft.active?.[module]?.hash]?.definition;
        if (plain(definition?.state) && Array.isArray(definition.rules)) {
            const evaluation = createEvaluation(definition, draft.instances[module].chat, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
            evaluation.effects([{ op: 'set', path: ['level'], value: level }, { op: 'add', path: ['points'], value: gained * V1.stat.perLevel, bounds: 'clamp' }]);
            evaluation.rules();
            evaluation.finish();
        } else { fields.level = level; if (Number.isSafeInteger(fields.points)) fields.points += gained * V1.stat.perLevel; }
        now[module] = level;
    }
    return now;
}

/** Writes a level the sheet gained (above `before`, the level after the raise) to the person's NPC State record, in this change set. A hero with no unique record is left alone. */
export function writeBack(ctx, heroes, before) {
    const draft = ctx.draft('dataModules'), people = { domains: { people: ctx.read('people') } };
    for (const { module, who } of heroes) {
        const level = levelOf(fieldsOf(draft, module)), record = personOf(people, who);
        if (!record?.id || !(level > (before[module] ?? level))) continue;
        ctx.call('people.fields', { id: record.id, fields: { level: String(level) } });
    }
}
