/* NPC State Delta deriving apparent age from an appearance and projecting an NPC onto the calendar. */
import { effectiveChronologicalAge, normalizeNpcBirthday } from '../../birthday/birthday.js';
import { getActiveCalendarConfig } from '../../legacy/calendar.js';
import * as mechanics from '../core-mechanics.js';
import { isTerminalNpcDeath } from '../terminal-lifecycle.js';

function explicitVisualAgeCueFromAppearance(value) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '';

    const exactYears = text.match(/\b(\d{1,3})[-\s]+years?[-\s]+old\b/i);
    if (exactYears) return exactYears[1];

    const decadeWords = 'twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties';
    const band = text.match(new RegExp(String.raw`\b(?:in\s+(?:his|her|their)\s+)?((?:early|mid|middle|late)\s+(?:[1-9]\d?s|${decadeWords}))\b`, 'i'));
    if (band) return band[1];

    const broadDecade = text.match(new RegExp(String.raw`\b(?:in\s+(?:his|her|their)\s+|about\s+|around\s+|approximately\s+)?(${decadeWords})\b`, 'i'));
    if (broadDecade) return broadDecade[1];

    const looksNumeric = text.match(/\b(?:looks?|appears?)(?:\s+to\s+be)?\s+(?:about\s+|around\s+|approximately\s+)?(\d{1,3}(?:\s*(?:-|to)\s*\d{1,3})?)(?:\s*(?:years?|yrs?)\s*(?:old)?)?\b/i);
    if (looksNumeric) return looksNumeric[1];

    const descriptor = text.match(/\b(young adult|middle[- ]aged|older adult|newborn|infant|toddler|pre[- ]?teen|adolescent|teenager|teen|elderly|senior|child|young)\b/i);
    return descriptor ? descriptor[1] : '';
}

export function withAppearanceDerivedApparentAge(npc = {}, sourceAppearance = '') {
    if (!npc || typeof npc !== 'object' || String(npc.apparentAge ?? '').trim()) return npc;
    const cue = explicitVisualAgeCueFromAppearance(sourceAppearance || npc.appearance);
    if (!cue) return npc;
    const seed = npc.id || npc.name || npc.species || '';
    const apparentAge = mechanics.normalizeApparentAge(cue, seed);
    return apparentAge ? { ...npc, apparentAge } : npc;
}

export function calendarNpcProjection(raw = null, referenceDate = null, fallback = true) {
    if (!raw || typeof raw !== 'object') return raw;
    const calendar = getActiveCalendarConfig();
    const npc = normalizeNpcBirthday(raw, calendar, referenceDate);
    const acceptedAge = String(raw.age ?? '').trim();
    const protectedAge = isTerminalNpcDeath(raw) || (Array.isArray(raw.manualProfileFields) && raw.manualProfileFields.includes('age'));
    const computedAge = referenceDate && !protectedAge ? effectiveChronologicalAge(npc, calendar, referenceDate) : acceptedAge;
    const staleFallback = fallback && /^\d+$/.test(acceptedAge) && /^\d+$/.test(computedAge) && Number(computedAge) < Number(acceptedAge);
    return withAppearanceDerivedApparentAge({ ...npc, age: staleFallback ? acceptedAge : computedAge }, raw.appearance || npc.appearance);
}
