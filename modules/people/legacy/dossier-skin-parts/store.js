/* NPC State Delta dossier look: reading and writing the stored Dossier style setting. */
import { extension_settings, getContext } from '../../../../extensions.js';
import { npcBucket } from '../../settings/bucket.js';
import { normalizeDossierSkin } from './look.js';

export function readDossierSkin() {
    return normalizeDossierSkin(npcBucket(extension_settings)?.dossierStyle);
}

export function writeDossierSkin(value) {
    const skin = normalizeDossierSkin(value);
    npcBucket(extension_settings, { create: true }).dossierStyle = skin;
    const ctx = getContext();
    if (typeof ctx?.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
    return skin;
}
