/* NPC State injection: the compact lines for mentioned-but-absent and deceased NPCs. */
import { calibrateRelationshipSummary, DEFAULT_RELATIONSHIP, normalizeRelationshipBaseline, relationshipSummaryConsistent } from '../core-relationship.js';
import { cleanList, cleanText, normalizeName } from '../core-text.js';
import { npcNamedInText } from '../core-merge.js';
import { customFieldValues } from '../core-record.js';
import { normalizeGender } from '../core-identity.js';
import { isTerminalNpcDeath } from '../terminal-lifecycle.js';
import { truncateInjectionText } from './truncate.js';
import { lineSummary } from '../relationship-summary-source.js';

const REFERENCE_LINE_LIMIT = 4;
const REFERENCE_LINE_CHARS = 240;
const MENTIONED_HEADER = 'MENTIONED, NOT PRESENT: NPCs the recent story names. Use these established facts if they come up or arrive; do not bring them on-screen unprompted.';
const DECEASED_HEADER = 'DECEASED, REFERENCED ONLY: these people are dead and only being talked about. Use these facts; never write them alive, present or speaking. Shown whenever the message or your reply names them by name or alias.';

// NPCs the recent story names who are not in the injected cast get one compact line each: a living
// off-screen (or archived) NPC its established facts, a confirmed-dead NPC who they were and how they
// died. At most four, living first; never a dossier block.
// The "toward the player" fact of a mentioned-but-absent NPC. A cast dossier's summary comes from the pack, not from a gated scanner write,
// so it passes the same calibrate + consistency check as the present path (compactRelationshipModifier); any other dossier is printed as stored.
function towardPlayer(npc) {
    if (!npc.relationshipSummary) return '';
    let summary = npc.relationshipSummary;
    if (npc.castFrom?.key) {
        const rel = normalizeRelationshipBaseline(npc.relationship || DEFAULT_RELATIONSHIP);
        summary = calibrateRelationshipSummary(summary, rel);
        if (!summary || !relationshipSummaryConsistent(summary, rel)) return '';
    }
    return `toward the player: ${cleanText(summary, 90)}`;
}

// `levelOn` (the RPG is on): a person's built-in Level is one of their facts.
export function referenceBlock(npcs = [], text = '', castIds = new Set(), customFieldNames = [], levelOn = false) {
    const roster = Array.isArray(npcs) ? npcs : [];
    const haystack = normalizeName(text);
    if (!haystack) return '';
    // Cheap pre-check before the full roster-aware match: a late game can hold hundreds of NPCs.
    const mayBeNamed = npc => [npc.name, ...(npc.aliases || [])]
        .some(label => normalizeName(label).split(/\s+/).some(token => token.length >= 3 && haystack.includes(token)));
    const named = roster.filter(npc => npc?.name && !castIds.has(npc.id) && !npc.present && mayBeNamed(npc) && npcNamedInText(npc, text, roster));
    const bondOf = npc => cleanText(String(cleanList(npc.keyRelationships, 1, 160)[0] || '').split('|')[0], 90);
    const mentioned = named.filter(npc => !isTerminalNpcDeath(npc)).slice(0, REFERENCE_LINE_LIMIT).map(npc => {
        const custom = Object.entries(customFieldValues(npc, customFieldNames)).map(([name, value]) => `${name}: ${value}`).join(' · ');
        const toward = lineSummary(npc);
        const facts = [normalizeGender(npc.gender), cleanText(npc.role, 70), npc.homeBase && `home base: ${cleanText(npc.homeBase, 60)}`,
            custom, levelOn && Number.isInteger(npc.level) && `level: ${npc.level}`, !toward && towardPlayer(npc)].filter(Boolean);
        const line = `- ${npc.name} (${['mentioned, not present', ...facts].join('; ')})`;
        if (!toward) return truncateInjectionText(line, REFERENCE_LINE_CHARS);
        // The story's own sentence stands after the other facts' cut, whole.
        return `${truncateInjectionText(line, REFERENCE_LINE_CHARS).replace(/\)$/, '')}; toward the player: ${toward})`;
    });
    const deceased = named.filter(npc => isTerminalNpcDeath(npc)).slice(0, Math.min(3, REFERENCE_LINE_LIMIT - mentioned.length)).map(npc => {
        const bond = bondOf(npc);
        const facts = [normalizeGender(npc.gender), cleanText(npc.role, 70), bond && `bond: ${bond}`].filter(Boolean);
        const death = cleanText(npc.lifeStateReason, 140);
        return truncateInjectionText(`- ${npc.name} (deceased${facts.length ? `; ${facts.join('; ')}` : ''})${death ? `: ${death}` : ''}`, REFERENCE_LINE_CHARS);
    });
    return [mentioned.length && MENTIONED_HEADER, ...mentioned, deceased.length && DECEASED_HEADER, ...deceased].filter(Boolean).join('\n');
}
