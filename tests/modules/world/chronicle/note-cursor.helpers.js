// Shared by the note-cursor tests: a real Story Block host with Story Director, and revision-free views of what the
// chronicle's note kept (the quest history and the day facts), so a chat and a fresh telling of it can be compared.

import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { questLogOrder } from '../../../../modules/world/chronicle/days-parts/quest-log-order.js';

export const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;

/** A host told `replies` (each a list of change lines; reply i says "R<i>."). */
export async function tell(replies) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [module] });
    for (const [i, lines] of replies.entries()) await host.send('On.', said(`R${i}.`, lines));
    return host;
}

export const chronicleOf = host => host.head().domains.chronicle;
const nameOf = (host, id) => host.head().domains.director?.threads?.[id]?.key ?? id;
const byKey = (a, b) => { const [x1, x2] = a[0].split('.').map(Number); const [y1, y2] = b[0].split('.').map(Number); return x1 - y1 || (x2 ?? 0) - (y2 ?? 0); };

/** The quest history as stored, in its order, as `<quest>:<line>` (no keys, no thread IDs). */
export const questLines = host => Object.entries(chronicleOf(host).questLog ?? {}).sort(questLogOrder).map(([, v]) => `${nameOf(host, v.thread)}:${v.text}`);

/** The day-facts entries in key order, as `<day>:<count>`. */
export const dayCounts = host => Object.entries(chronicleOf(host).dayFacts ?? {}).sort(byKey).map(([, v]) => `${v.day}:${v.count}`);

/** Each quest's history as the Quests screen reads it (`chronicle.questLog`), by quest name. */
export function details(host) {
    const ids = [...new Set(Object.values(chronicleOf(host).questLog ?? {}).map(v => v.thread))];
    return Object.fromEntries(ids.map(id => [nameOf(host, id), (host.sdk.query('chronicle.questLog', { id }) ?? []).map(x => x.text)]).sort(([a], [b]) => a.localeCompare(b)));
}

/** Every view at once, to compare with a fresh telling. */
export const views = host => ({ quests: questLines(host), days: dayCounts(host), details: details(host) });

/** The chat index of reply `tag` ("R2"). */
export const replyAt = (host, tag) => host.ctx.chat.findIndex(m => !m.is_user && String(m.mes).startsWith(`${tag}.`));

/** Edit reply `tag` to say `lines` and Re-read it. */
export async function editAndReread(host, tag, lines) {
    const index = replyAt(host, tag);
    await host.st.editMessage(index, said(`${tag}.`, lines));
    return host.sdk.reread(index);
}

/** Whether a rebuild from the stored records gives the same chronicle. */
export function reloadSame(host) {
    const before = JSON.stringify(chronicleOf(host));
    host.store.rebuild();
    return JSON.stringify(chronicleOf(host)) === before;
}

export const duplicates = list => list.filter((x, i) => list.indexOf(x) !== i);

export const STORY = [['~ time June 3, 1200, 06:00 pm', '~ place Harrow', '+ quest Q — go | giver: A'], ['~ quest Q | step: one'], ['! time +1 hour', '~ place Old Weir', '~ quest Q | step: two'], ['~ quest Q | done']];
export const NEXT = ['! time +1 hour', '~ place Bluewatch', '+ quest Z — late | giver: B'];
export const pad = (n, tag = 'P') => Array.from({ length: n }, (_, i) => `+ quest ${tag}${i} — x | giver: A`);
