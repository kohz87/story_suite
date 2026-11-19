// Shared birthday-rule helpers the prompt builders use: calendar-projected options and the birthday rule inserts.
import * as mechanics from '../core-mechanics.js';
import { getActiveCalendarConfig } from '../../calendar/calendar.js';
import { birthdayEvidenceInText, birthdayPromptRule } from '../../birthday/birthday.js';
import { birthdayPromptSource, calendarReference, calendarNpcProjection } from '../core-birthday.js';

export function calendarPromptOptions(options = {}) {
    const next = { ...options };
    // (b5b r2-8) Names on one short line: a line break in a persona name cannot start a line of
    // the prompt (the one-pass rules go in-prompt). Ordinary names are unchanged.
    if (typeof options.userName === 'string') next.userName = mechanics.flatPromptName(options.userName, 'User');
    if (typeof options.charName === 'string') next.charName = mechanics.flatPromptName(options.charName, 'Character');
    const calendar = getActiveCalendarConfig();
    const reference = calendarReference(options, calendar);
    const referenceDate = reference.date;
    if (Array.isArray(options.existingNpcs)) next.existingNpcs = options.existingNpcs.map(npc => calendarNpcProjection(npc, referenceDate, reference.fallback));
    if (options.existingNpc) next.existingNpc = calendarNpcProjection(options.existingNpc, referenceDate, reference.fallback);
    if (options.targetNpc) next.targetNpc = calendarNpcProjection(options.targetNpc, referenceDate, reference.fallback);
    return next;
}

export function appendBirthdayRule(prompt, options = {}) {
    if (!birthdayEvidenceInText(birthdayPromptSource(options))) return String(prompt);
    const calendar = getActiveCalendarConfig();
    const referenceDate = calendarReference(options, calendar).date;
    return `${String(prompt)}${birthdayPromptRule(calendar, referenceDate)}`;
}

export function insertRefreshBirthdayRule(prompt, options = {}) {
    if (!birthdayEvidenceInText(birthdayPromptSource(options))) return String(prompt);
    const calendar = getActiveCalendarConfig();
    const referenceDate = calendarReference(options, calendar).date;
    const rule = birthdayPromptRule(calendar, referenceDate);
    const source = String(prompt);
    const anchor = 'Recent story window (EVIDENCE ONLY;';
    const index = source.indexOf(anchor);
    return index >= 0 ? `${source.slice(0, index)}${rule}\n${source.slice(index)}` : `${source}${rule}`;
}
