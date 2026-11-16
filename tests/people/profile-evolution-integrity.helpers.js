import { mergeScanResult } from '../../modules/people/core/core.js';

export const state = (...npcs) => ({ npcs, candidates: [], turn: 1 });
export const merge = (npc, update, context = '', extra = {}) => mergeScanResult(
    state(npc),
    { npcs: [], profileUpdates: [{ id: npc.id, ...update }] },
    { turn: 2, sourceMessageId: 2, developmentContext: context, ...extra },
);

export function profileRow(result, field) {
    return result.report?.profileDevelopment?.find(row => row.field === field) || null;
}
