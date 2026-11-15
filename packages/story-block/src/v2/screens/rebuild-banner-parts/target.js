// Finds the permanent dossier block the rebuild banner acts on, if any.

import { REBUILD_PERMANENT_CODES } from './constants.js';

/** The permanent block this banner acts on, or null (a transient failure and no block are both hidden). */
export function rebuildTarget(blocked) {
    if (!blocked || typeof blocked !== 'object') return null;
    const by = blocked.blockedBy && typeof blocked.blockedBy === 'object' ? blocked.blockedBy : blocked;
    const module = typeof by.module === 'string' ? by.module : '';
    if (!module || !REBUILD_PERMANENT_CODES.includes(by.code)) return null;
    return { module, code: by.code };
}

