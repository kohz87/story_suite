// The `~ reveal Name | opened: <note id> | quote: "short exact quote from this reply"` line (NSD12): a hidden note whose story event the reply showed opens. The #361 quote check is
// the scan's own (secretEventsShown: 8+ letters, found in the exchange); here the exchange is the reader's message and this reply's story text WITHOUT its <Changes> block, so a quote that
// is only in the line itself finds nothing. The note must be one of that person's still-locked event notes (it opens once; an open one, a shut one and one with no event are refused).
// A pack secret with a gate comes out while its gate is open. In a reply with the `revealNext` rule mark the story can also earn it: the person's next secret not yet told
// (nextSecret: the one the tail marks "(not yet told)") comes out with its quote though its gate is closed, and `opened:` may be the pack's own id for it (what the tail prints).
// The open is the line's own op (the same run as `npc.open` by a story event), so a swipe, a Re-read, an edit, a Continue and a reload decide it again the same way.
import { NPC_DOMAIN, clean, slug } from '../npc-meters-config.js';
import { secretEventsShown } from '../../core/core-prompts-capture.js';
import { knownOrCast } from './cast-first.js';
import { gateOpen, nextSecret } from '../npc-meters-secrets-parts/revealable.js';

const fold = value => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** The line's labels as { opened, quote } (by slugged label). */
const labelsOf = line => Object.fromEntries(Object.entries(line?.labels ?? {}).map(([label, raw]) => [slug(label), String(raw ?? '')]));

/**
 * Runs one `~ reveal` line. `deps`: { identify, rulesFor, run } (the part's record helpers and its run); `castFirst` (./cast-first.js): a pack person met or
 * present here gets their dossier from the pack first (S2PA B1). → the run's receipt.
 */
export function secretLine(ctx, line, { identify, rulesFor, run, call = () => ({}), hooks = {}, defs = () => [], castFirst = null }) {
    const name = clean(line?.name, 40);
    const { opened = '', quote = '' } = labelsOf(line);
    const found = knownOrCast(ctx, line?.name, castFirst);
    if (!found) ctx.fail('REFUSED', `${name} has no record yet; write + npc ${name} | role | look first.`);
    const id = clean(opened, 80);
    if (!id) ctx.fail('REFUSED', `~ reveal ${name}: opened: is empty.`);
    const text = `${ctx.chat?.lastUser ?? ''}\n${ctx.chat?.reply ?? ''}`;
    if (!secretEventsShown({ secretEvents: [id], secretEventEvidence: { [id]: quote } }, text).length) ctx.fail('REFUSED', `~ reveal ${name}: no quote found in this reply; the note stays closed.`);
    const slice = ctx.draft(NPC_DOMAIN);
    const full = typeof found.record?.name === 'string' ? found.record.name : line.name;   // (F50: a first name finds the person; their entry is found by the full name)
    const who = identify(slice.npcs ?? {}, full);
    const record = who ? slice.npcs?.[who.key] : null;
    const rules = rulesFor(who?.name ?? found.record?.name ?? line.name, who?.labels ?? []);
    const earnable = ctx.carrier?.rules?.includes('revealNext') === true;
    const rule = rules.find(item => item?.id === id) ?? (earnable ? rules.find(item => item?.gate && item.packId === id) : undefined);
    if (!rule?.when && typeof rule?.gate !== 'string') ctx.fail('REFUSED', `~ reveal ${name}: ${clean(id, 40)} is not one of their hidden notes with a story event.`);
    // A pack secret with a gate (world-events switch) may be revealed only while its gate is open; the quote check above still applies.
    const gated = !rule.when && typeof rule.gate === 'string';
    if (gated) {
        // Anchors and place come from the transaction's own state (ctx.query), never the head: a Re-read of an earlier reply reads the world as it was then.
        const ask = (query, fallback) => { try { const answer = ctx.query?.(query, {}); return answer === undefined || answer === null ? fallback : answer; } catch { return fallback; } };
        const here = ask('scene.place', '');
        const inputs = { ...call(hooks.gateInputs, {}, who?.name ?? name), anchors: ask('chronicle.world.anchors', []), place: typeof here === 'string' ? here : here?.name ?? '', quote: wanted => fold(text).includes(fold(wanted)) };
        const byId = new Map(defs().map(def => [def.id, def]));
        const earned = () => earnable && nextSecret(rules, record ?? {}, byId, inputs)?.id === rule.id;
        if (!gateOpen(rule, record ?? {}, byId, inputs) && !earned()) ctx.fail('REFUSED', `~ reveal ${name}: ${clean(id, 40)} is not ready to come out yet; the note stays closed.`);
    }
    if (Array.isArray(record?.unlocked) && record.unlocked.includes(rule.id)) ctx.fail('REFUSED', `~ reveal ${name}: that note is already open.`);
    return run(ctx, { label: full, changes: [], problems: [], limit: false, reply: null, allowEmpty: true, notes: { open: [rule.id], close: [], story: true, ...(gated ? { gated: true } : {}) } });
}
