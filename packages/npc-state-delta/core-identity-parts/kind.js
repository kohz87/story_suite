/* NPC State Delta identity: telling a proper name from a role label, an interim placeholder or a descriptive phrase. */
import { normalizeName } from '../core-text.js';

const ROLE_LABEL_WORDS = new Set([
    'adventurer', 'apprentice', 'assistant', 'bartender', 'blacksmith', 'boy', 'captain', 'child', 'clerk', 'cook',
    'courier', 'drifter', 'elder', 'female', 'gate', 'girl', 'guard', 'guild', 'guildmaster', 'healer', 'innkeeper',
    'keeper', 'laborer', 'man', 'merchant', 'messenger', 'novice', 'officer', 'priest', 'priestess', 'receptionist',
    'refugee', 'runner', 'servant', 'soldier', 'stablehand', 'stable', 'hand', 'student', 'traveler', 'vendor', 'waiter', 'waitress',
    'watchman', 'woman', 'worker', 'butcher', 'baker', 'farmer', 'fisher', 'fisherman', 'fishmonger', 'carpenter', 'tailor',
    'cobbler', 'shopkeeper', 'storekeeper', 'grocer', 'porter', 'maid', 'hostler', 'groom', 'rancher', 'shepherd', 'herder',
    'miner', 'miller', 'brewer', 'tanner', 'scribe', 'librarian', 'teacher', 'doctor', 'nurse', 'midwife', 'barber',
    'young', 'old', 'older', 'elderly', 'masked', 'hooded', 'mysterious', 'local',
    'village', 'town', 'city', 'guildhall', 'human', 'elf', 'elven', 'dwarf', 'dwarven', 'half', 'halfelf', 'dwelf',
    'tiefling', 'orc', 'orcish', 'goblin', 'halfling', 'gnome', 'male', 'warrior', 'mage', 'wizard', 'witch', 'knight',
]);

export function inferNpcIdentityKind(name, explicit = '') {
    const stated = String(explicit ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const tokens = normalizeName(name).split(/\s+/).filter(Boolean);
    if (!tokens.length) return 'unknown';
    const roleLike = tokens.every(token => ROLE_LABEL_WORDS.has(token) || /^\d+$/.test(token));
    const inferred = roleLike ? 'role_label' : 'proper_name';
    // A model occasionally labels an obvious personal name as role_label. The deterministic
    // name heuristic wins in that direction so Conservative mode cannot strand names such as
    // Myla/Toris as candidates. Explicit proper_name remains authoritative.
    if (stated === 'proper_name') return 'proper_name';
    if (stated === 'role_label') {
        const clearlyPersonal = (tokens.length === 1 && !ROLE_LABEL_WORDS.has(tokens[0]))
            || (tokens.length > 1 && tokens.every(token => !ROLE_LABEL_WORDS.has(token) && !/^\d+$/.test(token)));
        return clearlyPersonal ? 'proper_name' : 'role_label';
    }
    return inferred;
}

const INTERIM_IDENTITY_WORDS = new Set([
    'unknown', 'unnamed', 'unidentified', 'anonymous', 'stranger', 'figure', 'person', 'npc',
    'man', 'woman', 'boy', 'girl', 'child', 'guard', 'receptionist', 'bartender', 'innkeeper',
    'merchant', 'vendor', 'clerk', 'waiter', 'waitress', 'soldier', 'officer', 'watchman', 'sentry',
    'sentinel', 'stablehand', 'blacksmith', 'healer', 'priest', 'priestess', 'servant', 'maid',
    'attendant', 'worker', 'laborer', 'courier', 'messenger', 'shopkeeper', 'keeper', 'owner',
    'proprietor', 'captain', 'chief', 'leader', 'elder', 'student', 'apprentice', 'assistant',
    'human', 'elf', 'dwarf', 'orc', 'goblin', 'halfling', 'gnome', 'tiefling', 'traveler', 'drifter',
]);

const LABEL_FILLER_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'from', 'at', 'in', 'on', 'that', 'this']);

// A label that describes a role rather than naming one person ("Innkeeper", "the innkeeper",
// "the old man", "Guard Captain"). Many people can fit it, so it never recalls a dossier and
// never merges a new NPC into a named one on its own. A label with a capitalised non-role word
// ("Red", "the Butcher of Vell", "Sister Callow") names someone.
export function isRoleDescriptionLabel(label) {
    const raw = String(label ?? '').trim();
    if (!raw || !normalizeName(raw)) return false;
    if (isInterimNpcLabel(raw)) return true;
    const content = raw.split(/\s+/).map(word => word.replace(/[^\p{L}\p{N}'-]/gu, '')).filter(Boolean)
        .filter(word => !LABEL_FILLER_WORDS.has(word.toLowerCase()));
    return content.length > 0 && content.every(word => word === word.toLowerCase());
}

// A phrase that describes someone instead of naming them ("leader in the gambeson", "Leader in the gambeson"): three or more words, none
// capitalised after the first (a sentence may start it), one of them a linking word. Uncased scripts (no lowercase letter) never count, and a
// role label ("old man", "the innkeeper") has no linking word, so it stays on the role path. A new person written this way is not admitted (core-merge.js).
const LINKING_WORDS = new Set(['in', 'with', 'of', 'at', 'from', 'on', 'by', 'under', 'behind', 'beside', 'near', 'wearing', 'carrying', 'holding']);
export function isDescriptivePhrase(label) {
    const words = String(label ?? '').trim().split(/\s+/).filter(Boolean);
    return words.length >= 3 && words.some(word => /\p{Ll}/u.test(word)) && words.slice(1).every(word => word === word.toLowerCase())
        && words.some(word => LINKING_WORDS.has(word.toLowerCase()));
}

export function isInterimNpcLabel(name, explicit = '') {
    const text = normalizeName(name);
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    if (inferNpcIdentityKind(name, explicit) === 'role_label') return true;
    // Catch descriptive placeholders such as "red haired woman" or "masked elf" that
    // contain free-form adjectives and therefore are not caught by the all-role-word heuristic.
    const finalToken = tokens[tokens.length - 1];
    const hasPlaceholderMarker = tokens.some(token => ['unknown', 'unnamed', 'unidentified', 'anonymous', 'mysterious', 'masked', 'hooded'].includes(token));
    return tokens.length <= 6 && (hasPlaceholderMarker || INTERIM_IDENTITY_WORDS.has(finalToken));
}
