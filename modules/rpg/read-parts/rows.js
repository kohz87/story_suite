// Reads one Character, one Skills block and one Foes block's fields into the sheet's plain records.
import { FOE_SLOTS, LEVEL, STATS_EARLIER as STATS, USES } from '../names.js';
import { skillFieldSlots, skillTypeOf } from '../../../core/runtime/skill-slots.js';
import { barOf, characterBars, scaleOf, sizeOf } from '../blocks.js';
import { soulReading } from '../soul.js';
import { classOfLevel, levelOfClass } from '../formula.js';
import { isHardBar } from '../foes.js';
import { fold } from './match.js';
import { isObject, int, text, TEXT_KEY } from './shared-plain.js';

// `own`: the block's name, which stands in for a hidden Who (as the tail does). `definition`: the block's own, which says whether its bars are
// the Standard formula's blocks (blocks.js): then the record also has `size` (how many blocks each bar has now), and health, mana and stamina
// are the blocks left. A block of an older definition (stage fields) is read exactly as it was.
export function character(id, fields, own = '', hidden = new Set(), definition = null) {
    const levelled = isObject(definition?.state) && isObject(definition.state.level);
    const schema = isObject(definition?.state) ? (levelled ? definition.state.level : definition.state.soul) : null;
    const who = text(fields.who) || text(own);
    if (!who) return null;
    const stats = Object.fromEntries(STATS.map(stat => [stat, int(fields[stat])]));
    // What the pack calls the Soul Class field and its current value (soul.js), for the sheet lines and the odds.
    // (A block made before levels has the Soul Class and no level: its level reads as the class stands for, levelOfClass. `soul` stays what the field says,
    // which is what a roll recorded before levels used.)
    const soul = int(fields.soul) ?? 1, reading = soulReading(schema);
    const level = Math.max(1, Math.min(LEVEL.max, int(fields.level) ?? (Object.hasOwn(fields, 'soul') ? levelOfClass(soul) : 1)));
    const cap = Math.max(1, Math.min(LEVEL.max, int(fields.cap) ?? LEVEL.max));
    const bars = characterBars(definition, fields);
    return {
        module: id, who, key: fold(who),
        health: int(fields.health), mana: int(fields.mana), stamina: int(fields.stamina),
        ...(bars ? { size: { health: bars.health.size, stamina: bars.stamina.size, mana: bars.mana.size } } : {}),
        ...(bars && scaleOf(definition.state.health) === 2 ? { scale: 2 } : {}),
        stats, soul, level, cap, ...(levelled ? { levelled: true } : {}), soulLabel: reading.label, soulWord: levelled ? String(level) : reading.word(soul), xp: int(fields.xp), points: int(fields.points),
        alive: fields.alive !== false,
        skills: [],
        hidden: [...hidden].filter(key => !TEXT_KEY.test(key)),
    };
}

export function skillsOf(fields, hidden = new Set()) {
    const out = [];
    for (let n = 1; n <= skillFieldSlots(fields); n += 1) {
        const name = text(fields[`skill${n}`]);
        if (!name) continue;
        // A Skills block made before the stat and the resource were fields has neither: null, and the plan's stat is used.
        const stat = text(fields[`stat${n}`]).toLowerCase(), uses = text(fields[`uses${n}`]).toLowerCase();
        out.push({
            slot: n, name, about: text(fields[`about${n}`]), rank: int(fields[`rank${n}`]) ?? 0, practice: int(fields[`practice${n}`]) ?? 0,
            stat: STATS.includes(stat) ? stat : null, uses: USES.includes(uses) ? uses : null,
            ...(skillTypeOf(fields, n) === 'utility' ? { type: 'utility' } : {}),
            hidden: ['rank', 'practice', 'stat', 'uses'].filter(part => hidden.has(`${part}${n}`)),
        });
    }
    return out;
}

// A block's slots (six; an older block has 1…4). `offset`: where its numbering starts (the first Foes block is 1…6, the next 7…12, and so on; an older four-slot block is 1…4), so every
// slot of every Foes block has a number of its own in the plan.
// A hidden foe name is the slot's ("Foe 2"); a hidden count, class or health still counts for the rules and is listed in `hidden`.
export function foesOf(id, fields, offset = 0, hidden = new Set(), state = null) {
    const out = [];
    // A six-group block has `foe5`/`foe6` and marks each slot `local` (its field number); an older one reads as always (the fight's witness hashes this sheet).
    const six = Object.hasOwn(fields, 'foe5') || Object.hasOwn(fields, 'foe6');
    for (let n = 1; n <= FOE_SLOTS; n += 1) {
        if (n > 4 && !Object.hasOwn(fields, `foe${n}`)) continue;
        // A Standard group's Health is blocks left, out of foeHealthBlocks(class): `size` says how many (a stage-field slot has none).
        const size = barOf(state?.[`hurt${n}`]) ? sizeOf(state[`hurt${n}`], fields, `hurt${n}`) : null;
        const name = hidden.has(`foe${n}`) ? (text(fields[`foe${n}`]) ? `Foe ${offset + n}` : '') : text(fields[`foe${n}`]);
        const count = int(fields[`count${n}`]) ?? 0;
        // A block of the Levels rules has `level{n}`; one of the earlier rules has `class{n}` (kept as it was), whose level is worked out from it.
        const levelled = Object.hasOwn(fields, `level${n}`), soulClass = int(fields[`class${n}`]) ?? 1;
        const level = levelled ? Math.max(1, Math.min(99, int(fields[`level${n}`]) ?? 1)) : levelOfClass(soulClass) ?? 1;
        out.push({ slot: offset + n, ...(six ? { local: n } : {}), module: id, name, count, class: levelled ? classOfLevel(level) : soulClass, level, ...(levelled ? { levelled } : {}), hurt: int(fields[`hurt${n}`]) ?? 0, ...(size ? { size } : {}), ...(size && isHardBar(state[`hurt${n}`]) ? { hard: 1 } : {}), filled: Boolean(name) && count > 0,
            hidden: ['count', 'class', 'level', 'hurt'].filter(part => hidden.has(`${part}${n}`)) });
    }
    return out;
}
