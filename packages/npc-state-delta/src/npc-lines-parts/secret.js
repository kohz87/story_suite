// The `~ secret Name | opened: <note id> | quote: "short exact quote from this reply"` line (NSD12): a hidden note whose story event the reply showed opens. The #361 quote check is
// the scan's own (secretEventsShown: 8+ letters, found in the exchange); here the exchange is the reader's message and this reply's story text WITHOUT its <Changes> block, so a quote that
// is only in the line itself finds nothing. The note must be one of that person's still-locked event notes (it opens once; an open one, a shut one and one with no event are refused).
// The open is the line's own op (the same run as `npc.open` by a story event), so a swipe, a Re-read, an edit, a Continue and a reload decide it again the same way.
import { NPC_DOMAIN, clean, slug } from '../npc-meters-config.js';
import { secretEventsShown } from '../../core-prompts-capture.js';
import { knownPerson } from './stub.js';

/** The line's labels as { opened, quote } (by slugged label). */
const labelsOf = line => Object.fromEntries(Object.entries(line?.labels ?? {}).map(([label, raw]) => [slug(label), String(raw ?? '')]));

/** Runs one `~ secret` line. `deps`: { identify, rulesFor, run } (the part's record helpers and its run). → the run's receipt. */
export function secretLine(ctx, line, { identify, rulesFor, run }) {
    const name = clean(line?.name, 40);
    const { opened = '', quote = '' } = labelsOf(line);
    const found = knownPerson(ctx, line?.name);
    if (!found) ctx.fail('REFUSED', `${name} has no record yet; write + npc ${name} | role | look first.`);
    const id = clean(opened, 80);
    if (!id) ctx.fail('REFUSED', `~ secret ${name}: opened: is empty.`);
    const text = `${ctx.chat?.lastUser ?? ''}\n${ctx.chat?.reply ?? ''}`;
    if (!secretEventsShown({ secretEvents: [id], secretEventEvidence: { [id]: quote } }, text).length) ctx.fail('REFUSED', `~ secret ${name}: no quote found in this reply; the note stays closed.`);
    const slice = ctx.draft(NPC_DOMAIN);
    const who = identify(slice.npcs ?? {}, line.name);
    const record = who ? slice.npcs?.[who.key] : null;
    const rule = rulesFor(who?.name ?? found.record?.name ?? line.name, who?.labels ?? []).find(item => item?.id === id);
    if (!rule?.when) ctx.fail('REFUSED', `~ secret ${name}: ${clean(id, 40)} is not one of their hidden notes with a story event.`);
    if (Array.isArray(record?.unlocked) && record.unlocked.includes(id)) ctx.fail('REFUSED', `~ secret ${name}: that note is already open.`);
    return run(ctx, { label: line.name, changes: [], problems: [], limit: false, reply: null, allowEmpty: true, notes: { open: [id], close: [], story: true } });
}
