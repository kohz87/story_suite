// Story Director v2, part **keypeople**: applies the story's `key` lines (`- key Name | died`).

import { cleanName, findPin, isRecord, keyOf } from '../domain.js';
import { calendarFrom } from '../time.js';
import { removePin, writeGone } from './removal.js';
import { asText, nowOf, query } from './shared-ctx.js';
import { lineText } from './shared-text.js';

// A word that says someone died (the line's text, its labels or their values).
const DEATH = /(?<![\p{L}\p{N}])(?:died|dies|dead|death|killed|slain|murdered|perished)(?![\p{L}\p{N}])/iu;

/** `apply(ctx, line)` for `key` lines: only `- key Name | died`. */
export function applyKeyLine(ctx, line) {
    if (line?.op !== '-') return ctx.fail('INVALID', `"${lineText(line)}": a key line is "- key Name | died" (the reader pins and unpins).`);
    const name = cleanName(line?.name);
    if (!keyOf(name)) return ctx.fail('INVALID', `"${lineText(line)}" names nobody.`);
    const labels = isRecord(line?.labels) ? line.labels : {};
    if (![asText(line?.text), ...Object.keys(labels), ...Object.values(labels).map(asText)].some(part => DEATH.test(part))) {
        return ctx.fail('REFUSED', `${name} leaves the key list only when they die (- key ${name} | died); the reader unpins anyone else.`);
    }
    const kp = ctx.draft('keypeople');
    const found = findPin(kp, name);
    if (!found) {
        // Anyone the story kills, not only a pinned person, but only on a reply captured under that rule (Story Block's `diedAny` mark, `ctx.carrier.rules`):
        // a reply recorded before it keeps the old answer when it is read again, so it never gains a death it did not have. Same `gone` record, no card line.
        if (!(Array.isArray(ctx.carrier?.rules) && ctx.carrier.rules.includes('diedAny'))) return ctx.fail('NOT_FOUND', `${name} is not a key person.`);
        const key = keyOf(name);
        writeGone(ctx, kp, key, name, 'died', nowOf(ctx));
        return { summary: `Died: ${name}`, narrate: false, data: { person: key, died: true } };
    }
    const summary = removePin(ctx, kp, found.key, found.pin, 'died', calendarFrom(query(ctx)), nowOf(ctx));
    return { summary: `Key person: ${summary}`, narrate: false, data: { person: found.key, removed: 'died' } };
}
