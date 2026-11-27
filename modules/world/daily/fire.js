// World events, the daily step: an event fires (outcome picked, effects applied: event-level first, then the outcome's) and
// ends (on_end applied, its holds and displacements released). Lapsed or Replaced events end too, without on_end. Pure (on `ws`).

import { recordAnchor } from './anchors.js';
import { applyEffects, runEvacuations } from './effects.js';
import { releaseHolds } from './holds.js';
import { releaseDisplaced } from './cast.js';
import { weightValue } from './weight.js';
import { fillSummary, titleOf, unfiredSummary } from './event-title.js';
import { eventWords, townBind } from './event-words.js';
import { neverOpened } from './never-opened.js';

const DAY = 1440;

/** The chosen outcome (one is certain; none written → none), from the seeded draw `${id}#outcome`. */
export function pickOutcome(ws, def, day) {
    const list = def.outcomes ?? [];
    if (!list.length) return null;
    const weights = list.map(outcome => weightValue(ws, outcome.weight));
    const total = weights.reduce((a, b) => a + b, 0);
    const used = total > 0 ? weights : weights.map(() => 1);
    let at = ws.draw(day, `${def.id}#outcome`) * (total > 0 ? total : list.length);
    for (let index = 0; index < list.length; index += 1) {
        if (at < used[index]) return list[index];
        at -= used[index];
    }
    return list[list.length - 1];
}

/** What a firing or an end says of the event: its filled summary, else its authored title, else ''. */
const saidOf = (ws, def, bind, outcome) => eventWords(ws.geo, def, bind, outcome).text || titleOf(def.title, def.id);

/** The line with "(<name> survived)" when a death in the outcome was skipped (ruling 49), so the Journal and the cast never disagree. */
const survivedText = (text, names) => (!names.length ? text : text ? `${text} (${names.join(' and ')} survived)` : `${names.join(' and ')} survived.`);

/** The event fires on `day` (bound to `bind` for a recurring one, taking slots in `realms`). An instant event ends the same day. */
export function fireEvent(ws, def, day, bind, realms) {
    const row = ws.events[def.id];
    const outcome = pickOutcome(ws, def, day);
    Object.assign(row, { state: 'active', fired: day, realms, major: def.severity === 'major' });
    if (outcome) row.outcome = outcome.name; else delete row.outcome;
    if (bind?.place) { row.bind = bind; row.places = { ...(row.places ?? {}), [bind.place]: day }; } else delete row.bind;
    recordAnchor(ws.anchors, `fired:${def.id}`, day);
    // With no summary to say, the authored title is the text (never the id); with neither, the outcome's words alone, or no line.
    const base = saidOf(ws, def, bind, outcome?.name);
    const more = outcome?.summary ? fillSummary(outcome.summary, townBind(ws.geo, bind), outcome.name) : '';
    const summary = [more && base && !/[.!?…]$/.test(base) ? `${base}.` : base, more].filter(Boolean).join(' ');
    const source = { kind: 'event', id: def.id, title: def.title, held: true, summary, evenInParty: def.evenInParty === true, survived: [] };
    const { on_end: _end, ...main } = def.effects ?? {};
    // Named moves of both blocks apply before the event's evacuations (ruling 39: someone a named move placed is exempt).
    const evac = [];
    applyEffects(ws, main, source, day, bind, evac);
    if (outcome?.effects) { const { on_end: _o, ...rest } = outcome.effects; applyEffects(ws, rest, source, day, bind, evac); }
    runEvacuations(ws, evac);
    const line = survivedText(summary, source.survived);
    // `where` and `title` let the host write the happening as news from where it happened (world-daily/news-entries.js).
    ws.journal.push({ day, text: line, by: def.id, fired: true, reach: def.reach, title: def.title, where: def.where?.refs ?? [], ...(bind?.place ? { place: bind.place } : {}) });
    if (def.ends?.instant) endEvent(ws, def, day);
}

/** The event Ends on `day`: on_end (the event's, then the outcome's), holds released, displacements by it lapse. Recurring events wait again. */
export function endEvent(ws, def, day) {
    const row = ws.events[def.id];
    const bind = row.bind ?? {};
    const outcome = (def.outcomes ?? []).find(each => each.name === row.outcome);
    recordAnchor(ws.anchors, `ended:${def.id}`, day);
    const said = saidOf(ws, def, row.bind ?? null, outcome?.name);
    const source = { kind: 'event', id: def.id, title: def.title, held: false, summary: said, evenInParty: def.evenInParty === true, survived: [] };
    const evac = [];
    applyEffects(ws, def.effects?.on_end, source, day, bind, evac);
    applyEffects(ws, outcome?.effects?.on_end, source, day, bind, evac);
    runEvacuations(ws, evac);
    releaseHolds(ws, def.id, day * DAY);
    releaseDisplaced(ws, def.id, day * DAY);
    Object.assign(row, { state: def.kind === 'recurring' ? 'dormant' : 'ended', ended: day });
    delete row.realms;
    // An empty line stays in the journal (the host resolves the news entry by it) and is shown nowhere.
    ws.journal.push({ day, text: survivedText(said ? `Ended: ${said}` : '', source.survived), by: def.id, ended: true, reach: def.reach });
}

/** The event Lapses or is Replaced on `day` (terminal; on_end does not apply). */
export function closeEvent(ws, def, day, state, why = '') {
    const row = ws.events[def.id];
    Object.assign(row, { state, closed: day });
    if (state === 'lapsed') recordAnchor(ws.anchors, `lapsed:${def.id}`, day);
    releaseHolds(ws, def.id, day * DAY);
    releaseDisplaced(ws, def.id, day * DAY);
    // For the step's card (summary.js): the words a reader sees, and whether a lapsed event's branch never opened.
    const text = titleOf(def.title, def.id) || unfiredSummary(def.summary, def.id);
    ws.log.push({ kind: state, key: def.id, day, ...(why ? { why } : {}), ...(text ? { text } : {}), ...(state === 'lapsed' && neverOpened(ws, def, day) ? { unopened: true } : {}) });
}
