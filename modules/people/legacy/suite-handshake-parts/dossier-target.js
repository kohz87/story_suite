// Resolves the dossier id openDossier(value) should open from an id, name or alias.
import { plainText } from './shared-text.js';
import { isTerminalNpcDeath } from '../../core/terminal-lifecycle.js';
// P6: no archive flag; a confirmed-dead person is out of reach exactly as an archived (death-archived) one was.
const gone = npc => Boolean(npc?.archived) || isTerminalNpcDeath(npc);
function nameKey(value) {
    return plainText(value).toLocaleLowerCase();
}

/**
 * The dossier id openDossier(value) should open, or '' to do nothing. `value` is an NPC id; when
 * no dossier has that id, it may be a name or alias (case-insensitive, exact), matched among the
 * non-archived NPCs: a unique name match first, then a unique alias match. An archived NPC, an
 * unknown or ambiguous value, or a malformed list resolves to ''. Never throws.
 */
export function resolveDossierTarget(npcs, value) {
    try {
        const query = plainText(value);
        if (!query) return '';
        const list = (Array.isArray(npcs) ? npcs : []).filter(npc => npc && typeof npc === 'object' && plainText(npc.id));
        const byId = list.find(npc => plainText(npc.id) === query);
        if (byId) return gone(byId) ? '' : plainText(byId.id);
        const key = nameKey(query);
        const active = list.filter(npc => !gone(npc));
        const named = active.filter(npc => nameKey(npc.name) === key);
        if (named.length) return named.length === 1 ? plainText(named[0].id) : '';
        const aliased = active.filter(npc => Array.isArray(npc.aliases) && npc.aliases.some(alias => nameKey(alias) === key));
        return aliased.length === 1 ? plainText(aliased[0].id) : '';
    } catch {
        return '';
    }
}
