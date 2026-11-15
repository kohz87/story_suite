// The hero card's text lines: the class · title line and the level badge.

import { short } from './shared-short.js';

/** The line under the name: `line`, else "Class · Title" from the parts that are given (the level is the portrait's badge). */
export function heroLine(p) {
    if (p.line) return short(p.line, 120);
    return [short(p.className, 40), short(p.title, 40)].filter(Boolean).join(' · ');
}

/**
 * The level badge: { number, label }. The label is the whole level for screen readers ("Lv 12"; a bare "12" → "Lv 12"),
 * the number the badge's short text: the level's last run of digits ("Level of the Ancients 73" → 73), else the level,
 * cut to 8. The level is taken whole (up to 60) before either is made, so a long one keeps its number.
 */
export function heroLevel(p) {
    const level = short(p.level, 60);
    if (!level) return { number: '', label: '' };
    const digits = level.match(/(\d+)\D*$/);
    const label = /^\d+$/.test(level) ? `Lv ${level}` : level;
    return { number: short(digits ? digits[1] : level, 8), label };
}
