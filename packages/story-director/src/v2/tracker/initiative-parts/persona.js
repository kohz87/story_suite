// Story Director v2, tracker part (initiative): holds the host's reader of {{user}}'s name and tells whether someone is the player.

import { lineKey } from '../../../changes.js';
import { cutPoints } from '../scene.js';

// {{user}}'s name, read from the host (index.js sets it from sdk.substitute): the player is never who takes the initiative.
let personaReader = () => '';
export function setPersonaReader(reader) { personaReader = typeof reader === 'function' ? reader : () => ''; }
function personaKey(given) {
    let name = given;
    if (typeof name !== 'string') { try { name = personaReader(); } catch { name = ''; } }
    const text = typeof name === 'string' ? name.trim() : '';
    return text === '{{user}}' ? '' : lineKey(cutPoints(text, 80));
}

/** {{user}}'s name as the host tells it now ('' when unknown): a pulse step stores it, so a Re-read of an older step (none stored) keeps its rule. */
export function personaName() {
    let name = '';
    try { name = personaReader(); } catch { name = ''; }
    const text = typeof name === 'string' ? name.trim() : '';
    return text === '{{user}}' ? '' : cutPoints(text, 80);
}

/** Whether `person` ({ key, name?, names? }) is {{user}}, the player's persona (`persona`: its name, else the host's reader). Never a subject for the Director. */
export function isPersona(person, persona = null) {
    const me = personaKey(persona);
    if (!me || !person) return false;
    return [person.key, person.name, ...(person.names ?? [])].some(word => typeof word === 'string' && lineKey(word) === me);
}
