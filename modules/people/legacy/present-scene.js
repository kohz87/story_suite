// Present NPCs view, display only: the labelled Mood, Condition and Outfit lines on each present card
// (the Cast and World panes). Everything here is pure except fillPresentSceneText, which writes the
// shaped strings into slots with textContent. Nothing reads or writes dossier state, prompts, scans
// or saved data. Public face: re-exports its parts.
export { NOW_PART_MAX, NOW_TITLE_MAX, NOW_PARTS, DOSSIER_LOOK_LABEL } from './present-scene-parts/now-constants.js';
export { nowParts, presentSceneModel } from './present-scene-parts/scene-model.js';
export { nowSlotHtml, sceneAttr } from './present-scene-parts/slots-html.js';
export { rememberPresentScene, fillPresentSceneText } from './present-scene-parts/scene-text-fill.js';
