// Present NPCs view, display only: what each present NPC is like now (labelled Mood, Condition and
// Outfit lines, 1.2.3; one "mood · condition · outfit" line in 1.2.2) on each present card,
// and Story Block's NPC Inner Chatter shown as bubbles beside the speakers' cards. Everything
// here is pure except fillPresentSceneText, which writes the shaped strings into slots with
// textContent. Nothing reads or writes dossier state, prompts, scans or saved data; without Story
// Block the now line comes from Delta's own tracked mood/condition/outfit and no chatter shows.
// Public face: re-exports its parts.
export { NOW_PART_MAX, NOW_TITLE_MAX, NOW_PARTS, DOSSIER_LOOK_LABEL } from './present-scene-parts/now-constants.js';
export { storyBlockTags } from './present-scene-parts/story-block-tags.js';
export { CHATTER_LINE_MAX, CHATTER_LINE_LIMIT, SPEAKER_WORDS_MAX, parseChatterLines } from './present-scene-parts/chatter-parse.js';
export { parseWorldStateNpcs, worldStatePeople } from './present-scene-parts/world-state-parse.js';
export { matchPresentCard, nowParts, chatterBubbleKind, presentSceneModel } from './present-scene-parts/scene-model.js';
export { nowSlotHtml, chatterSlotsHtml, speakerChatterHtml, othersSlotsHtml } from './present-scene-parts/slots-html.js';
export { speakerGroups, sceneAttr } from './present-scene-parts/scene-groups.js';
export { rememberPresentScene, fillPresentSceneText } from './present-scene-parts/scene-text-fill.js';
