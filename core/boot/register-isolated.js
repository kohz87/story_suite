// Registers one built-in module so that a module that fails cannot stop the others (the isolation of a running module, applied to load).

const LOG = '[Story Suite]';

/**
 * Registers `mod` with the runtime's sdk. A refusal or a throw from its `register` hook is logged, put on the Problems list
 * (Diagnostics) and, when the registry already holds the module, switches it off; never thrown. Resolves true when it started.
 */
export async function registerIsolated(runtime, mod) {
    const id = typeof mod?.id === 'string' ? mod.id : '?';
    const had = Boolean(runtime.registry?.lifecycle?.(id));   // a refused duplicate must not switch off the module that is already there
    try {
        await runtime.sdk.registerModule(mod);
        return true;
    } catch (error) {
        const message = `${mod?.name ?? id} could not start: ${error?.message ?? error}`;
        console.error(`${LOG} ${message}`);
        try { runtime.turn.report({ module: id, code: 'MODULE_START', message }); } catch { /* the list is not there */ }
        if (!had) { try { runtime.registry?.setEnabled?.(id, false, `Could not start: ${error?.message ?? error}`); } catch { /* not registered */ } }
        return false;
    }
}
