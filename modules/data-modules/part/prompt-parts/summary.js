// Writes one module's state, and every active module's, as plain words for the prompt's tail.
import { dmHidden } from '../../schema.js';
import { activeDefinition, inputsOf } from '../../adapters.js';
import { cutAt } from '../../../../core/text.js';
import { roleTail } from '../../../rpg/tail.js';
import { moduleView } from '../views.js';
import { shownText } from './field-words.js';
import { fieldText, fieldsText } from './field-lines.js';
import { tailRoom } from './tail-room.js';

/**
 * One module's state in plain words for the prompt's tail, at most 100 tokens (300 for a block with a role, written compact): "Survival — Wessel: hunger 12; fatigue 6."
 * `rpg` (default on) is the RPG feature: with it off a block with a role gets the ordinary line, which leaves out its hidden fields as well.
 */
export function summaryOf(state, module, { rpg = true } = {}) {
    const definition = activeDefinition(state, module);
    if (!definition) return `${module} — unavailable (damaged or unknown pin).`;
    const view = moduleView(state, { module });
    let waiting = '';
    try { const inputs = inputsOf(state, definition); if (definition.timers.some(timer => inputs[timer.clock]?.minutes == null)) waiting = ' Waiting for story time.'; } catch { waiting = ' Waiting.'; }
    // A block with a role is written compact (lean-rpg/tail.js): defaults and empty slots left out, one line per skill; nothing to say, no line.
    if (rpg && definition.role) {
        const people = definition.scope === 'chat' ? [{ name: definition.name, fields: view.chat }] : view.characters.map(({ id, name, ...fields }) => ({ name, fields }));
        const line = roleTail(definition, people, { hidden: key => dmHidden(definition.state[key]), text: (key, value) => fieldText(definition, key, value),
            named: (key, value) => shownText(definition.state[key], value) });
        return line && cutAt(`${line}${waiting}`, tailRoom(definition, rpg, view.chat) * 4);
    }
    const limit = tailRoom(definition, rpg) * 4;
    const room = limit - definition.name.length - 4 - waiting.length;
    const body = definition.scope === 'chat' ? fieldsText(definition, view.chat, room)
        : view.characters.map(({ id, name, ...fields }) => `${name}: ${fieldsText(definition, fields, Math.floor(room / view.characters.length) - name.length - 2)}`).join(' | ') || 'no one attached';
    // The host estimates tokens from UTF-16 length; cut on a character boundary within that budget.
    return cutAt(`${definition.name} — ${body}.${waiting}`, limit);
};
// The character sheets and the Foes block go first (with the RPG on): the tail is cut from its end when the context is tight, and what the narrator
// must keep true after a fight (a character's Health, the foes standing) must outlast the pack's zero-valued counters. Pin order otherwise.
const FIRST_ROLES = new Set(['character', 'foes']);
const tailLines = (state, rpg) => {
    const modules = Object.keys(state?.domains?.dataModules?.active ?? {});
    const first = rpg ? modules.filter(module => FIRST_ROLES.has(activeDefinition(state, module)?.role)) : [];
    return [...first, ...modules.filter(module => !first.includes(module))].map(module => summaryOf(state, module, { rpg }));
};

export { tailLines };
