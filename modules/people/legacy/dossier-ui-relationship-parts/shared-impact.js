/* NPC State Delta dossier relationship part: the impact label shared by the last-change and recent-change markup. */
import { plain } from '../dossier-ui-model.js';

export function impactLabel(impact) {
    const value = plain(impact, 'none');
    if (value === 'manual') return 'Manual edit';
    return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}
