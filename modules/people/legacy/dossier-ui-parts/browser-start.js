/* Dossier browser start: mounts the dossier UI once the runtime API appears in a browser page. */
import { mountNpcStateDeltaDossierUi } from '../dossier-ui-mount.js';

export { mountNpcStateDeltaDossierUi };

function startBrowserUi(attempt = 0) {
    if (typeof document === 'undefined') return;
    const api = globalThis.NPCStateDelta;
    if (api) {
        mountNpcStateDeltaDossierUi(api);
        return;
    }
    if (attempt < 40) setTimeout(() => startBrowserUi(attempt + 1), 100);
    else console.error('[NPC State Delta] Stage 1 dossier UI could not find the runtime API.');
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => startBrowserUi(), { once: true });
    else queueMicrotask(() => startBrowserUi());
}
