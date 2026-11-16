// What a settled v1 fight pays the party, as the one internal call the settle makes (`rpg.board.award`): tier XP for a win, then practice for the skills the fight used.
// The numbers are worked out by code from the record (`paidOf`, pure); the call only writes them, once per settle, so a swipe, a Re-read, a middle delete, a rewind and a reload (which run the settle again) pay the same.
// A narrator's own XP or practice line in the same reply is put back first, as the old fight's XP and practice steps did (one Problems line says so).
import { createEvaluation } from '../../data-modules/interpreter.js';
import { PRACTICE, practiceOf } from '../names.js';
import { XP_RATE, scaleXp, xpRateOf } from '../levels.js';
import { foeGroupsOf, usesOfV1, winXp } from '../combat/rewards.js';
import { FIGHT_XP_HELD } from '../fight-parts/step.js';
import { fromOf } from '../fight-parts/witness.js';
import { PRACTICE_HELD, givePractice } from '../practice-parts/give.js';
import { itemsOf } from '../practice-parts/slots.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const whole = value => Number.isSafeInteger(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const RISES = Object.freeze(['xp', 'level', 'points']);

/**
 * What this record pays: `{ xp: [{ module, who, xp }], uses: [{ who, skill, n }], perUse, paid }`, or null when nothing is paid. `xp` only for a won fight (every standing or Down hero who is not dead, at that hero's own level; the XP rate is the setup's),
 * `uses` for every segment (the skills used in these exchanges). `paid` is what the receipt tells: `{ xp: [{ who, xp }], practice: [{ who, skill, amount }] }` (the practice before the block's own limits).
 * `modules` maps a hero id to its Character block, `alive` the heroes that are not dead.
 */
export function paidOf(record, setup, { modules = {}, alive = new Set() } = {}) {
    const perUse = practiceOf(setup?.practice) ?? PRACTICE.perUse, rate = xpRateOf(setup?.rate) ?? XP_RATE.default;
    const groups = foeGroupsOf(record), uses = usesOfV1(record).slice(0, 40);
    const xp = record?.result === 'win' ? (record.party ?? []).filter(hero => modules[hero.id] && alive.has(hero.id))
        .map(hero => ({ module: modules[hero.id], who: hero.label, xp: scaleXp(winXp(groups, Number(hero.level) || 1), rate) })).filter(entry => entry.xp > 0) : [];
    if (!xp.length && !uses.length) return null;
    return { xp, uses, perUse, paid: { xp: xp.map(({ who, xp: given }) => ({ who, xp: given })), practice: uses.map(use => ({ who: use.who, skill: use.skill, amount: Math.min(PRACTICE.max, perUse * use.n) })) } };
}

const checked = payload => (plain(payload) && Array.isArray(payload.xp) && payload.xp.length <= 99 && payload.xp.every(entry => text(entry?.module) && whole(entry.xp) && entry.xp > 0 && entry.xp <= 100)
    && Array.isArray(payload.uses) && payload.uses.length <= 40 && payload.uses.every(use => text(use?.who) && text(use?.skill) && whole(use.n) && use.n >= 1 && use.n <= 99)
    && practiceOf(payload.perUse) !== null ? payload : null);

function giveXp(ctx, domain, awards) {
    const from = fromOf(domain, ctx.source), draft = ctx.draft('dataModules');
    let held = false;
    for (const award of awards) {
        const definition = draft.pins?.[draft.active?.[award.module]?.hash]?.definition, fields = draft.instances?.[award.module]?.chat?.fields;
        if (!plain(fields) || !whole(fields.xp)) continue;
        const kept = from[award.module], keys = RISES.filter(key => whole(kept?.[key]) && key in fields && fields[key] !== kept[key]);
        if (keys.length) held = true;
        if (plain(definition?.state) && Array.isArray(definition.rules)) {
            const evaluation = createEvaluation(definition, draft.instances[award.module].chat, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
            if (keys.length) evaluation.effects(keys.map(key => ({ op: 'set', path: [key], value: kept[key] })));
            evaluation.effects([{ op: 'add', path: ['xp'], value: award.xp, bounds: 'clamp' }]);
            evaluation.rules();
            evaluation.finish();
        } else {
            if (keys.length) Object.assign(fields, Object.fromEntries(keys.map(key => [key, kept[key]])));
            fields.xp = Math.max(0, fields.xp + award.xp);
        }
    }
    return held;
}

/** `rpg.board.award { xp, uses, perUse }`: internal, called only by the fight kind's settle. */
export function awardCommand(ctx, payload) {
    const given = checked(payload);
    if (!given) ctx.fail('INVALID', 'The fight\'s awards are damaged.');
    const domain = ctx.read('dataModules');
    const heldXp = giveXp(ctx, domain, given.xp);
    const items = itemsOf(domain, given.uses), skills = items.length ? givePractice(ctx, ctx.read('dataModules'), items, given.perUse) : [];
    const heldPractice = skills.some(entry => entry.held);
    return { summary: '', narrate: false, data: { awarded: { xp: given.xp.length, practice: skills.length } }, ...(heldXp || heldPractice ? { problem: heldXp ? FIGHT_XP_HELD : PRACTICE_HELD } : {}) };
}
