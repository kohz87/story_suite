// Loads the shared suite.css once per page.

export const SUITE_STYLESHEET_ID = 'story-suite-css';

/**
 * Load the shared suite.css once per page as <link id="story-suite-css">: the first suite
 * extension to load wins (the copies are identical). True when this call added it.
 */
export function ensureSuiteStylesheet(href = new URL('../suite.css', import.meta.url).href, doc = globalThis.document) {
    try {
        if (!doc?.createElement || doc.getElementById?.(SUITE_STYLESHEET_ID)) return false;
        const parent = doc.head || doc.documentElement;
        if (typeof parent?.appendChild !== 'function') return false;
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.id = SUITE_STYLESHEET_ID;
        link.href = String(href);
        parent.appendChild(link);
        return true;
    } catch {
        return false;
    }
}
