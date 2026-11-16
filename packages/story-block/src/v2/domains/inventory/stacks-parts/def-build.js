// Building a new def through the `item.define` hooks and storing it.

import { isPlainObject, clone } from '../../common.js';
import { aliasKey } from '../../names.js';
import { gearDefine, packBonus, itemCarryOf } from '../../gear.js';
import { gearOn, RARITIES, STORY_KIND, packCarry } from '../state.js';
import { legendaryEarned } from '../validate.js';
import { economyOf } from './economy.js';

// The most a pack's place allows the story's items to be (`loot: { maxRarity }` on the place the party is at, by name or alias), or null.
function placeCeiling(ctx) {
    try {
        const here = ctx.read('scene')?.place?.name;
        if (typeof here !== 'string' || !here.trim()) return null;
        const places = ctx.query('packs.content', { kind: 'places' });
        const key = aliasKey(here);
        const place = (Array.isArray(places) ? places : []).find(entry => [entry?.name, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])].some(other => typeof other === 'string' && aliasKey(other) === key));
        const top = place?.loot?.maxRarity;
        return RARITIES.includes(top) ? top : null;
    } catch { return null; }
}

// A new def through the `item.define(def, { note, owner })` hooks (each may mutate the def or
// return fields to merge), then stored with its name as an alias. `keep` = fields the caller set
// that the hooks may not change; the ID is never theirs to change, and equipment never stacks.
// A hook that throws leaves the def as it was before that hook and goes to the Problems list: one
// module's bug never stops the item being gained.
// The money scale the item.define hooks price a new thing with (MODULES §F104): the reader's, else the pack's, else 1.
function hookScale(env) {
    try {
        return economyOf(env.settings?.(), typeof env.economy === 'function' ? env.economy() : null).scale;
    } catch {
        return 1;
    }
}

function buildDef(def, env, about, keep = {}) {
    const id = def.id;
    // While gear is on, the kind word of a story line (`+ item Healing Draught | kind: consumable`): a new plain item takes the inventory kind it names (consumable, material, quest);
    // a gear word (weapon, cloak, ...) is not one and is read by the gear step below.
    const saidKind = STORY_KIND[String(about.words?.kind ?? '').normalize('NFKC').toLowerCase().trim().split(/[^a-z]+/).find(word => Object.hasOwn(STORY_KIND, word))];
    if (about.gear === true && saidKind && def.kind === 'goods') def.kind = saidKind;   // (only with gear on: gear off builds the def exactly as 2.17.0 did)
    // Gear (`story-block.gear`): the slot and rarity the line's words and the name give, before the modules' hooks.
    if (about.gear === true) {
        gearDefine(def, about.words ?? {}, {
            allowLegendary: about.legendary === true, ceiling: about.ceiling ?? null,
            onHeld: (wanted, given) => env.problem?.({ module: 'story-block', code: 'HELD', message: `${def.name} was written ${wanted}; the story's items reach ${given} here${about.legendary === true ? '' : ' (legendary needs a quest completed or a hard fight won in the same reply)'}.` }),
        });
    }
    const hooks = env.hookEntries?.('item.define') ?? env.hooks('item.define').map(fn => ({ moduleId: null, fn }));
    for (const { moduleId, fn } of hooks) {
        const before = clone(def);
        try {
            const out = fn(def, { note: about.note ?? '', owner: about.owner ?? 'party', scale: hookScale(env) });
            if (isPlainObject(out) && out !== def) Object.assign(def, out);
        } catch (error) {
            for (const key of Object.keys(def)) delete def[key];
            Object.assign(def, before);
            env.problem?.({ module: moduleId, code: 'FAILED', message: `item.define failed on "${def.name}": ${error?.message ?? error}. The item keeps the rules it had before.` });
        }
    }
    Object.assign(def, keep, { id });
    // A carry capacity only a pack's def keeps (whatever a hook wrote): the story never sets one.
    const carry = packCarry(id, def.carry);
    if (carry === null) delete def.carry;
    else def.carry = carry;
    // A gear bonus only a pack's def keeps, as for carry: the story never sets one.
    const bonus = packBonus(id, def.bonus);
    if (bonus === null) delete def.bonus;
    else def.bonus = bonus;
    // With gear on, a cart, barrow, sledge, carriage, coach, barge or wagon the story names adds the capacity of its kind (gear.js KIND_CARRY) while it is owned.
    if (about.gear === true && itemCarryOf(def.name)) def.carry = itemCarryOf(def.name);
    if (def.kind === 'equipment') def.stack = false;   // MODULES.md F6
    return def;
}

function addDef(inv, def, env, about, keep = {}) {
    buildDef(def, env, about, keep);
    inv.defs[def.id] = clone(def);
    inv.aliases[aliasKey(def.name)] ??= def.id;
    return inv.defs[def.id];
}

// Store a new definition, with generic item hooks when appropriate.
export function registerNew(ctx, inv, def, env, about, { keep = {}, hooks = true } = {}) {
    return hooks ? addDef(inv, def, env, gearOn(ctx) ? { ...about, gear: true, legendary: legendaryEarned(ctx), ceiling: placeCeiling(ctx) } : about, keep) : storeDef(inv, def);
}

// A def stored as it is (its hooks, if any, have run).
export function storeDef(inv, def) {
    inv.defs[def.id] = clone(def);
    inv.aliases[aliasKey(def.name)] ??= def.id;
    return inv.defs[def.id];
}
