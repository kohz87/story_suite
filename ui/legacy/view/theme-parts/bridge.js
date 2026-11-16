// Story Suite v2: the theme bridge in the page: writes the sheet and applies it again when SillyTavern's theme changes.

import { textSizeOf } from './text-size.js';
import { themeChoice, decideScheme } from './scheme-choice.js';
import { themeCss } from './css.js';

/**
 * createThemeBridge({ doc, settings, readVar }) → { apply(), current(), destroy() }.
 * `settings()` → the host settings ({ panelStyle, glassStrength, font, textSize }); `readVar(name)` → a theme
 * variable's value (default: computed on <html>). apply() writes the theme sheet (only when it changed); a
 * change to <html>'s style (SillyTavern applying a theme) applies again.
 */
export function createThemeBridge({ doc = globalThis.document, settings = () => ({}), readVar = null } = {}) {
    const win = doc?.defaultView ?? globalThis;
    const read = readVar ?? (name => {
        try { return String(win.getComputedStyle?.(doc.documentElement)?.getPropertyValue?.(name) ?? '').trim(); } catch { return ''; }
    });
    let last = null;
    let style = null;
    function sheet() {
        if (style?.isConnected !== false && style) return style;
        style = doc.head?.querySelector?.('style[data-ss-theme]') ?? null;
        if (!style) {
            style = doc.createElement('style');
            style.setAttribute('data-ss-theme', '');
            doc.head?.appendChild(style);
        }
        return style;
    }
    function apply() {
        let values = {};
        try { values = settings() ?? {}; } catch { values = {}; }
        const { panel, font, strength } = themeChoice(values);
        const scheme = decideScheme({ body: read('--SmartThemeBodyColor'), tint: read('--SmartThemeBlurTintColor') });
        last = { scheme, panel, font, strength };
        const text = themeCss({ ...last, textSize: textSizeOf(values) });
        const node = sheet();
        if (node.textContent !== text) node.textContent = text;
        return last;
    }
    let observer = null;
    if (typeof win.MutationObserver === 'function' && doc.documentElement) {
        observer = new win.MutationObserver(() => apply());
        observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    apply();
    return {
        apply,
        current: () => (last ? { ...last } : null),
        destroy() {
            observer?.disconnect();
            observer = null;
        },
    };
}
