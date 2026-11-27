// `~ rest Who — short | night | day`: the story shows rest. Short (an hour or more) and night refill mana and stamina; day (a whole day) also heals a stage, clears Down and ages injuries.
// Refused only while a fight is still on (foes-fights.js blockingFoes): a standing group touched in this reply or the one before, or in a reply that began within the last 60 story minutes.
// Older leftovers do not stop a rest and the rest leaves them as they are. A reply captured before that rule (no `restCurrent` rule mark) is refused while any group stands.
// Under the mark a refused line is kept as a receipt that changes nothing, so the reply's card says why (`data.card`) and a swipe, a Re-read or a delete takes it with the reply.
// With no mark a refused line fails as it did, with no receipt.
import { DOMAIN } from '../../domain/shape.js';
import { requireActive } from '../active.js';
import { standing } from '../foes-record.js';
import { blockingFoes } from '../foes-fights.js';
import { partsOf } from '../line-read.js';
import { memberNamed, players } from '../members.js';
import { restBlock, restMembers } from '../resting.js';

const KINDS = ['short', 'night', 'day'];
const SAID = { short: 'rests a while', night: 'rests the night', day: 'rests the day' };

// `reason` is a sentence that reads on after "Rest refused:"; `detail` is what to do about it.
const refused = (line, reason, detail = null) => ({
    summary: `Rest refused: ${reason}`, narrate: false,
    data: { refused: reason, card: { line: `Rest refused: ${reason}`, ...(detail ? { detail } : {}), refused: true } },
    problem: `"${String(line.raw ?? '~ rest').trim()}" was not used: ${reason}${detail ? ` ${detail}` : ''}`,
});

export function applyRest(ctx, line) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const marked = ctx.carrier?.rules?.includes('restCurrent') === true;
    // With no mark: the failure from before (`code`, `old`), which leaves no receipt.
    const deny = (code, old, reason, detail) => (marked ? refused(line, reason, detail) : ctx.fail(code, old));
    const kind = String(partsOf(line)[0] ?? '').trim().toLowerCase();
    if (!KINDS.includes(kind)) return deny('INVALID', 'Rest is short, night or day.', 'it is short, night or day.');
    const now = ctx.time?.() ?? null;
    const block = restBlock(marked ? blockingFoes(slice, { sid: ctx.reply?.sid, index: ctx.reply?.index, entries: ctx.receipts(), now }) : standing(slice, now));
    if (block) return deny('REFUSED', 'Foes still stand; no one rests.', `${block.why}.`, block.end);
    const given = String(line.name ?? '').trim();
    if (!given) return deny('INVALID', 'Rest needs a name or Party.', 'it needs a name or Party.');
    const party = /^party$/i.test(given) && !memberNamed(slice, given);
    const named = party ? null : memberNamed(slice, given);
    if (!party && !named) return deny('NOT_FOUND', `No character called ${given.slice(0, 40)}.`, `there is no character called ${given.slice(0, 40)}.`);
    if (named?.fallen) return deny('REFUSED', `${named.name} has fallen.`, `${named.name} has fallen.`);
    // A companion keeps no mana or stamina on the sheet: resting one (or a party of none) changes nothing, so it is refused rather than told as done.
    const resting = (named ? [named] : players(slice)).map(member => slice.members[member.id]).filter(member => !member.companion);
    if (!resting.length) {
        const companion = named ? `${named.name} is a companion: no mana or stamina to refill.` : null;
        return deny('REFUSED', companion ?? 'No one on the sheet rests.', companion ?? 'no one on the sheet rests.');
    }
    const members = restMembers(ctx, resting, { day: kind === 'day' });
    const who = party ? 'The party' : named.name;
    const healed = kind === 'day' ? ' A day heals a stage.' : '';
    const summary = `${who} ${SAID[kind]}: mana and stamina full.${healed}`;
    return { summary, narrate: false, data: { kind, members, card: { line: summary } } };
}
