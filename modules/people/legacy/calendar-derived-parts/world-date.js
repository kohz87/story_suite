/* Structured World State dates: finds date strings inside World State blocks and returns the latest. */

import { cleanText, normalizeCalendarConfig } from '../calendar-config.js';
import { escapeRegex, normalizeCalendarDate } from '../calendar-date.js';

function worldStateBodies(value) {
    const source = String(value || '');
    const bodies = [];
    for (const match of source.matchAll(/<World_State\b[^>]*>([\s\S]*?)<\/World_State>/gi)) bodies.push({ index: match.index, body: String(match[1] || '') });
    for (const details of source.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)) {
        const inner = String(details[1] || '');
        const summary = String(inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || '')
            .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (/\bworld\s*state\b/i.test(summary)) bodies.push({ index: details.index, body: inner });
    }
    return bodies.sort((a, b) => a.index - b.index).map(item => item.body);
}

function dateCandidatesInWorldStateBody(body, config = null) {
    const normalized = normalizeCalendarConfig(config, { requireCurrentDate: false });
    const text = String(body || '').replace(/<[^>]+>/g, ' ')
        .split(/\b(?:NPCs?\s+Present|Off[ -]Screen|Player\s+(?:Character|State)|Characters?)\s*[:|]/i)[0];
    const candidates = [];
    if (normalized.calendarValid) {
        const months = [...normalized.config.months].sort((a, b) => b.name.length - a.name.length);
        const monthAlternation = months.map(month => escapeRegex(month.name)).join('|');
        const era = normalized.config.era;
        const yearLabel = era
            ? `${escapeRegex(era)}\\s*-?\\d{1,7}`
            : `(?:[\\p{L}][\\p{L}\\p{N}_-]{0,15})?-?\\d{1,7}`;
        const regex = new RegExp(`(${yearLabel}\\s*,?\\s*(?:${monthAlternation})\\s+\\d{1,4})`, 'giu');
        for (const match of text.matchAll(regex)) candidates.push(match[1]);
    } else {
        for (const match of text.matchAll(/(-?\d{1,7}[-/]\d{1,2}[-/]\d{1,2})/g)) candidates.push(match[1]);
    }
    return candidates;
}

export function extractStructuredWorldDate(value, config = null) {
    let latest = null;
    for (const body of worldStateBodies(value)) {
        for (const raw of dateCandidatesInWorldStateBody(body, config)) {
            const date = normalizeCalendarDate(raw, config);
            if (!date || date.year === null) continue;
            latest = { raw: cleanText(raw, 180), date, source: 'world-state' };
        }
    }
    return latest;
}
