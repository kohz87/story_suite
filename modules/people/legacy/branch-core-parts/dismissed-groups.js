// User-dismissed NPC groups: normalizing, adding and clearing the groups a reader dismissed on purpose.
import { normalizeName } from '../core.js';
import { npcLabels } from './shared-npc-records.js';

export function normalizeUserDismissedGroups(value = []) {
    const groups = [];
    for (const raw of Array.isArray(value) ? value : []) {
        const labels = [...new Set((Array.isArray(raw?.labels) ? raw.labels : [raw?.primary || (typeof raw === 'string' ? raw : '')])
            .map(normalizeName)
            .filter(Boolean))];
        const ids = [...new Set([
            ...(Array.isArray(raw?.ids) ? raw.ids : []),
            raw?.npcId,
        ].map(value => String(value || '').trim()).filter(Boolean))];
        if (!labels.length && !ids.length) continue;
        const primary = normalizeName(raw?.primary) || labels[0] || '';
        groups.push({
            primary,
            labels,
            ids,
            createdAt: Number(raw?.createdAt || 0) || Date.now(),
        });
    }
    return groups;
}

export function addUserDismissedGroup(groups, npc, { historicalNpcIds = [] } = {}) {
    const labels = [...new Set(npcLabels(npc))];
    const ids = [...new Set([npc?.id, ...(Array.isArray(historicalNpcIds) ? historicalNpcIds : [])]
        .map(value => String(value || '').trim())
        .filter(Boolean))];
    if (!labels.length && !ids.length) return normalizeUserDismissedGroups(groups);
    const existing = normalizeUserDismissedGroups(groups);
    const mergedLabels = new Set(labels);
    const mergedIds = new Set(ids);
    const kept = [];
    for (const group of existing) {
        const idOverlap = group.ids.some(id => mergedIds.has(id));
        const legacyLabelOverlap = !group.ids.length && group.labels.some(label => mergedLabels.has(label));
        if (idOverlap || legacyLabelOverlap) {
            for (const label of group.labels) mergedLabels.add(label);
            for (const id of group.ids) mergedIds.add(id);
        } else kept.push(group);
    }
    kept.push({
        primary: normalizeName(npc?.name) || labels[0] || '',
        labels: [...mergedLabels],
        ids: [...mergedIds],
        createdAt: Date.now(),
    });
    return kept;
}

export function clearUserDismissedGroupsFor(groups, target, { modernByIdOnly = false } = {}) {
    const targetLabels = new Set(typeof target === 'string' ? [normalizeName(target)].filter(Boolean) : npcLabels(target));
    const targetIds = new Set(typeof target === 'string' ? [] : [target?.id, ...(Array.isArray(target?.historicalNpcIds) ? target.historicalNpcIds : [])]
        .map(value => String(value || '').trim()).filter(Boolean));
    const kept = [];
    const removedLabels = new Set();
    const removedIds = new Set();
    for (const group of normalizeUserDismissedGroups(groups)) {
        const matchesId = group.ids.some(id => targetIds.has(id));
        // Callers handling automatic/import identity reconciliation can require modern
        // tombstones to match by stable id. The default keeps the public/manual helper
        // backward-compatible for an explicit name-based resurrection action.
        const matchesLabel = (!modernByIdOnly || !group.ids.length) && group.labels.some(label => targetLabels.has(label));
        if (matchesId || matchesLabel) {
            for (const label of group.labels) removedLabels.add(label);
            for (const id of group.ids) removedIds.add(id);
        } else kept.push(group);
    }
    return { groups: kept, removedLabels: [...removedLabels], removedIds: [...removedIds] };
}
