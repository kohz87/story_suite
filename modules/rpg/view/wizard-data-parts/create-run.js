// The New character wizard's Create, without a DOM: the same commands, in the same order, as the old Review step (../wizard/review.js create)
// sends, so a window that only draws (the new view's wizard) makes the same blocks, things and money. Two defines (the Character, then its
// Skills after it; the first taken back when the second fails), then the missing fight blocks (best effort), then an imported file's things and
// money (best effort). `command(type, payload)` is the host's (it answers { ok, … }; a throw counts as a refusal).

import { DM_LIMITS } from '../../../data-modules/schema.js';
import { refusalText } from '../../../../core/strings.js';
import { fold } from '../../read.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { problemsOf } from './problems.js';
import { buildDefinitions, extraDefinitions } from './definitions.js';
import { extraName } from './shared-template.js';

const W = RPG_STRINGS.wizard;
const safe = (fn, fallback) => { try { return fn() ?? fallback; } catch { return fallback; } };

/** Why the missing fight blocks could not be added (`skipped` is extrasPlan's), in the Review step's words. */
export const whyNot = skipped => fill(skipped.some(item => item.why === 'room') ? W.extraRoom : W.extraActions, { max: DM_LIMITS.definitions });

/** Who holds an imported character's things: the party's actor of that name when a party module lists one, else 'party' (a You always carries in the bag). */
export function ownerFor(draft, query) {
    if (draft.kind === 'you') return 'party';
    const actors = safe(() => query?.('party.actors'), []);
    const found = (Array.isArray(actors) ? actors : []).find(actor => typeof actor?.id === 'string' && fold(actor.name) === fold(draft.name));
    return found?.id ?? 'party';
}

// One `inventory.add` per thing the file had (and its carry when kept), then the purse raised by the file's money. → what could not be added.
async function addImported(file, draft, call, query) {
    const owner = ownerFor(draft, query), failed = [];
    for (const item of file.items ?? []) {
        const added = await call('inventory.add', { name: item.name, qty: item.qty, owner, starting: true, ...(item.note ? { note: item.note } : {}),
            ...(item.kind ? { kind: item.kind } : {}), ...(item.rarity ? { rarity: item.rarity } : {}),
            ...(item.slot ? { slot: item.slot } : {}), ...(item.stats ? { stats: item.stats } : {}) });
        const stack = added.data?.stacks?.[0] ?? added.receipt?.data?.stacks?.[0];
        if (added.ok && item.carry && stack) await call('inventory.carry', { stack, carry: item.carry });
        if (!added.ok) failed.push(fill(W.notAdded, { what: `${item.name}${item.qty === 1 ? '' : ` ×${item.qty}`}`, why: refusalText(added, W.generic) }));
    }
    if (file.money > 0) {
        const purse = safe(() => query?.('inventory.wallet', { owner: 'party' }), null)?.coin;
        const set = await call('wallet.set', { owner: 'party', amount: (Number.isSafeInteger(purse) ? purse : 0) + file.money, starting: true });
        if (!set.ok) failed.push(fill(W.moneyNotAdded, { why: refusalText(set, W.generic) }));
    }
    return failed;
}

/**
 * Runs Create for the read draft `draft` (readDraft's) in `world` (the wizard's: { used, extras, … }, problemsOf's input too). `imported` is the
 * session's import ({ file } or null); `command(type, payload)` the host's; `query(name, args)` its reads; `headState()` and `levelCap()` as the wizard's.
 * → { ok: false, failure } (nothing made, or `failure` '' when problems stop it) | { ok: true, finished } (`finished` '' or the "made, but not …" sentence).
 */
export async function runCreate({ draft, world, imported = null, command, query = null, headState = () => null, levelCap = () => null }) {
    if (problemsOf(draft, world).length) return { ok: false, failure: '' };
    if (typeof command !== 'function') return { ok: false, failure: W.generic };
    const call = async (type, payload) => {
        try { return (await command(type, payload)) ?? { ok: false }; } catch (error) { return { ok: false, message: String(error?.message ?? error) }; }
    };
    const definitions = buildDefinitions(draft, { used: world.used, cap: safe(levelCap, null) });
    let failure = '';
    const first = await call('dm.define', { definition: definitions.character });
    if (!first.ok) failure = safe(headState, null) ? fill(W.failedFirst, { why: refusalText(first, W.generic) }) : W.noChat;
    else {
        const second = await call('dm.define', { definition: definitions.skills, after: `pack.chat/${definitions.character.slug}` });
        if (!second.ok) {
            const undone = await call('dm.remove', { module: `pack.chat/${definitions.character.slug}` });
            const why = refusalText(second, W.generic);
            failure = undone.ok ? fill(W.failedSecond, { why }) : fill(W.failedBoth, { why, name: definitions.character.name });
        }
    }
    if (failure) return { ok: false, failure };
    const unadded = world.extras.skipped.map(item => ({ role: item.role, why: whyNot([item]) }));
    const used = [...world.used, `pack.chat/${definitions.character.slug}`, `pack.chat/${definitions.skills.slug}`];
    for (const definition of extraDefinitions(world.extras.add, { used })) {
        const made = await call('dm.define', { definition });
        if (!made.ok) unadded.push({ role: definition.role, why: refusalText(made, W.generic) });
    }
    const notThings = imported ? await addImported(imported.file, draft, call, query) : [];
    if (!unadded.length && !notThings.length) return { ok: true, finished: '' };
    const blocks = unadded.length ? fill(W.madeButNot, { name: draft.name, list: unadded.map(item => extraName(item.role)).join(', '), why: [...new Set(unadded.map(item => item.why))].join(' '), hint: W.extraHint }) : '';
    const things = notThings.length ? fill(blocks ? W.thingsNotAdded : W.madeButNotThings, { name: draft.name, list: notThings.join('; ') }) : '';
    return { ok: true, finished: [blocks, things].filter(Boolean).join(' ') };
}
