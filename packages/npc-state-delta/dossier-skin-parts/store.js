/* NPC State Delta dossier look: reading and writing the stored Dossier style setting. */
import { extension_settings, getContext } from '../../../../extensions.js';
import { normalizeDossierSkin } from './look.js';

const EXTENSION_NAME = 'npc_state_delta';

export function readDossierSkin() {
    return normalizeDossierSkin(extension_settings?.[EXTENSION_NAME]?.dossierStyle);
}

export function writeDossierSkin(value) {
    if (!extension_settings[EXTENSION_NAME] || typeof extension_settings[EXTENSION_NAME] !== 'object') extension_settings[EXTENSION_NAME] = {};
    const skin = normalizeDossierSkin(value);
    extension_settings[EXTENSION_NAME].dossierStyle = skin;
    const ctx = getContext();
    if (typeof ctx?.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
    return skin;
}
