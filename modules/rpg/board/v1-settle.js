// Turns a played v1 fight into what the port's settle records: the full result (the envelope plus the fields the readers of `data.v2.result` ask for) and the calls that write it.
// Pure: it reads the sheet the fight started from and the played record. The calls are made by the core's settle: the party's new bars, then the ended groups cleared.
import { BOARD_AWARD as AWARD, BOARD_CLEAR_FOES as CLEAR_FOES, BOARD_HURTS as HURTS } from '../names.js';
import { envelopeOf } from '../combat/envelope.js';
import { foeGroupsOf, legendOf } from '../combat/rewards.js';
import { paidOf } from './v1-award.js';

/** `{ v: 1, key, practice, rules, …envelope }` (`board.v1` marks the engine; `cleared` lists the groups of an ended fight, whatever the outcome). `where`: `{ sheet, groups }`. */
export function fightResultV1(setup, record, { sheet, groups }) {
    const modules = Object.fromEntries(sheet.characters.filter(character => character.v1 === true).map(character => [character.key, character.module]));
    const ended = record.result !== 'unfinished';
    const legend = legendOf(record, foeGroupsOf(record)), envelope = envelopeOf(record, { id: setup.id, groups, modules, legend, cleared: ended ? groups : [] });
    const alive = new Set(sheet.characters.filter(character => character.v1 === true && character.alive !== false).map(character => character.key));
    const pay = paidOf(record, setup, { modules, alive });
    return { v: 1, key: setup.id, practice: setup.practice, rules: structuredClone(setup.rules ?? {}), ...envelope, ...(pay ? { paid: pay.paid, award: { xp: pay.xp, uses: pay.uses, perUse: pay.perUse } } : {}) };
}

/** The calls of a settled fight: the party's new bars (the foes keep theirs in the record only), then the ended groups cleared from the Foes block. */
export function fightChangesV1(result, sheet) {
    const calls = [], hurts = result.hurts.filter(hurt => hurt.module);
    if (hurts.length) calls.push({ type: HURTS, payload: { hurts: hurts.map(hurt => ({ module: hurt.module, field: hurt.field, to: hurt.to })) } });
    if (result.award) calls.push({ type: AWARD, payload: structuredClone(result.award) });
    if (result.cleared?.length) {
        const foes = sheet.foes.filter(foe => foe.filled && result.cleared.includes(foe.slot)).map(foe => ({ slot: foe.slot, module: foe.module, filled: true, local: foe.local }));
        if (foes.length) calls.push({ type: CLEAR_FOES, payload: { groups: foes.map(foe => foe.slot), foes } });
    }
    return calls;
}
