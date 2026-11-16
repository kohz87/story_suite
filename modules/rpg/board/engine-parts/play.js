// Plays a sequence of board exchanges on a private copy of the sheet (the saved setup and choices).
import { applyGear, noteGear } from '../../gear.js';
import { readSheet } from '../../read.js';
import { hasLevels, isStandard } from '../../rules.js';
import { prepareStandard, rollStandard, summaryStd } from '../../standard.js';
import { boardDice } from '../dice.js';
import { fleeRoll } from '../flee.js';
import { memberRolls } from '../member-rolls.js';
import { boardFoes, collapseFoes, splitFoes } from '../members.js';
import { areaGroupName } from '../order.js';
import { exchangePlan, standing } from '../plan.js';
import { maxOf } from '../rules.js';
import { boardWitness } from './witness.js';
import { equipmentForBoard, stagingWear } from './equipment.js';
import { openingOrder, useItem, weaponSides } from './exchange-steps.js';
import { applyHurts, collapseMoves } from './hurts.js';

/** Run the saved setup and choices; errors leave the caller's state untouched. */
export function playBoard(state, setup, exchanges) {
    if (!state?.domains?.dataModules || !Number.isInteger(setup?.seed) || setup.seed < 0 || setup.seed > 0xFFFFFFFF || !isStandard(setup?.rules)
        || !Number.isInteger(setup.offset) || setup.offset < 0 || !Array.isArray(exchanges) || exchanges.length > 99) return { error: 'The fight setup is damaged.' };
    if (setup.invalidated) return { error: 'The earlier fight was taken back. Restore that reply or discard this fight.' };
    if (setup.witness?.offset === setup.offset && setup.witness.hash !== boardWitness(state, setup))
        return { error: 'The sheet or gear changed after the fight was rolled. Restore it or discard the fight (Fight tab, Discard fight).' };
    const bars = setup.bars === 2, soak = setup.soak === 1;
    if (setup.soak !== undefined && !(soak && bars)) return { error: 'The fight setup is damaged.' };
    if (setup.bars !== undefined && !(bars && readSheet(state).characters.every(actor => actor.scale === 2))) return { error: 'The sheet changed after the fight was rolled. Restore it or discard the fight (Fight tab, Discard fight).' };
    const copy = structuredClone(state), domain = copy.domains.dataModules, rules = setup.rules, limits = maxOf(domain);
    const startSheet = readSheet(copy), members = setup.members === 1, realFoes = members ? startSheet.foes : null;
    const hard = setup.foesHard === 1, six = setup.foesSix === 1, boardFoeList = members ? splitFoes(realFoes, { carried: setup.carriedMembers, maxOf: limits, six }) : null;
    const virtual = (boardFoeList ?? []).filter(foe => Number.isInteger(foe.group));
    const virtualSlots = new Set(virtual.map(foe => foe.slot)), virtualGroups = new Set(virtual.map(foe => foe.group));
    const values = members ? new Map(boardFoeList.map(foe => [foe.slot, foe.hurt])) : null;
    const rounds = [], opening = [], quickStart = [], idle = [], moved = new Map(), refused = [], wear = [], itemsUsed = [];
    let order = setup.order ?? null, stop = 'open';
    for (const [at, choices] of exchanges.entries()) {
        if (stop !== 'open') return { error: 'The fight has already ended.' };
        const equipment = setup.gear ? equipmentForBoard(copy, setup.gear) : { gear: setup.gear, weapons: setup.weapons };
        const number = setup.offset + at + 1;
        let sheet = applyGear(readSheet(copy), equipment.gear);
        const fightOf = base => (members ? { ...base, foes: boardFoeList.map(foe => ({ ...foe, hurt: values.get(foe.slot) })) } : base);
        let fightSheet = fightOf(sheet);
        const built = exchangePlan(fightSheet, choices?.actions, setup.flags, number, { members, aoe: setup.aoe === 1, areaAll: setup.areaAll === 1 && setup.aoe === 1, bars, hard });
        if (built.error) return { error: built.error };
        // Items first: each restores on the copy, so the foes' attacks and defences that follow see the new bars.
        const itemLines = [];
        for (const item of built.items ?? []) {
            const done = useItem(copy, item, number);
            if (done.error) return { error: done.error };
            itemLines.push(done.line);
            itemsUsed.push(done.used);
            if (done.move) moved.set(done.move.id, { ...done.move, from: moved.get(done.move.id)?.from ?? done.move.from });
        }
        if (itemLines.length) { sheet = applyGear(readSheet(copy), equipment.gear); fightSheet = fightOf(sheet); }
        const standingGroups = real => (boardFoeList ?? []).some(foe => (Number.isInteger(foe.group) ? foe.group : foe.slot) === real.slot && values.get(foe.slot) > 0);
        const fleeFoes = members ? realFoes.filter(standingGroups) : sheet.foes;
        const source = boardDice(setup.seed, number), flee = built.flee ? fleeRoll(built.flee, fleeFoes, rules, source('flee', 0), { hard }) : null;
        if (flee && flee.outcome !== 'fail') {
            rounds.push({ n: number, decisive: false, lines: [...itemLines, flee] });
            stop = 'fled';
            continue;
        }
        const hooks = members ? memberRolls(built.plan) : null;
        const prepared = prepareStandard(built.plan, fightSheet, rules, { maxOf: limits, lv: hasLevels(rules), fix: true, then: true, memberRolls: hooks, hard });
        weaponSides(prepared, fightSheet, equipment.weapons);
        const rolled = rollStandard(built.plan, prepared, source, rules, { carried: order, flow: 2, fix: true, then: true, board: true, scaled: bars, soak, hard, memberRolls: hooks, ...(number === 1 && setup.drop ? { drop: setup.drop } : {}) });
        const lines = rolled.rounds[0]?.lines ?? [];
        for (const line of lines) if (line.aoe) line.aoeName = areaGroupName(realFoes.find(foe => foe.slot === line.aoeGroup));
        if (equipment.gear) {
            noteGear([...rolled.opening, ...lines], equipment.gear);
            wear.push(...stagingWear(copy, equipment.gear, { opening: rolled.opening, rounds: [{ n: number, lines }], rules }));
        }
        rounds.push({ n: number, decisive: rolled.rounds[0]?.decisive === true, lines: [...itemLines, ...(flee ? [flee] : []), ...lines], ...(rolled.rounds[0]?.idle?.length ? { idle: rolled.rounds[0].idle } : {}) });
        opening.push(...rolled.opening);
        quickStart.push(...rolled.quickStart);
        idle.push(...rolled.idle);
        refused.push(...prepared.refused);
        order = rolled.order;
        const virtualHurt = hurt => {
            const foe = /^f:(\d+)$/u.exec(hurt.id);
            return Boolean(foe && virtualSlots.has(Number(foe[1])));
        };
        applyHurts(domain, members ? rolled.hurts.filter(hurt => !virtualHurt(hurt)) : rolled.hurts);
        for (const hurt of rolled.hurts) {
            const previous = moved.get(hurt.id);
            moved.set(hurt.id, { ...hurt, from: previous?.from ?? hurt.from });
            const member = /^f:(\d+)$/u.exec(hurt.id);
            if (values && member && values.has(Number(member[1]))) values.set(Number(member[1]), hurt.to);
        }
        if (rolled.stop === 'won' || rolled.stop === 'lost') stop = rolled.stop;
    }
    let hurts = [...moved.values()].filter(hurt => hurt.from !== hurt.to);
    if (members) {
        hurts = hurts.filter(hurt => {
            const foe = /^f:(\d+)$/u.exec(hurt.id);
            return !(foe && virtualSlots.has(Number(foe[1])));
        });
    }
    if (members && stop !== 'open') {
        const collapsed = collapseMoves(realFoes, collapseFoes(realFoes.filter(foe => virtualGroups.has(foe.slot)), values, { maxOf: limits, six }), limits);
        hurts = [...hurts, ...collapsed];
        applyHurts(domain, collapsed);
    }
    if (members && !exchanges.length) {
        const equipment = setup.gear ? equipmentForBoard(copy, setup.gear) : { gear: setup.gear, weapons: setup.weapons };
        const sheet = applyGear(readSheet(copy), equipment.gear);
        const fightSheet = { ...sheet, foes: boardFoeList.map(foe => ({ ...foe, hurt: values.get(foe.slot) })) };
        order = openingOrder(copy, setup, fightSheet, rules);
    }
    const result = { ...(bars ? { bars: 2 } : {}), ...(six ? { foesSix: 1 } : {}), ...(hard ? { foesHard: 1 } : {}), ...(soak ? { soak: 1 } : {}), rounds, opening, order: order ?? [], quickStart, idle, hurts, refused, stop, ...(setup.opening ? { fromApproach: true } : {}), ...(setup.approach ? { checks: structuredClone(setup.approach) } : {}), ...(wear.length ? { wear } : {}), ...(itemsUsed.length ? { items: itemsUsed } : {}),
        summary: summaryStd([], rounds, refused) };
    if (members) result.members = boardFoes(realFoes, values, { maxOf: limits, carried: setup.carriedMembers, six, ...(hard ? { hard, party: readSheet(copy).characters.filter(standing).length, round: setup.offset + exchanges.length + 1 } : {}) });
    return { state: copy, result };
}
