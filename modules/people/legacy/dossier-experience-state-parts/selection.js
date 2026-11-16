// The dossier on screen and the current selection, read from the controller's UI root and the public api.
import { api, plain, uiRoot } from '../dossier-tools-core.js';

// The dossier on screen, or '' on the library: the controller's own selection (the board, profile and sections all
// belong to one NPC). The library keeps a highlighted id but shows no dossier, so it counts as none.
export function screenNpcId(root = uiRoot()) {
    const ui = root?.__npcStateDeltaStage1Ui;
    if (!ui) return '';
    return ui.screen?.name && ui.screen.name !== 'library' ? plain(ui.selectedNpcId) : '';
}

export function selectedNpcId(root = uiRoot()) {
    return plain(root?.__npcStateDeltaStage1Ui?.selectedNpcId);
}

export function currentNpc(npcId = selectedNpcId()) {
    try { return api()?.getNpc?.(npcId) || null; }
    catch { return null; }
}
