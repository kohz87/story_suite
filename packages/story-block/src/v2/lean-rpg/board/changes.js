// The fight's two writes to the Foes block, as internal commands the settle calls (the kind lists them in its `changes`).
// They only apply what the kind's own play worked out: the foes' new bars, and the groups of an ended fight leaving the block.
import { BOARD_CLEAR_FOES as CLEAR_FOES, BOARD_HURTS as HURTS } from '../names.js';
import { applyHurts, clearFoes } from './engine.js';

const whole = value => Number.isFinite(value) && value >= 0;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

const hurtsOf = payload => (Array.isArray(payload?.hurts) && payload.hurts.length <= 99
    && payload.hurts.every(hurt => text(hurt?.module) && text(hurt?.field) && whole(hurt?.to)) ? payload.hurts : null);
const foesOf = payload => (Array.isArray(payload?.groups) && payload.groups.length > 0 && payload.groups.length <= 64 && payload.groups.every(slot => Number.isSafeInteger(slot) && slot >= 1 && slot <= 64)
    && Array.isArray(payload.foes) && payload.foes.length <= 64 && payload.foes.every(foe => foe?.filled === true && Number.isSafeInteger(foe.slot) && text(foe.module)
        && (foe.local === undefined || Number.isSafeInteger(foe.local))) ? payload : null);

/** `{ 'rpg.board.hurts': { hurts: [{ module, field, to }] }, 'rpg.board.clearFoes': { groups, foes: [{ slot, module, local, filled }] } }`; both are internal (no screen calls them). */
export function boardChangeCommands() {
    return {
        [HURTS]: Object.assign((ctx, payload) => {
            const hurts = hurtsOf(payload);
            if (!hurts) ctx.fail('INVALID', 'The foes\' new bars are damaged.');
            applyHurts(ctx.draft('dataModules'), hurts);
            return { summary: '', narrate: false, data: { hurts: hurts.length } };
        }, { internal: true }),
        [CLEAR_FOES]: Object.assign((ctx, payload) => {
            const checked = foesOf(payload);
            if (!checked) ctx.fail('INVALID', 'The fight\'s ended groups are damaged.');
            const cleared = clearFoes(ctx.draft('dataModules'), checked.foes, checked.groups);
            return { summary: '', narrate: false, data: { cleared } };
        }, { internal: true }),
    };
}
