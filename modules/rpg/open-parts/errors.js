// Checks that an `open` list is one a plan may carry.
import { CLASS_NAMES, FOE_SLOTS } from '../names.js';
import { FOE_LEVEL } from '../foes.js';
import { OPEN_MAX_NAME, OPEN_RECORD_MAX_COUNT, RANK_MAX } from './limits.js';

/** Whether `open` is a list the plan may carry (plan.js validatePlan asks). */
export function openErrors(open) {
    if (!Array.isArray(open)) return ['open must be a list.'];
    const errors = [];
    if (open.length > FOE_SLOTS) errors.push(`open may hold at most ${FOE_SLOTS} entries.`);
    open.forEach((entry, n) => {
        const where = `open ${n + 1}`;
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(`${where} must be an object.`); return; }
        for (const key of Object.keys(entry)) if (!['name', 'count', 'class', 'level', 'rank', 'from', 'to'].includes(key)) errors.push(`${where} has "${key}", which a plan does not use.`);
        if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > OPEN_MAX_NAME) errors.push(`${where} needs a name (text, at most ${OPEN_MAX_NAME} characters).`);
        if (!Number.isInteger(entry.count) || entry.count < 1 || entry.count > OPEN_RECORD_MAX_COUNT) errors.push(`${where} count must be a whole number from 1 to ${OPEN_RECORD_MAX_COUNT}.`);
        // (A plan from before the Levels rules has a class; one from after has a level, a rank with its band, or neither.)
        if (entry.class !== undefined) {
            if (!Number.isInteger(entry.class) || entry.class < 1 || entry.class > CLASS_NAMES.length) errors.push(`${where} class must be a whole number from 1 to ${CLASS_NAMES.length}.`);
            if (['level', 'rank', 'from', 'to'].some(key => entry[key] !== undefined)) errors.push(`${where} has a class and a level, which it cannot have together.`);
        }
        const whole = value => Number.isInteger(value) && value >= FOE_LEVEL.min && value <= FOE_LEVEL.max;
        if (entry.level !== undefined && !whole(entry.level)) errors.push(`${where} level must be a whole number from ${FOE_LEVEL.min} to ${FOE_LEVEL.max}.`);
        if ((entry.from !== undefined || entry.to !== undefined || entry.rank !== undefined) && !(typeof entry.rank === 'string' && entry.rank.length > 0 && entry.rank.length <= RANK_MAX && whole(entry.from) && whole(entry.to) && entry.from <= entry.to)) errors.push(`${where} needs a rank (at most ${RANK_MAX} characters) with the band it names: from and to, 1 to ${FOE_LEVEL.max}, from first.`);
        if (entry.level !== undefined && entry.from !== undefined) errors.push(`${where} has a level and a rank band, which it cannot have together.`);
    });
    return errors;
}
