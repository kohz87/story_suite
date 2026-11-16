// Birthday prompt rules and the cheap text test for birthday evidence.
import {
    calendarPromptContext,
    normalizeCalendarConfig,
} from '../../legacy/calendar.js';
import { activeOrProvided } from './shared-config.js';

export function birthdayEvidenceInText(value) {
    return /\b(birth(?:day|date)?|name\s*day|nameday|born|hatched|turn(?:s|ed|ing)?\s+\d{1,3}|date\s+of\s+birth)\b/i.test(String(value || ''));
}

export function birthdayPromptRule(config = undefined, referenceDate = null) {
    const calendar = activeOrProvided(config);
    const normalized = normalizeCalendarConfig(calendar, { requireCurrentDate: false });
    const context = calendarPromptContext(calendar, referenceDate);
    if (!normalized.calendarValid) {
        return `\nBIRTHDAY: Only grounded birthday/birth-date evidence may return birthDate:"MM-DD|YYYY-MM-DD" with birthDateState:"establish|correct" and a brief birthDateReason; omit otherwise. Never derive from apparentAge, species, or lifespan and never invent a random date; Delta generates the fallback locally.`;
    }
    const contextText = context ? `${context} ` : '';
    return `\nBIRTHDAY: ${contextText}Preserve fantasy era/month names exactly as stated in grounded evidence. Only grounded birthday/birth-date evidence may return birthDate:{"era":"${normalized.config.era || ''}","year":number|null,"month":"month name","day":number} with birthDateState:"establish|correct" and a brief birthDateReason; omit otherwise. Never invent a missing year or birthday. Never derive chronology from apparentAge, species, or lifespan; Delta performs calendar arithmetic locally.`;
}

export const BIRTHDAY_PROMPT_RULE = birthdayPromptRule(null);

// (cleanup step 12, I-10) The one-pass rules' short form: the same contract, nothing that changes
// from reply to reply (the current date is sent with the context instead).
export function birthdayCaptureRule(config = undefined) {
    const normalized = normalizeCalendarConfig(activeOrProvided(config), { requireCurrentDate: false });
    const shape = normalized.calendarValid
        ? `{"era":"${normalized.config.era || ''}","year":number|null,"month":"month name","day":number}`
        : '"MM-DD|YYYY-MM-DD"';
    const names = normalized.calendarValid ? ' Keep stated era/month names.' : '';
    return `\nBIRTHDAY: grounded evidence only: birthDate:${shape}+birthDateState:"establish|correct"+birthDateReason; never invented or derived from apparentAge/species/lifespan.${names}`;
}
