// Reading the extractor's answer: the lines the value wall and the scene checks let through, and what was refused.

import { OPS, extractBlock, parseChanges } from '../../../core/capture.js';
import { refusedWhy } from '../safety.js';
import { whereWhy } from '../where.js';

export const MAX_LINES = 24;

/**
 * The extractor's answer read with Story Block's change-line parser: { lines: raw[], dropped, refused } where
 * `lines` are the change lines of a kind in `kinds` (at most MAX_LINES) that the value wall lets through
 * (`allow`, safety.js allowedKinds; none given: the wall alone, which still refuses coin, items, XP, jobs and teachers), `refused` the ones it stopped ([{ line, why }]),
 * and `dropped` counts every line not kept (unknown kinds, lines that are not change lines, refused). A refused entry
 * with `problem: true` is one the reader is told of (an unknown name for a known place, a time with no clock time;
 * `check` = { places (where.js mapPlaces), here }); the wall's own refusals are not.
 */
export function parseExtractorAnswer(answer, kinds, allow = null, check = {}) {
    const known = new Set(kinds);
    const text = String(answer ?? '');
    const { lines, problems } = parseChanges(extractBlock(text) ?? text);
    const kept = [];
    const refused = [];
    let dropped = problems.length;
    for (const line of lines) {
        const why = refusedWhy(line, allow);
        if (why) {
            refused.push({ line: line.raw, why });
            dropped += 1;
        } else if (!OPS.includes(line.op) || !known.has(line.kind) || kept.length >= MAX_LINES) dropped += 1;
        else {
            // A place the map has under an invented name, or a time with no clock time (where.js): refused, and told as a Problem.
            const lost = whereWhy(line, check ?? {});
            if (lost) {
                refused.push({ line: line.raw, why: lost, problem: true });
                dropped += 1;
            } else kept.push(line.raw);
        }
    }
    return { lines: kept, dropped, refused };
}
