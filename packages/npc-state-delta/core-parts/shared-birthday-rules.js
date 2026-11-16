// Shared birthday-rule helpers the prompt builders use: calendar-projected options and the birthday rule inserts.
import * as mechanics from '../core-mechanics.js';
import { calendarPromptContext, getActiveCalendarConfig } from '../calendar.js';
import { birthdayCaptureRule, birthdayEvidenceInText, birthdayPromptRule } from '../birthday.js';
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

// (cleanup step 12, I-10) The one-pass rules always carry a short birthday rule (the reply can bring
// a birthday the text before it does not show), in the rules part, which holds nothing that changes
// from reply to reply; the current world date, which does, goes at the end with the context.
export function withCaptureBirthdayRule(prompt, options = {}) {
    const calendar = getActiveCalendarConfig();
    const source = String(prompt);
    const marker = 'Identity index (matching only):';
    const at = source.indexOf(marker);
    const rule = birthdayCaptureRule(calendar);
    const ruled = at > 0 ? `${source.slice(0, at).replace(/\n$/, '')}${rule}\n${source.slice(at)}` : `${source}${rule}`;
    const date = calendarPromptContext(calendar, calendarReference(options, calendar).date);
    return date ? `${ruled}\n${date}` : ruled;
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
