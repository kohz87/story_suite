// V1 watch: reports the old-copy Problem once when a version 1 sign is seen.

import { hasV1Settings, isV1Api } from './v1-signs.js';

export const V1_COPY_CODE = 'V1_COPY';
export const V1_COPY_PROBLEM = 'An old copy of Story Block (version 1) seems to be installed too; remove it under Extensions.';

/**
 * Watches for a v1 copy: `before` is what `globalThis.StoryBlock` held before this copy set its own; `current()` what it
 * holds now; `report(entry)` adds a Problems line; `problems()` the list (so the line is not told twice). → check(), which
 * looks again (at start, when the app is ready, on a chat change) and returns true when it found one.
 */
export function createV1Watch({ before = null, current = () => globalThis.StoryBlock, doc = globalThis.document, report, problems = () => [] } = {}) {
    const earlier = isV1Api(before);
    return {
        check() {
            let now = null;
            try { now = current(); } catch { now = null; }
            const found = earlier || isV1Api(now) || hasV1Settings(doc);
            if (!found) return false;
            let told = false;
            try { told = (problems() ?? []).some(item => item?.code === V1_COPY_CODE); } catch { told = false; }
            // (Told at once too: only the reader can remove it.)
            if (!told) report?.({ code: V1_COPY_CODE, message: V1_COPY_PROBLEM, toast: true });
            return true;
        },
    };
}
