/* NPC State Delta citation stripping: removes scanner message citations from a stored record, keeping locks and pack words. */
import { stripMessageCitations } from '../core-text.js';
import { TEXT_FIELDS } from '../../fields/registry.js';

// (stage 73) Message citations ("[m1, m2]") the scanner's model appended to a field are not dossier text: normalizeNpcRecord strips them from
// every stored text field and list item, so a saved dossier is cleaned the next time it is normalized. An evidence item keeps its intended
// leading "[mN] " tag (message attribution); only citations after it go.
const CITATION_LIST_FIELDS = ['aliases', 'mannerisms', 'behaviorProfile', 'behavior_profile', 'memories', 'manualMemories', 'keyRelationships', 'key_relationships', 'innerCircle', 'inner_circle', 'family'];
const CITATION_TEXT_FIELDS = [...TEXT_FIELDS, 'overallAppearance', 'unclassifiedAppearance', 'lifeStateReason'];
const stripEvidenceCitations = item => {
    if (typeof item !== 'string') return item;
    const lead = item.match(/^\s*\[m\d+\]\s*/i);
    return lead ? lead[0] + stripMessageCitations(item.slice(lead[0].length)) : stripMessageCitations(item);
};
export function stripRecordCitations(raw) {
    const out = { ...raw };
    // The reader's own fields (locked in the editor) and a cast pack's words still as the pack wrote them are not the scanner's: left as they are.
    const locked = new Set(Array.isArray(raw?.manualProfileFields) ? raw.manualProfileFields.map(value => String(value || '').trim()) : []);
    const first = raw?.castFrom?.first && typeof raw.castFrom.first === 'object' ? raw.castFrom.first : {};
    const keep = key => locked.has(key) || (first[key] !== undefined && JSON.stringify(first[key]) === JSON.stringify(out[key]));
    for (const key of CITATION_TEXT_FIELDS) if (typeof out[key] === 'string' && !keep(key)) out[key] = stripMessageCitations(out[key]);
    for (const key of CITATION_LIST_FIELDS) if (Array.isArray(out[key]) && !keep(key)) out[key] = out[key].map(item => (typeof item === 'string' ? stripMessageCitations(item) : item));
    if (Array.isArray(out.appearanceForms)) {
        out.appearanceForms = out.appearanceForms.map(form => (form && typeof form.appearance === 'string' ? { ...form, appearance: stripMessageCitations(form.appearance) } : form));
    }
    for (const key of ['profileEvidence', 'profile_evidence']) {
        const evidence = out[key];
        if (evidence && typeof evidence === 'object' && !Array.isArray(evidence)) {
            out[key] = Object.fromEntries(Object.entries(evidence).map(([field, list]) => [field, Array.isArray(list) ? list.map(stripEvidenceCitations) : list]));
        }
    }
    return out;
}
