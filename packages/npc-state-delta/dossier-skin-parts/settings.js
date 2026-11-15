/* NPC State Delta dossier look: the Dossier style settings row, and the start-up wiring that mounts it and keeps the panel styled. */
import { SETTINGS_ID, ROOT_ID } from '../dossier-ui-constants.js';
import { DOSSIER_SKINS } from './look.js';
import { readDossierSkin, writeDossierSkin } from './store.js';
import { applyDossierSkin, syncDossierSkin } from './apply.js';

const SETTINGS_ROOT_ID = 'npc_state_delta_dossier_skin_settings';
const SELECT_ID = 'npc_state_delta_dossier_style';
const SLOT_ID = 'dossier-style';
// Until the settings panel has its own slot, the row sits in the relationship-map slot (same settings block).
const FALLBACK_SLOT_ID = 'relationship-map';

function settingsSlot() {
    if (typeof document === 'undefined') return null;
    return document.querySelector(`#${SETTINGS_ID} [data-delta-settings-slot="${SLOT_ID}"]`)
        || document.querySelector(`#${SETTINGS_ID} [data-delta-settings-slot="${FALLBACK_SLOT_ID}"]`);
}

function settingRow(id, label, control, hint) {
    return `<label class="npc-state-delta-setting-row story-suite-row" for="${id}"><span><b>${label}</b><small>${hint}</small></span>${control}</label>`;
}

// Mounts the Dossier style row once. Returns false while the settings panel has no slot yet (the caller may retry).
export function mountDossierSkinSettings() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById(SETTINGS_ROOT_ID)) return true;
    const slot = settingsSlot();
    if (!slot) return false;
    const current = readDossierSkin();
    const root = document.createElement('div');
    root.id = SETTINGS_ROOT_ID;
    root.innerHTML = `<h4 class="delta-settings-subhead story-suite-subhead">Dossier look</h4>
        ${settingRow(SELECT_ID, 'Dossier style', `<select id="${SELECT_ID}" class="text_pole">${DOSSIER_SKINS.map(skin => `<option value="${skin.key}"${skin.key === current ? ' selected' : ''}>${skin.label}</option>`).join('')}</select>`, 'The look of the dossier window: Neutral (default), Fantasy or Modern. Only colours, edges and the dial change; what it shows does not.')}`;
    root.addEventListener('change', event => {
        if (event.target?.id !== SELECT_ID) return;
        const skin = writeDossierSkin(event.target.value);
        event.target.value = skin;
        applyDossierSkin(document.getElementById(ROOT_ID), skin);
    });
    slot.appendChild(root);
    return true;
}

// Like the relationship map: this module wires itself, so the panel never imports the host's settings module.
function start() {
    // Synthetic hosts offer a document with no queries: nothing to style there.
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function' || typeof document.addEventListener !== 'function') return;
    document.addEventListener('npc-state-delta:dossier-rendered', syncDossierSkin);
    document.addEventListener('npc-state-delta:settings-mounted', mountDossierSkinSettings);
    mountDossierSkinSettings();
    syncDossierSkin();
}

start();
