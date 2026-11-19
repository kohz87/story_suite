// NPCPRESENT: a person the reply brings into the scene with `+ present` (no `+ npc`) gets an NPC State record in the reply's own step. After the reply's
// lines (the host's afterCapture), the names its story `+ present` lines added, and a `+ hook` line's giver:, go to one `npc.arrive` step:
//   a pack person (met, present here, or exactly named) gets their dossier from the pack, as a `+ npc` line would (./cast-first.js);
//   a new named person who is in the scene gets the `+ npc` stub with only their name, and the targeted fill-in (adapter/stub-fills.js, the reply's stamp)
//   fills the rest from the story. Nothing is invented here.
// Nobody is made twice: a same-reply `+ npc` line ran first and made the record, so its role and look stand. The rules of a `+ npc` stub hold: not the
// player or the character you play, not "Manual only", not a name the reader removed, not a short form that also fits a pack person, four new people a reply.
// A title, a group or a role ("clerk", "the guard", "Red Cord thugs") is not a person until the story gives a name. Lines mode only.
// The step is stored on the reply (receipt marked afterCapture): a swipe or a delete takes it back, a Re-read runs it again on the new lines, a reload replays it.
import { labelKey } from '../../dossier/cast-dossier-parts/shared-text.js';
import { NPC_DOMAIN, clean } from '../npc-meters-config.js';
import { makeNpcId } from '../../core/core-identity.js';
import { stubRecord } from './derived.js';
import { knownPerson } from './stub.js';
import { personNamed } from './names.js';

export const ARRIVE_COMMAND = 'npc.arrive';
const NEW_PER_REPLY = 4;   // the `+ npc` stubs' four a reply (./stub.js STUBS_PER_REPLY), shared with them
const NAMES_MAX = 12;
const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const names = list => (Array.isArray(list) ? list : []).filter(name => typeof name === 'string' && name.trim()).map(name => clean(name, 80));

// A name, not a title, a group or a role: every word starts with a capital (a joining word such as "of" or "van" may not), it does not start with an
// article or a number, and a single word is not one of the plain roles the story uses before a name is given ("+ present clerk", "+ present Guard").
const JOINING = new Set(['of', 'the', 'van', 'von', 'de', 'del', 'da', 'di', 'du', 'la', 'le', 'al', 'el', 'bin', 'ibn', 'ap', 'zu', 'and']);
const LEADING = /^(?:a|an|the|some|two|three|four|five|six|several|many|one|another|each|every|both)\s/iu;
const ROLES = new Set(['guard', 'guards', 'clerk', 'stranger', 'watchman', 'watchmen', 'innkeeper', 'merchant', 'soldier', 'captain', 'sergeant', 'priest',
    'healer', 'bandit', 'bandits', 'thug', 'thugs', 'child', 'boy', 'girl', 'man', 'woman', 'men', 'women', 'crowd', 'villagers', 'inspector', 'bargemaster']);
function looksNamed(name) {
    const text = String(name ?? '').trim();
    if (!text || LEADING.test(text) || /^\d/u.test(text)) return false;
    const words = text.split(/\s+/u);
    if (words.length === 1 && ROLES.has(text.toLowerCase())) return false;
    return words.every((word, at) => /^\p{Lu}/u.test(word) || (at > 0 && JOINING.has(word.toLowerCase())));
}

/** What the reply brings in, from its receipts and the state after its lines: { present: [names its story `+ present` lines added], givers: [hook givers] }. */
export function arrivals(view, receipts) {
    const present = [];
    const givers = [];
    const threads = view?.state?.domains?.director?.threads;
    for (const receipt of Array.isArray(receipts) ? receipts : []) {
        if (!isObject(receipt) || receipt.cause !== 'story' || receipt.assist === 'late') continue;
        if (receipt.type === 'capture.present') present.push(...names(receipt.data?.added));
        if (receipt.type === 'capture.hook' && typeof receipt.data?.thread === 'string' && isObject(threads)) givers.push(...names([threads[receipt.data.thread]?.fields?.giver]));
    }
    const seen = new Set();
    const once = list => list.filter(name => { const key = labelKey(name); if (!key || seen.has(key)) return false; seen.add(key); return true; });
    return { present: once(present).slice(0, NAMES_MAX), givers: once(givers).slice(0, NAMES_MAX) };
}

