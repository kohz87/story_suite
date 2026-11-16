// Shared calendar fixture, timestamp and planner answer for planner-*.test.js.
import { makeCalendar } from '../src/calendar.js';

export const calendar = makeCalendar({
    preset: 'custom',
    era: 'CY',
    months: ['Dawnwane', 'Rainmoot', 'Greengale', 'Highsun', 'Goldwane', 'Haywane',
        'Emberwane', 'Nightfall', 'Frostfall', 'Deepwinter', 'Icewane', 'Yearsend'],
    daysPerMonth: 30,
});
export const now = calendar.parse('CY 611, Haywane 12, 05:35 pm').abs;

// A planner answer the way models really write it: thinking first, a line of prose, then the
// block with bold labels, bullets, aliases and one line that is not a plan line.
export const ANSWER = [
    '<think>',
    'The council thread went quiet. Draft:',
    'ARC: Wrong Arc — not this one',
    'BEAT: Draft beat — not this one',
    '</think>',
    'Here is the plan for the next arc.',
    '',
    '<plan>',
    '**ARC:** The Weir Bullion — who sold the weir route, and the Council vote it decides',
    '* **BEAT:** Council session opens — the vote is called | on: in 2 days | place: Grand Hall',
    '- **BEAT:** Kade presents the corrupted core | after: Council session opens | place: Grand Hall',
    '• BEAT: Bells at the weir — the sluice fails | on: tomorrow at dusk',
    '**NPC AGENDA:** Geva — now: Bailiff Court | then: reissues the stable warrants | on: next morning',
    'AGENDA: Brant — now: frontier road with a dray | then: reaches Auvoth | arrive: Haywane 19',
    'HOOK: River stranger — who pulled Ren from the sump; finding him settles the debt',
    'CLOCK: Hollin\'s Reach graves — washed graves left undone → the first of the dead rise | due: Haywane 28, dusk | shown: none',
    '**OFF-LIMITS:** Kade\'s buyer — Kade sold the weir route to the Highmark legation',
    'The weir hums all night.',
    '</plan>',
].join('\n');
