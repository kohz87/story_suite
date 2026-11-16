// Registers the macro in SillyTavern's context, through the new macro engine or the old one.
import { MACRO_NAME, LEGACY_PATHS } from './names.js';
import { macroText } from './text.js';

/**
 * Registers the macro in `ctx` (SillyTavern's getContext()) → { engine: 'new' | 'legacy', off() }, or null where the context has no macro API.
 * `off()` takes it out again.
 */
export function registerSbMacro({ ctx, api, log = console.warn }) {
    const modern = ctx?.macros?.register && ctx.macros.registry?.unregisterMacro && ctx.powerUserSettings?.experimental_macro_engine !== false;
    try {
        if (modern) {
            // A copy of Story Block that was loaded before this one is replaced (the newer code is the one that runs).
            if (ctx.macros.registry.hasMacro?.(MACRO_NAME)) ctx.macros.registry.unregisterMacro(MACRO_NAME);
            const made = ctx.macros.register(MACRO_NAME, {
                category: 'extension',
                unnamedArgs: [{ name: 'path', description: 'A Story Block path, like scene.place or party.me.health; add |fallback for when it is empty or hidden.' }],
                list: true,
                strictArgs: false,
                description: 'A value of the story state (Story Block public API): {{sb::scene.place}}, {{sb::money.text|nothing}}.',
                returns: 'The value as text (a list as a comma list), the fallback, or nothing.',
                exampleUsage: ['{{sb::scene.place}}', '{{sb::party.me.health|unknown}}'],
                handler: ({ args }) => macroText(api, (Array.isArray(args) ? args : []).join('::')),
            });
            if (made) return { engine: 'new', off: () => { try { ctx.macros.registry.unregisterMacro(MACRO_NAME); } catch { /* already gone */ } } };
            // The engine refused it (it logs its own reason and returns null): the old way, told once.
            try { log('[Story Block v2] the macro engine did not take {{sb::…}}; trying the old macro API'); } catch { /* nothing to tell it to */ }
        }
        if (typeof ctx?.registerMacro === 'function') {
            for (const path of LEGACY_PATHS) ctx.registerMacro(`${MACRO_NAME}::${path}`, () => macroText(api, path));
            return { engine: 'legacy', off: () => { for (const path of LEGACY_PATHS) { try { ctx.unregisterMacro?.(`${MACRO_NAME}::${path}`); } catch { /* already gone */ } } } };
        }
    } catch (error) {
        try { log('[Story Block v2] the {{sb::…}} macro could not be registered', error); } catch { /* nothing to tell it to */ }
    }
    return null;
}
