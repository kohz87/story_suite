// The `rpg.check` step (checks and their practice in one guarded step) and its replay guard.
import { CHECK_STEP } from '../names.js';
import { fold, readSheet } from '../read.js';
import { workChecks } from '../checks/result.js';
import { isObject } from './shared-values.js';
import { slotOf, fromOf, itemsOf, witnessOf } from './slots.js';
import { PRACTICE_HELD, givePractice } from './give.js';
import { membersOf, membersWitness } from './members.js';
import { inputOf } from './checks-record.js';

// A narrator's practice line can rank up a skill before the check step runs. That line is undone for a checked skill, so use its previous rank when working the check as well.
function sheetBeforePractice(sheet, domain, source, spent = []) {
    const from = fromOf(domain, source);
    return { ...sheet, characters: sheet.characters.map(character => ({ ...character, skills: character.skills.map(skill => {
        const paid = spent.some(entry => fold(entry.who) === fold(character.who) && fold(entry.skill) === fold(skill.name));
        const slot = slotOf(domain, character.who, skill.name), was = !paid && slot && from[slot.module]?.[String(slot.slot)];
        return was ? { ...skill, rank: was.rank } : skill;
    }) })) };
}

/** `rpg.check`: works the checks and their practice in one guarded step. Older records without `practice` keep their separate practice step. */
export function checkStep(ctx, payload = {}) {
    if (ctx.cause !== 'system' || ctx.caller !== null) ctx.fail('REFUSED', 'Story checks are recorded by Story Block after a reply, not by an action.');
    const input = inputOf(payload);
    if (!input) ctx.fail('INVALID', 'The check step needs the reply\'s roll lines and its recorded dice.');
    const domain = ctx.read('dataModules'), sheet = readSheet({ domains: { dataModules: domain } });
    const checked = input.practice ? sheetBeforePractice(sheet, domain, ctx.source, input.spent) : sheet;
    const { results, notes, uses } = workChecks(membersOf({ query: (name, args) => ctx.query(name, args) }, checked), input.lines, input.dice, input.table ?? null);
    const predicate = { kind: CHECK_STEP, input: ctx.hash(input), ...(input.practice ? { uses } : {}) };
    const witness = input.practice ? { members: membersWitness(sheet), practice: witnessOf(domain, ctx.source, uses) } : membersWitness(sheet);
    ctx.replayGuard({ owner: ctx.module, version: 2, epoch: ctx.epoch, rulesHash: null, predicate, inputHash: ctx.hash({ source: ctx.source, predicate, witness }) }, input);
    const skills = input.practice ? givePractice(ctx, domain, itemsOf(domain, uses), input.dice?.perUse, input.spent) : [];
    const note = [...[...notes, ...(skills.some(entry => entry.held) ? [PRACTICE_HELD] : [])].join(' ')].slice(0, 300).join('');
    return { summary: '', narrate: false, replan: true, data: { v2: { checks: { v: 1, results }, ...(input.practice ? { result: { practice: { skills } } } : {}) } }, ...(note ? { problem: note } : {}) };
}

/** The replay guard of `rpg.check` (leanRpgGuard routes it here): the results stand while the party's sheet is what the prefix held when they were worked. */
export function checkGuard({ state, hash }, { guard, source, recorded }) {
    const bad = reason => ({ ok: false, reason });
    try {
        const predicate = guard?.predicate;
        if (guard?.version !== 2 || guard.rulesHash !== null || !isObject(predicate) || predicate.kind !== CHECK_STEP || !isObject(recorded)) return bad('Malformed check guard.');
        const input = inputOf(recorded);
        if (!input || hash(input) !== predicate.input) return bad('The check step\'s record was damaged.');
        if (input.practice && !Array.isArray(predicate.uses)) return bad('The check step\'s practice record was damaged.');
        const sheet = readSheet(state), witness = input.practice ? { members: membersWitness(sheet), practice: witnessOf(state.domains?.dataModules, source, predicate.uses) } : membersWitness(sheet);
        if (hash({ source, predicate, witness }) !== guard.inputHash) return bad('The party or a skill before these checks changed; Re-read this reply.');
        return { ok: true };
    } catch { return bad('Damaged check record.'); }
}
