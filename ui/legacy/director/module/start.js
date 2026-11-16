// Story Director v2: what it does once Story Block has accepted the module (the module's `register` hook).

import { arcController } from '../../../../modules/arc/index.js';
import { setPersonaReader } from '../../../../modules/time/tracker/initiative.js';
import { MODULE_NAME, VERSION } from './parts.js';

/** Gives the time tracker the persona's name and starts arc planning on each reply (setting arc.trigger: auto). */
export function startDirector(sdk) {
    setPersonaReader(() => sdk.substitute?.('{{user}}') ?? '');
    // Arc planning by itself looks after every reply.
    try { sdk.on?.('turn', turn => { void arcController().onTurn(turn).catch(error => console.warn(`[${MODULE_NAME}] arc planning:`, error?.message ?? error)); }); } catch { /* an older host */ }
    console.info(`[${MODULE_NAME}] v${VERSION} registered with Story Block v2.`);
}
