// Story Director v2, part screens: the World pulse card's view (`pulse.view`) and the header Quiet scene toggle's state (`pulse.quiet`).

import { slotValue } from '../../../../../modules/rpg/slot.js';
import { hostHasHeaderSlot } from '../../module/shared.js';
import { FEATURE as PULSE_FEATURE, modeOf, resultsOf } from '../../../../../modules/world/pulse/effects.js';

export { PULSE_FEATURE };

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const EFFECTS = { 'chronicle.rumor': 'rumour recorded', 'cast.meet': 'someone met', 'director.pulse.arrive': 'arrival set', 'director.pulse.shift': 'agenda step moved' };
const SKIPS = { fight: 'fight under way', rest: 'resting', jump: 'time jumped ahead', quiet: 'quiet scene', clock: 'story clock not set' };
const label = kind => { const words = String(kind ?? '').toLowerCase().replace(/_/g, ' '); return words.charAt(0).toUpperCase() + words.slice(1); };

// One stored result as a row: the die ('—' for a skipped reply), its kind, its line and what it changed.
function pulseRow(entry) {
    const skipped = entry.kind === 'SKIP';
    return {
        at: entry.at, die: skipped ? '—' : String(entry.d20 ?? '—'), skipped, label: skipped ? 'Skipped' : label(entry.kind),
        text: skipped ? (SKIPS[entry.skipped] ?? 'skipped') : (entry.text || (entry.kind === 'CALM' ? 'nothing happened' : '')),
        effect: EFFECTS[entry.effect?.type] ?? '',
    };
}

/**
 * `pulse.view` → the Director screen's World pulse card (feature `story-director.pulse`; null while it is off): `{ mode, quiet, card, localSwitch, show, now, rollAt, table, recent, count }`.
 * `localSwitch`: the Quiet scene switch is drawn here (the card is on and the host's header has no slot for it).
 * `mode`: the setting (off hides the card and the switch); `quiet`: the chat's quiet-scene flag; `show`: the setting "Show the roll under replies" (the
 * status card's row, for the reply at `now.at`); `now`: the latest result as a row (null before any); `rollAt`: that reply's place when `show` (the status card draws its row only under it), else -1; `table`: "standard · 3 away"; `recent`: the
 * the earlier stored results (at most 5; the newest is `now`), newest first. Read on the state it is given, so an older reply's card shows its own.
 */
export function pulseView(state, _args, _tools, settings = null) {
    const values = (typeof settings === 'function' ? settings() : settings) ?? {};
    const mode = modeOf({ mode: values['pulse.mode'] ?? values.mode });
    const director = state?.domains?.director;
    const rows = resultsOf(director).map(pulseRow).reverse();
    const last = resultsOf(director).at(-1);
    const agendas = Object.values(isRecord(director?.threads) ? director.threads : {}).filter(thread => thread?.kind === 'agenda' && thread.status === 'active').length;
    const away = agendas + Object.keys(state?.domains?.keypeople?.away ?? {}).length
        + Object.values(isRecord(state?.domains?.cast?.people) ? state.domains.cast.people : {}).filter(person => isRecord(person) && person.alive !== false && !person.met).length;
    const card = mode !== 'off';
    const show = card && (values['pulse.showUnderReply'] ?? values.showUnderReply) === true;
    return {
        mode, quiet: slotValue(director?.pulseQuiet)?.on === true, card, localSwitch: card && !hostHasHeaderSlot(), show,
        now: rows[0] ?? null, rollAt: show && rows.length ? rows[0].at : -1, recent: card ? rows.slice(1) : [], count: card ? Math.max(0, rows.length - 1) : 0,
        table: last?.table ? `${last.table === 'duo' ? 'duo' : 'standard'} · ${away} away` : '',
    };
}

/** `pulse.quiet` → the header toggle's state (feature `story-director.pulse`): `{ on }` for the chat's quiet-scene flag, null while the World pulse is off (no pill). */
export function pulseQuiet(state, args, tools, settings = null) {
    const view = pulseView(state, args, tools, settings);
    return view.card ? { on: view.quiet } : null;
}
