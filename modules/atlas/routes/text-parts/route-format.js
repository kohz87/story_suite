// Formatting full routes, single legs, and travel durations for display and line grammar.

import { num } from '../util.js';
import { normalizeMode } from '../pack.js';

/** `Shorn → Varnhold Watch 35 B → … = 220 km · ride 35/day · 7 active days + 1 rest = 8 days · arrive …` */
export function formatRoute(plan, calendar = null) {
    if (!plan) return '';
    const path = [plan.from, ...plan.hops.map(hop => `${hop.to} ${num(hop.km)} ${hop.code}${hop.mode ? ` (${hop.mode})` : ''}`)].join(' → ');
    const parts = [`${path} = ${num(plan.km)} km`];
    const rates = [...new Set(plan.hops.filter(hop => !hop.mode).map(hop => hop.rate))].sort((a, b) => a - b);
    if (rates.length) {
        const rate = rates.length === 1 ? num(rates[0]) : `${num(rates[0])}–${num(rates[rates.length - 1])}`;
        parts.push(`${plan.mode} ${rate}${plan.unit === 'hour' ? ' km/h' : '/day'}`);
    }
    if (plan.unit === 'hour') {
        if (plan.boardHours > 0) parts.push(`${durationText(plan.boardHours / 24, 'hour')} boarding`);
        parts.push(plan.stops > 0
            ? `${durationText(plan.activeDays, 'hour')} on the way + ${plan.stops} ${plan.stops === 1 ? 'night' : 'nights'} = ${durationText(plan.days, 'hour')}`
            : durationText(plan.days, 'hour'));
    } else {
        parts.push(plan.restDays > 0
            ? `${num(plan.activeDays)} active ${dayWord(plan.activeDays)} + ${num(plan.restDays)} rest = ${num(plan.days)} ${dayWord(plan.days)}`
            : `${num(plan.days)} ${dayWord(plan.days)}`);
    }
    if (plan.arrive !== null && plan.arrive !== undefined && calendar) {
        parts.push(`arrive ${calendar.format(plan.arrive, { era: false })}`);
    }
    return parts.join(' · ');
}

/**
 * One leg in the line grammar: `Shorn → Varnhold Watch 35 B, courier 70/day → 0.5 | arrive: …`;
 * with `unit: 'hour'` (a modern pack) `Home → Office 25 RD, car 60/h → 0.5 h`.
 */
export function formatLeg(hop, { mode = null, rate = null, days = null, arrive = null, calendar = null, unit = 'day' } = {}) {
    if (!hop) return '';
    const m = normalizeMode(mode ?? hop.mode) ?? mode ?? null;
    const r = rate ?? hop.rate ?? null;
    const d = days ?? hop.days ?? null;
    let text = `${hop.from} → ${hop.to}`;
    if (hop.km !== null && hop.km !== undefined) text += ` ${num(hop.km)}`;
    if (hop.code) text += ` ${hop.code}`;
    const hourly = unit === 'hour';
    const working = [m, r !== null ? `${num(r)}/${hourly ? 'h' : 'day'}` : null].filter(Boolean).join(' ');
    if (working) text += `, ${working}`;
    if (d !== null) text += hourly ? ` → ${num(d * 24)} h` : ` → ${num(d)}`;
    const when = typeof arrive === 'number' ? (calendar ? calendar.format(arrive, { era: false }) : null) : arrive;
    if (when) text += ` | arrive: ${when}`;
    return text;
}

/** "1.5 days"; for a modern pack "45 min", "2 h 15 min", "1 day 3 h". */
export function durationText(days, unit = 'day') {
    if (unit !== 'hour') return `${num(days)} ${dayWord(days)}`;
    const minutes = Math.round((days ?? 0) * 1440);
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    const parts = [d ? `${d} ${d === 1 ? 'day' : 'days'}` : '', h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean);
    return parts.join(' ') || '0 min';
}

function dayWord(days) {
    return days <= 1 ? 'day' : 'days';
}
