/* Visual-viewport size of the page. */
import { finite } from './shared-number.js';

export function viewportSize() {
    const visual = globalThis.visualViewport;
    return {
        width: Math.max(0, finite(visual?.width, globalThis.innerWidth || document.documentElement?.clientWidth || 0)),
        height: Math.max(0, finite(visual?.height, globalThis.innerHeight || document.documentElement?.clientHeight || 0)),
    };
}
