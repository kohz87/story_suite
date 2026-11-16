// Gear form: the point-moving stat boxes of the Edit of an unbound piece that is not a gear-form piece.

import { STRINGS } from '../../../../core/strings.js';
import { GEAR } from '../../../../packages/story-block/src/v2/domains/gear.js';
import { statOptions } from './shared-options.js';

const F = STRINGS.inventory.gear.form;
const E = STRINGS.editMessages;

/**
 * The stat boxes of any unbound piece with points to give (`row.repoint`: { budget, stats }), for the item Edit whose form is not the gear form: two stat
 * choices with their points, a hint ("Move this piece's 3 points between stats") and a live "N of M points placed" line. `read()` answers null when nothing
 * moved, `{ error }` when the points do not add up to the piece's total (the command refuses the same), else `{ stats }`. The total never changes.
 */
export function repointControls(doc, p, h) {
    const rp = p?.gear?.row?.repoint;
    if (!rp || !Number.isSafeInteger(rp.budget) || rp.budget < 1 || (typeof p.gear.bound === 'string' && p.gear.bound)) return null;
    const unit = rp.budget === 1 ? 'point' : 'points';
    const listed = Object.entries(rp.stats && typeof rp.stats === 'object' ? rp.stats : {}).slice(0, GEAR.maxStats);
    const rows = [], boxes = [];
    for (const at of [1, 2]) {
        const select = h(doc, 'select', 'ss-select'), points = h(doc, 'input', 'ss-input');
        for (const option of statOptions()) { const node = h(doc, 'option', '', option.label); node.value = option.value; select.appendChild(node); }
        select.value = listed[at - 1]?.[0] ?? '';
        select.setAttribute('aria-label', F.repointTitle.replace('{at}', String(at)));
        points.setAttribute('aria-label', `${F.amount} ${at}`);
        for (const [name, value] of [['type', 'number'], ['min', '1'], ['max', String(rp.budget)], ['step', '1']]) points.setAttribute(name, value);
        points.value = String(listed[at - 1]?.[1] ?? '');
        const row = h(doc, 'span', 'ss-w-editable-item-pair');
        row.append(select, points);
        rows.push(row);
        boxes.push([select, points]);
    }
    const hint = h(doc, 'p', 'ss-w-editable-item-hint ss-w-editable-repoint-hint', F.repointHint.replace('{n}', String(rp.budget)).replace('{points}', unit));
    const read = () => {
        const stats = {};
        for (const [select, points] of boxes) {
            if (!select.value) continue;
            const n = Number(String(points.value).trim());
            if (!Number.isSafeInteger(n) || n < 1) return { error: E.kitStats.replace('{max}', String(GEAR.maxStats)) };
            stats[select.value] = (stats[select.value] ?? 0) + n;
        }
        const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
        if (total !== rp.budget) return { error: E.repointTotal.replace('{max}', String(rp.budget)).replace('{points}', unit).replace('{total}', String(total)) };
        const same = JSON.stringify(Object.entries(stats).sort()) === JSON.stringify(Object.entries(rp.stats ?? {}).sort());
        return same ? null : { stats };
    };
    const line = h(doc, 'p', 'ss-w-editable-item-hint ss-w-editable-repoint-line');
    const live = () => { line.textContent = F.repointLine.replace('{n}', String(boxes.reduce((sum, [select, points]) => sum + (select.value && Number(points.value) > 0 ? Number(points.value) : 0), 0))).replace('{max}', String(rp.budget)).replace('{points}', unit); };
    for (const [select, points] of boxes) for (const node of [select, points]) { node.addEventListener?.('input', live); node.addEventListener?.('change', live); }
    live();
    return { nodes: [hint, ...rows, line], read };
}