const dismissed = (ctx, name) => {
    const groups = ctx.read('people')?.userDismissedGroups;
    return (Array.isArray(groups) ? groups : []).some(group => (Array.isArray(group?.labels) ? group.labels : []).some(label => labelKey(label) === labelKey(name)));
};
const manualOnly = ctx => { try { return ctx.settings?.()?.admissionMode === 'manual_only'; } catch { return false; } };
const isToken = name => /^\{\{\s*(?:user|char)\s*\}\}$/iu.test(String(name ?? '').trim());

/**
 * `deps`: { hooks (playerNames), linesMode(ctx?) → boolean, baseline() → meters, castFirst (./cast-first.js) }.
 * → { afterCapture(view, info) → { commands } | undefined, command(ctx, payload) } (the `npc.arrive` handler, to be folded onto the bonds).
 */
export function createArrivals({ hooks = {}, linesMode, baseline, castFirst }) {
    // Only names that may make someone: a name (not a title), with no record yet (the state after the reply's lines), not the player's.
    function afterCapture(view, info = {}) {
        if (!linesMode()) return undefined;
        const npcs = view?.state?.domains?.people?.npcs;
        let players = [];
        try { players = (hooks.playerNames?.() ?? []).map(labelKey).filter(Boolean); } catch { /* no names known */ }
        const open = name => looksNamed(name) && !isToken(name) && !players.includes(labelKey(name)) && personNamed(isObject(npcs) ? npcs : {}, name) === null;
        const { present, givers } = arrivals(view, info.receipts);
        const payload = { present: present.filter(open), givers: givers.filter(open) };
        return payload.present.length || payload.givers.length ? { commands: [{ type: ARRIVE_COMMAND, payload }] } : undefined;
    }
    function command(ctx, payload = {}) {
        if (ctx.cause !== 'system') ctx.fail('REFUSED', 'A record from + present is the reply\'s own step.');
        if (!linesMode(ctx)) ctx.fail('REFUSED', 'Change lines for people are not on.');
        let players = [];
        try { players = (hooks.playerNames?.() ?? []).map(labelKey).filter(Boolean); } catch { /* no names known */ }
        // The reply the step is stored on (ctx.reply: a step after the lines has no carrier): its stamp is the one a `+ npc` stub of this reply gets.
        const at = Number.isInteger(ctx.carrier?.index) ? ctx.carrier.index : ctx.reply?.index;
        const stamp = Number.isInteger(at) ? at + 1 : 1;
        const made = [];
        const skip = name => !looksNamed(name) || isToken(name) || players.includes(labelKey(name)) || knownPerson(ctx, name) !== null;
        // A hook's giver: only a pack person, made as a `+ npc` line naming them would be (exact name or alias, or met or present here).
        for (const name of names(payload.givers)) {
            if (skip(name) || typeof castFirst !== 'function') continue;
            const pack = castFirst(ctx, name, { named: true });
            if (pack) made.push(pack.name);
        }
        for (const name of names(payload.present)) {
            if (skip(name)) continue;
            const pack = typeof castFirst === 'function' ? castFirst(ctx, name) : null;
            if (pack) { made.push(pack.name); continue; }
            if (manualOnly(ctx) || dismissed(ctx, name) || castFirst?.fits?.(ctx, name)) continue;
            const fresh = Object.values(ctx.read('people')?.npcs ?? {}).filter(record => record?.createdAt === stamp && !record.castFrom).length;
            if (fresh >= NEW_PER_REPLY) continue;
            const taken = [...Object.keys(ctx.read('people')?.npcs ?? {}), ...Object.keys(ctx.read(NPC_DOMAIN)?.npcs ?? {})];
            const id = makeNpcId(name, taken);
            if (!PEOPLE_ID.test(id)) continue;
            ctx.call('people.stub', { id, record: stubRecord({ name, role: '', look: '' }, id, baseline(), stamp) });
            made.push(name);
        }
        // Nobody after all (Manual only, a name the reader removed, a short form that fits two, the four a reply): nothing changes, and it is no Problem.
        if (!made.length) return { summary: '', data: { made }, narrate: false };
        return { summary: `NPC State: ${made.join(', ')} ${made.length === 1 ? 'has' : 'have'} a record now.`, data: { made }, narrate: false };
    }
    return { afterCapture, command };
}
