// Builds one NPC's suite profile (role and summary) from the dossier.
import { plainText, trimAtWord } from './shared-text.js';
// npcProfiles() (Story Suite contract, NPC State Delta 1.2.2): a short role and a <= 200-char
// summary per tracked, non-archived NPC, shaped only from fields the dossier already holds.
export const NPC_PROFILE_ROLE_MAX = 60;
export const NPC_PROFILE_SUMMARY_MAX = 200;
// Custom field names (as whole words) that stand in for an empty dossier role, in this order.
const ROLE_FIELD_WORDS = ['role', 'occupation', 'profession', 'job', 'title', 'class'];
// Custom field names (as whole words) that say what an NPC can do.
const ABILITY_FIELD_WORDS = new Set([
    'ability', 'abilities', 'skill', 'skills', 'power', 'powers', 'magic', 'spell', 'spells',
    'talent', 'talents', 'specialty', 'speciality', 'expertise', 'combat', 'weapon', 'weapons', 'class',
]);

function fieldWords(name) {
    return plainText(name).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

// The configured custom fields that hold a value on this dossier, as [name, value] pairs.
function configuredCustomFields(npc, names) {
    const stored = npc?.customFields && typeof npc.customFields === 'object' && !Array.isArray(npc.customFields) ? npc.customFields : {};
    const keys = Object.keys(stored);
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(names) ? names : []) {
        const name = plainText(raw);
        const lower = name.toLocaleLowerCase();
        if (!name || seen.has(lower)) continue;
        seen.add(lower);
        const key = keys.find(other => other.toLocaleLowerCase() === lower);
        const value = key === undefined ? '' : plainText(stored[key]);
        if (value) out.push([name, value]);
    }
    return out;
}

function sentence(text) {
    return plainText(text).replace(/[\s.;,:]+$/u, '');
}

/**
 * One NPC's suite profile: { id, name, aliases, present, role, summary } as a frozen plain copy.
 * `role` is the dossier's occupation/story role (or a role-like custom field when it is empty),
 * cut to its first phrase; `summary` joins who they are (role, species), what they can do
 * (ability-like custom fields), personality and background, trimmed to 200 characters.
 */
export function buildNpcProfile(npc, { customFieldNames = [] } = {}) {
    const fields = configuredCustomFields(npc, customFieldNames);
    const dossierRole = plainText(npc?.role);
    const roleField = dossierRole ? null : ROLE_FIELD_WORDS
        .map(word => fields.find(([name]) => fieldWords(name).includes(word)))
        .find(Boolean) || null;
    const fullRole = dossierRole || roleField?.[1] || '';
    const firstPhrase = fullRole.split(/\s*(?:[;|(]|\s[-–—]\s)/u)[0];
    const role = trimAtWord(sentence(firstPhrase), NPC_PROFILE_ROLE_MAX);

    const species = sentence(npc?.species);
    const who = sentence(fullRole);
    const identity = who && species && !who.toLocaleLowerCase().includes(species.toLocaleLowerCase())
        ? `${who} (${species})`
        : who || species;
    const abilities = fields
        .filter(field => field !== roleField && fieldWords(field[0]).some(word => ABILITY_FIELD_WORDS.has(word)))
        .map(([name, value]) => `${name}: ${sentence(value)}`);
    const parts = [identity, ...abilities, sentence(npc?.personality), sentence(npc?.background)].filter(Boolean);
    const summary = trimAtWord(parts.length ? `${parts.join('. ')}.` : '', NPC_PROFILE_SUMMARY_MAX);

    return Object.freeze({
        id: plainText(npc?.id),
        name: plainText(npc?.name),
        aliases: Object.freeze((Array.isArray(npc?.aliases) ? npc.aliases : []).map(plainText).filter(Boolean)),
        present: Boolean(npc?.present),
        role,
        summary,
    });
}
