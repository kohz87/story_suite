// The job: the installed-pack list kept in SillyTavern's extension settings, and saving those settings now.

import { context } from './shared-context.js';

// Without SillyTavern (tests, a page without the host) the list lives in memory only.
const memory = {};

/** `{ read, save }` over `extension_settings.storySuite`. */
export function stSettings() {
    return {
        read() {
            const settings = context()?.extensionSettings;
            if (!settings) return memory;
            if (!settings.storySuite || typeof settings.storySuite !== 'object') settings.storySuite = {};
            return settings.storySuite;
        },
        save() {
            context()?.saveSettingsDebounced?.();
        },
    };
}

/**
 * Saves SillyTavern's settings now instead of after its debounce (about a second), and says whether it worked: `{ ok, message }`.
 * SillyTavern's context only offers the debounced save, so the page's own `saveSettings` (script.js) is used, found on the context if a
 * later version gives it there. It never throws: SillyTavern tells its own failure with a toast and no error, so success is its
 * `settings_updated` event; no event within `timeoutMs` is a failure. Where there is no SillyTavern page (tests) there is nothing to
 * flush and it answers ok.
 */
export async function saveSettingsNow({ timeoutMs = 8000 } = {}) {
    const ctx = context();
    if (!ctx) return { ok: true, message: '' };
    let timer = null;
    try {
        const save = typeof ctx.saveSettings === 'function' ? ctx.saveSettings.bind(ctx) : (await import('/script.js')).saveSettings;
        const source = ctx.eventSource;
        const type = (ctx.eventTypes ?? ctx.event_types)?.SETTINGS_UPDATED;
        if (typeof save !== 'function' || typeof source?.once !== 'function' || !type) return { ok: false, message: 'SillyTavern\'s settings could not be saved from here.' };
        const forget = fn => { try { (source.removeListener ?? source.off)?.call(source, type, fn); } catch { /* it is gone already */ } };
        const told = new Promise(resolve => {
            const onSaved = () => resolve(true);
            source.once(type, onSaved);
            // (a save that never answers is raced against the timer, and the listener is taken away when the timer wins)
            timer = setTimeout(() => { forget(onSaved); resolve(false); }, timeoutMs);
        });
        await Promise.race([Promise.resolve().then(() => save()), told]);
        const ok = await told;
        return ok ? { ok: true, message: '' } : { ok: false, message: 'SillyTavern did not confirm that its settings were saved.' };
    } catch (error) {
        return { ok: false, message: `SillyTavern's settings could not be saved (${error?.message ?? error}).` };
    } finally {
        clearTimeout(timer);
    }
}
