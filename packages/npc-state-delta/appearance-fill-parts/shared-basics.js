/* Small checks shared by the fill parts: blank text, fill eligibility and a trait pattern lookup. A part of appearance-fill.js (same owner, moved without change). */
import { PHYSICAL_TRAITS } from '../appearance-physical.js';
import { isTerminalNpcDeath } from '../terminal-lifecycle.js';

export const blank = value => !String(value ?? '').trim();
export const patternOf = key => PHYSICAL_TRAITS.find(([name]) => name === key)[1];
export const eligible = npc => {
    if (!npc || typeof npc !== 'object' || npc.archived || isTerminalNpcDeath(npc)) return false;
    const life = String(npc.lifeState || '').toLowerCase();
    if (life === 'deceased' || life === 'dead') return false;
    if ((Array.isArray(npc.appearanceForms) && npc.appearanceForms.length) || !blank(npc.currentForm) || npc.currentFormUnknown) return false;
    return !(Array.isArray(npc.manualProfileFields) && npc.manualProfileFields.includes('appearance'));
};
