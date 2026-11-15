/* NPC State Delta dossier experience state: life-state projection, current selection, and DOM write guards. */
// Public face: re-exports its parts.
export { setNodeTextIfChanged, setNodeValueIfChanged } from './dossier-experience-state-parts/node-write-guards.js';
export { lifeStateChoice } from './dossier-experience-state-parts/life-state.js';
export { screenNpcId, selectedNpcId, currentNpc } from './dossier-experience-state-parts/selection.js';
