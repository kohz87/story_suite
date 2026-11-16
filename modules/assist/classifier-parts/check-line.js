// Checking a check line: the difficulty and the line cut to the shape the check kind reads.

import { clip } from '../common.js';
import { CHECK_KIND } from './names.js';

const SKILL = /^\p{L}[\p{L}'’ -]{0,39}$/u;
const WORD_DC = ['easy', 'normal', 'hard'];

/** The difficulty as the check grammar takes it: 'easy' | 'normal' | 'hard' | '<1-40>', or null. */
export function normalizeDc(value) {
    const text = String(value ?? '').trim().toLowerCase().replace(/\.$/, '');
    if (WORD_DC.includes(text)) return text;
    if (/^\d{1,2}$/.test(text)) {
        const number = Number(text);
        return number >= 1 && number <= 40 ? String(number) : null;
    }
    return null;
}

/**
 * A check line in the shape capture hands a module ({ op, kind, name, text, labels, raw }), checked
 * and cut to size, or null. Only the labels the check kind reads are kept (dc, stat, who).
 */
export function checkLine(line) {
    if (!line || typeof line !== 'object' || line.op !== '?' || String(line.kind ?? '').toLowerCase() !== CHECK_KIND) return null;
    const name = String(line.name ?? '').trim().replace(/\s+/g, ' ');
    if (!SKILL.test(name) || name.split(' ').length > 3) return null;
    const dc = normalizeDc(line.labels?.dc);
    if (!dc) return null;
    const text = clip(line.text ?? '', 160);
    const labels = { dc };
    for (const key of ['stat', 'who']) {
        const value = clip(line.labels?.[key] ?? '', 40);
        if (value) labels[key] = value;
    }
    const extra = Object.entries(labels).filter(([key]) => key !== 'dc').map(([key, value]) => ` | ${key}: ${value}`).join('');
    const raw = `? ${CHECK_KIND} ${name}${text ? ` — ${text}` : ''} | dc: ${dc}${extra}`;
    return { op: '?', kind: CHECK_KIND, name, text, labels, raw };
}
