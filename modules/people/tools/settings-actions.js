/* NPC State's settings section (Extensions › Story Suite, the drawer the view draws): the Data & maintenance buttons
   Backup / Export, Restore / Import and Diagnostics open the tools dialogs. One delegated click listener on the page. */
import { exportNativeTools, openDiagnostics, openImportTools } from './data-tools.js';

const GUARD = '__pplSettingsActions';

function onClick(event) {
    if (event.target.closest?.('[data-delta-settings-backup]')) {
        event.preventDefault();
        exportNativeTools();
        return;
    }
    if (event.target.closest?.('[data-delta-settings-restore]')) {
        event.preventDefault();
        void openImportTools();
        return;
    }
    if (event.target.closest?.('[data-delta-settings-diagnostics]')) {
        event.preventDefault();
        openDiagnostics();
    }
}

/** Binds the three buttons once per page (a second call does nothing). */
export function bindSettingsActions(doc = globalThis.document) {
    if (!doc || doc[GUARD]) return false;
    doc[GUARD] = true;
    doc.addEventListener('click', onClick);
    return true;
}

if (typeof document !== 'undefined') bindSettingsActions(document);
