// Story Director v2, part screens: the Director screen's plan cards (`director.plan`) and an off-screen agenda's step progress.

import { dateOf } from '../../../../../modules/atlas/relevance.js';
import { threadsOn } from '../../../../../modules/time/tracker/threads.js';
import { calendarFrom } from './calendar.js';
import { behindThread, behindView } from './behind-view.js';
import { problemsList } from './problems.js';
import { ask, queryFrom } from './shared-ask.js';
import { threadsOf } from './shared-threads.js';
import { isRecord, text } from './shared-words.js';

/**
 * An off-screen agenda's progress as its card draws it (the pulse's optional fields, written by code): `{ at, of, line, place, arriving }`, or
 * null when it has none. `line`: "step 3 of 4 · since Goldwane 19"; `arriving`: its `arrive` date is within the next hour (an ENTER_CHECK).
 */
export function agendaSteps(fields, { calendar = null, now = null, query = null } = {}) {
    const [at, of, since] = [fields?.stepAt, fields?.stepOf, fields?.stepSince].map(Number);
    const place = text(fields?.where) ? text(ask(query, 'atlas.line', { name: fields.where }, '')) || text(fields.where) : '';
    const arrive = calendar && Number.isSafeInteger(now) ? dateOf({ fields }, 'arrive', { calendar, reference: now }) : null;
    const arriving = Boolean(arrive?.hasTime) && arrive.abs >= now && arrive.abs - now <= 60;
    const steps = at > 0 ? `step ${at}${of > 0 ? ` of ${of}` : ''}` : '';
    const when = Number.isSafeInteger(since) && calendar ? `since ${calendar.format(since, { time: false, era: false })}` : '';
    if (!steps && !place && !arriving) return null;
    return { at: at > 0 ? at : 0, of: of > 0 ? of : 0, line: [steps, when].filter(Boolean).join(' · '), place, arriving };
}

/**
 * `director.plan` → `{ hooks, clocks, beats, agendas, secrets, problems, any }`: what the Director screen's cards show (the plan; spoilers):
 * the open hooks with their Next, and, while the feature `story-director.threads` is on, the open clocks (with Due), beats, agendas (off-screen) and
 * secrets (name only), then every problem, newest first (the ones about the visible threads, then those behind the scenes). Each thread is
 * `{ id, key, summary, fields }` as `director.behind` gives it.
 */
export function planView(state, args, tools, { settings = null } = {}) {
    const query = queryFrom(tools);
    const hooks = threadsOf(state, query, { kind: 'hook', status: 'active' }).filter(thread => isRecord(thread) && !thread.ended).map(behindThread);
    const behind = threadsOn(tools) ? behindView(state, args, tools) : { kinds: [], problems: [] };
    const open = kind => behind.kinds.find(group => group.kind === kind)?.open ?? [];
    const calendar = calendarFrom(settings, query);
    const now = state?.domains?.director?.time?.minutes;
    const agendas = open('agenda').map(agenda => ({ ...agenda, steps: agendaSteps(agenda.fields, { calendar, now, query }) }));
    // Newest first (the lists are kept oldest first), so a card's first rows are the latest reply's problems.
    const problems = [...problemsList(state, { behind: false }, tools).reverse(), ...[...behind.problems].reverse()];
    const view = { hooks, clocks: open('clock'), beats: open('beat'), agendas, secrets: open('secret'), problems };
    return { ...view, any: Object.values(view).some(list => list.length > 0) };
}
