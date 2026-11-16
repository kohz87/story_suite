// Story Director: internal section composer and part-joining helpers for the note.

import { looksFinished } from '../../time/tracker/tracker.js';
import { ENCOUNTER_CUE, PACING, PACING_NO_CHANGES } from '../note-text.js';
import { notePart, part } from '../note-format.js';
import { addBeats, addLine, arrivalItem, awayPart, dueItem, encounterOf, recordItem, withFight, withReach } from '../note-items.js';
import { distancesLine, header, noWeekLine } from '../note-extra.js';

// Kind lines, in the order the note shows them.
const KIND_LINES = [
    ['agenda', 'Off-screen'],
    ['event', 'World'],
    ['hook', 'Hooks'],
    ['quest', 'Quests'],
    ['clock', 'Clocks'],
    ['beat', 'Beats'],
];

export function joinParts(parts) {
    return parts.map((entry, index) => (index ? entry.join : '') + entry.text).join('');
}

export function compose({ selection, calendar, due, arriving, relevant, secrets, fixes, instruction, asks, givenUp = [], taking = [], declining = [], abandoning = [], takingOn = [], turningDown = [], away = null, slipped = [], lapsed = [], distances = [], distanceFrom = '' }) {
    const parts = [part('Header', header(selection, calendar))];
    const noWeek = noWeekLine(selection, calendar);
    if (noWeek) parts.push(part('No weekdays', noWeek, ' '));
    // (0.9.12) A quest deadline goes out at a clock time the calendar sets, never "evening".
    const now = typeof selection?.now === 'number' && Number.isFinite(selection.now) ? selection.now : null;
    const clock = text => (text && typeof calendar?.withClock === 'function' ? calendar.withClock(text, { reference: now }) : text);
    // (0.9.19) What came due while the story skipped ahead is told once, as a recap, and not
    // again on Due now / Arriving.
    const awayDue = new Set(away?.due ?? []);
    const awayArriving = new Set(away?.arriving ?? []);
    const awayLine = awayPart(away, calendar, clock, instruction);
    if (awayLine) parts.push(part('While away', awayLine));
    const dueNow = due.filter(record => !awayDue.has(record));
    const arrivingNow = arriving.filter(record => !awayArriving.has(record));
    addLine(parts, 'Due now', dueNow.map(record => withReach(withFight(dueItem(record, clock), record), record)));
    addLine(parts, 'Arriving', arrivingNow.map(record => withFight(arrivalItem(record), record)));
    for (const [kind, label] of KIND_LINES) {
        const items = relevant.filter(entry => entry.record.kind === kind).map(entry => recordItem(entry.record, clock));
        if (kind === 'beat') addBeats(parts, selection?.arc, items);
        else addLine(parts, label, items);
    }
    // Secrets appear by key only, so the note never states them as facts.
    addLine(parts, 'Do not reveal', secrets.map(record => record.key), '; ');
    addLine(parts, 'Corrections', fixes);
    // (0.9.5) An open quest whose progress reads as over: the story is asked to close it, never
    // closed for it. Only where the model writes change lines.
    // (0.9.6) And one the latest exchange says {{user}} gave up: the story closes it as abandoned.
    // (0.9.15) Read from the reader's message only, as are an offer taken on or turned down:
    // the choices are theirs, the lines that record them the story's.
    const ended = instruction ? [...new Set([...due, ...relevant.map(entry => entry.record)].filter(looksFinished).map(record => record.key))] : [];
    const dropped = instruction ? [...new Set(givenUp ?? [])].filter(key => !ended.includes(key)) : [];
    const checks = [
        ended.length ? `the story may have finished ${ended.join(', ')}. If it has, close it with - Key — outcome; if not, leave it.` : '',
        dropped.length ? `{{user}} may be giving up ${dropped.join(', ')}. If they do, close it with - Key — abandoned; if not, leave it.` : '',
        instruction && taking?.length ? `{{user}} may be taking on ${[...new Set(taking)].join(', ')}. If they do, write + quest Key with its parts (no - line for the hook); if not, leave it an offer.` : '',
        instruction && declining?.length ? `{{user}} may be turning down ${[...new Set(declining)].join(', ')}. If they do, close it with - Key — declined; if not, leave it.` : '',
    ].filter(Boolean);
    if (checks.length) parts.push(part('Quest check', `Quest check: ${checks.join(' Also: ')}`));
    // (0.9.15) The reader gave a quest up with the Abandon flag: told behind the scenes, like a
    // fight's hand-off. The reply records it whether or not the story writes the line.
    const giving = [...new Set(abandoning ?? [])];
    if (giving.length) {
        parts.push(part('Abandoned', `Abandoned: {{user}} gives up ${giving.join(', ')}. Show it in this reply${instruction ? ', and close each with - Key — abandoned' : ''}.`));
    }
    // (0.9.33) Offers the reader took on or turned down with the Quests tab's buttons, told the
    // same way: the choice is made, the reply shows it in the story's own voice.
    const takes = [...new Set(takingOn ?? [])];
    if (takes.length) {
        parts.push(part('Taken on', `Taken on: {{user}} takes on ${takes.join(', ')}. Show it in this reply as part of the scene, in the story's own voice${instruction ? ', and write ~ Key — accepted for each' : ''}.`));
    }
    const refusals = [...new Set(turningDown ?? [])];
    if (refusals.length) {
        parts.push(part('Turned down', `Turned down: {{user}} turns down ${refusals.join(', ')}. Show it in this reply${instruction ? ', and close each with - Key — declined' : ''}.`));
    }
    // (0.9.19) What time closed in the latest reply, told once, in the note right after it: the
    // story need not stage a beat that slipped or a job that went to someone else, only not
    // contradict it.
    const slips = lapseItems(slipped, entry => `${entry.key}${entry.on ? ` (${notePart(entry.on, 'on')})` : ''}`);
    if (slips.length) {
        const one = slips.length === 1;
        parts.push(part('Slipped', `Slipped: ${slips.join(', ')} — ${one ? 'it' : 'they'} happened off-screen or not at all; mention ${one ? 'it' : 'them'} only where ${one ? 'it fits' : 'they fit'}.`));
    }
    const lapses = lapseItems(lapsed, entry => `${entry.key}${giverName(entry.giver) ? ` (${giverName(entry.giver)}'s offer)` : ''}`);
    if (lapses.length) {
        const givers = [...new Set(lapsed.map(entry => giverName(entry?.giver)).filter(Boolean))];
        const who = lapses.length === 1 ? givers[0] || '' : '';
        const after = who ? `${who} may mention it` : lapses.length === 1 ? 'it may come up in passing' : 'whoever offered them may mention it';
        parts.push(part('Lapsed', `Lapsed: ${lapses.join(', ')} went to someone else; ${after}.`));
    }
    const distanceLine = distancesLine(distances, distanceFrom);
    if (distanceLine) parts.push(part('Distances', distanceLine));
    if (scheduled(selection, due, arriving, relevant)) {
        parts.push(part('Pacing', instruction ? PACING : PACING_NO_CHANGES));
        // A fight on the While away line already happened off-screen: no first blow to stop at.
        if ([...dueNow, ...arrivingNow].some(encounterOf)) parts.push(part('Encounter cue', ENCOUNTER_CUE, ' '));
    }
    // No instruction when a capture call writes the changes instead of the model.
    return [...parts, ...asks];
}

// One item per record, once each by key.
function lapseItems(entries, item) {
    const seen = new Set();
    return (entries ?? []).filter(entry => {
        const key = String(entry?.key ?? '').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(item);
}

// A giver by name only: "Danique, the rat-catcher's widow" is Danique.
function giverName(giver) {
    return notePart(String(giver ?? '').split(/[,(;—–]/)[0], 'giver');
}

// Anything with a date or a plan behind it: an arc, something due or arriving, a beat or a
// clock, or a record with a next step.
function scheduled(selection, due, arriving, relevant) {
    if (selection?.arc || due.length || arriving.length) return true;
    return relevant.some(({ record }) => record.kind === 'beat' || record.kind === 'clock' || Boolean(record.fields?.then)
        || (record.kind === 'quest' && Boolean(record.fields?.due)));
}
