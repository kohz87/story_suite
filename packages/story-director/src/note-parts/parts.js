// Story Director: note section assembly, budget trimming and tail extraction.

import { awayIn, estimateTokens } from '../relevance.js';
import { CHANGE_INSTRUCTION, NPC_PLANS_ONLY } from '../note-text.js';
import { part } from '../note-format.js';
import { compose, joinParts } from './compose.js';
import { STATIC_LABELS } from './static.js';

export function buildNote(selection, options = {}) {
    return joinParts(noteParts(selection, options));
}

/** The note's part for this reply alone: noteParts without the fixed ones ('' when nothing is left). */
export function tailNote(parts) {
    const kept = (parts ?? []).filter(entry => !STATIC_LABELS.includes(entry.label));
    // The encounter cue used to follow Pacing on its line; it starts its own now.
    return joinParts(kept.map(entry => (entry.label === 'Encounter cue' ? { ...entry, join: '\n' } : entry)));
}

/**
 * The note in its sections, `[{ label, text, join }]`, in order; `join` ('\n' or ' ') goes
 * before `text`, so joining them gives buildNote exactly. Labels: Header, No weekdays, While away, Due now,
 * Arriving, Off-screen, World, Hooks, Quests, Clocks, Beats (headed by the current arc), Do not reveal,
 * Corrections, Quest check, Abandoned, Slipped, Lapsed, Distances, Pacing, Encounter cue, Change
 * instruction, NPC plans only.
 *
 * `offscreenInBlock` (0.9.3): the scene block's Off-Screen section already carries every active
 * agenda (Story Director mirrors it there and keeps the timeline), so the note leaves its
 * Off-screen line out; an agenda due or arriving is still on Due now / Arriving.
 *
 * `previousTime` (0.9.19): the story time before the latest reply. When the selection's now is
 * at least AWAY_GAP_MINUTES past it, what came due or arrived in between goes on one While away
 * line (relevance.js awayIn) and not on Due now / Arriving.
 * `slipped` and `lapsed` (0.9.19): what the latest reply closed because time ran past it, as
 * `[{ key, on, giver }]` (lapses.lapsesIn): beats that slipped, offers that lapsed.
 */
export function noteParts(selection, {
    calendar,
    budgetTokens = 1000,
    corrections = [],
    instruction = CHANGE_INSTRUCTION,
    npcPlansOnly = false,
    offscreenInBlock = false,
    givenUp = [],
    taking = [],
    declining = [],
    abandoning = [],
    takingOn = [],
    turningDown = [],
    previousTime = null,
    slipped = [],
    lapsed = [],
    distances = [],
    distanceFrom = '',
} = {}) {
    // Only where the model writes change lines: with none asked for, there is nothing to steer.
    const asks = [];
    if (instruction) asks.push(part('Change instruction', instruction));
    if (npcPlansOnly && instruction) asks.push(part('NPC plans only', NPC_PLANS_ONLY));
    const due = selection?.due ?? [];
    const arriving = selection?.arriving ?? [];
    const relevant = (selection?.relevant ?? []).filter(entry => !(offscreenInBlock && entry?.record?.kind === 'agenda'));
    const secrets = selection?.secrets ?? [];
    const fixes = (corrections ?? []).map(item => typeof item === 'string' ? item : item?.message ?? '').filter(Boolean);
    const away = awayIn(selection, { calendar, from: previousTime });

    // The model still needs to know how to add records when there are none yet.
    const choices = (instruction && (givenUp?.length || taking?.length || declining?.length)) || abandoning?.length || takingOn?.length || turningDown?.length || slipped?.length || lapsed?.length || (distances?.length && distanceFrom);
    if (!due.length && !arriving.length && !relevant.length && !secrets.length && !fixes.length && !selection?.arc && !choices) {
        return asks;
    }

    // relevant is sorted highest priority first, so the cheapest cut is from the end.
    let kept = relevant.length;
    const build = () => compose({ selection, calendar, due, arriving, relevant: relevant.slice(0, kept), secrets, fixes, instruction, asks, givenUp, taking, declining, abandoning, takingOn, turningDown, away, slipped, lapsed, distances, distanceFrom });
    let parts = build();
    while (kept > 0 && estimateTokens(joinParts(parts)) > budgetTokens) {
        kept -= 1;
        parts = build();
    }
    return parts;
}
