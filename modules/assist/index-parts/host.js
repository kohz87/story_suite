// The assist part's names for the host: its status query, its host module id, and the check that a module keeps a kind.

import { sdk } from './shared-sdk.js';

export const STATUS_QUERY = 'assist.status';
// The module this part is merged into (its settings bucket).
export const HOST_MODULE_ID = 'story-block';

/** Whether a registered module keeps change lines of `kind` (through the public sdk). */
export function sdkHasKind(kind) {
    const modules = sdk()?.modules?.();
    return Array.isArray(modules) && modules.some(module => Array.isArray(module?.kinds) && module.kinds.includes(kind));
}
