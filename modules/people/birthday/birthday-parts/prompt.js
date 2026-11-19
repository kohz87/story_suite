// Birthday prompt rules and the cheap text test for birthday evidence.
import {
    calendarPromptContext,
    normalizeCalendarConfig,
} from '../../calendar/calendar.js';
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
