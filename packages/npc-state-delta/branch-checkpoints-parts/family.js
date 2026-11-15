// The branch family id kept on the branch state.

import { branchHash } from '../branch-lineage.js';

export function ensureBranchFamilyId(state, seed = '') {
    if (!state || typeof state !== 'object') return '';
    const existing = String(state.branchFamilyId || '').trim();
    if (existing) return existing;
    let id = '';
    try { id = globalThis.crypto?.randomUUID?.() || ''; } catch { /* noop */ }
    if (!id) id = `bf-${branchHash(`${seed}|${Date.now()}|${Math.random()}`)}`;
    state.branchFamilyId = id;
    return id;
}
