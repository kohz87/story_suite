// The queries: `rpg.sheet` and `party.levels` as fallbacks, `party.actors`, `party.pc` and `party.newCharacter` as the plain owner, and `textRpg.view`.
import { FEATURE } from './constants.js';
import { lastDice } from './dice-source.js';
import { active } from './active.js';
import { DOMAIN } from '../domain/shape.js';
import { minutesOf } from './conditions.js';
import { rowOf } from './sheet-row.js';
import { levelOf } from './standing.js';

const NEW_CHARACTER = 'text-rpg/new-character';

const membersOf = state => Object.values(state?.domains?.[DOMAIN]?.members ?? {}).filter(member => !member.fallen).sort((a, b) => Number(b.pc) - Number(a.pc));

/** The queries for registerModule; all answer null while Text RPG is not active (`sdk.feature` says). */
export function queriesOf(sdk) {
    const gate = (answer, extra = {}) => Object.assign((state, args, tools) => (active(sdk) ? answer(state, args, tools) : null), { feature: FEATURE, ...extra });
    return {
        'rpg.sheet': gate(state => {
            const now = minutesOf(state);
            return membersOf(state).map(member => rowOf(member, now));
        }, { fallback: true }),
        // The plain answer for the Party tab's Create character: the screen to open while no member is the reader's, else null.
        'party.newCharacter': gate(state => (membersOf(state).some(member => member.pc) ? null : NEW_CHARACTER)),
        // The main character: the reader's own member, as a plain answer (the RPG's roster answers as a fallback when this is null).
        'party.pc': gate(state => { const pc = membersOf(state).find(member => member.pc); return pc ? { id: pc.id } : null; }),
        'party.levels': gate(state => membersOf(state).map(member => ({ id: member.id, name: member.name, level: levelOf(member), left: false })), { fallback: true }),
        'party.actors': gate(state => membersOf(state).map(member => ({ id: member.id, name: member.name, ...(member.pc ? { pc: true } : {}) }))),
        // The dice of the latest dice step (drawn before the reply being written), or null.
        'textRpg.dice': gate((state, args, tools) => lastDice(tools?.receipts?.())),
        'textRpg.view': gate(state => {
            const members = membersOf(state);
            const pc = members.find(member => member.pc);
            return { pcId: pc?.id ?? null, members: members.map(member => rowOf(member, minutesOf(state))), ...(pc ? {} : { newCharacterScreen: NEW_CHARACTER }) };
        }),
    };
}
