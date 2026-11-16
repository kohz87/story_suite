// What a settled v1 fight pays the party, as the one internal call the settle makes (`rpg.board.award`): tier XP for a win, then practice for the skills the fight used.
// The numbers are worked out by code from the record (`paidOf`, pure); the call only writes them, once per settle, so a swipe, a Re-read, a middle delete, a rewind and a reload (which run the settle again) pay the same.
// The v1 Character has no XP line for the story to write, so XP needs no hold; the story's own `practice-N` line in the same reply is put back after the reply's lines by the step in fight-parts/hold-v1.js (this call runs BEFORE them, in the settle).
import { createEvaluation } from '../../data-modules/interpreter.js';
import { PRACTICE, practiceOf } from '../names.js';
import { XP_RATE, scaleXp, xpRateOf } from '../levels.js';
import { foeGroupsOf, usesOfV1, winXp } from '../combat/rewards.js';
import { givePractice } from '../practice-parts/give.js';
import { itemsOf } from '../practice-parts/slots.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const whole = value => Number.isSafeInteger(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
// (the most one hero can be paid: the 60 a win is held to, at the highest XP rate, 300 %)
const XP_TOP = 180;

/**
 * What this record pays: `{ xp: [{ module, who, xp }], uses: [{ who, skill, n }], perUse, paid }`, or null when nothing is paid. `xp` only for a won fight (every standing or Down hero who is not dead, at that hero's own level; the XP rate is the setup's),
 * `uses` for every segment (the skills used in these exchanges). `paid` is what the receipt tells: `{ xp: [{ who, xp }], practice: [{ who, skill, amount }] }` (the practice before the block's own limits).
 * `modules` maps a hero id to its Character block, `alive` the heroes that are not dead.
 */
export function paidOf(record, setup, { modules = {}, alive = new Set() } = {}) {
    const perUse = practiceOf(setup?.practice) ?? PRACTICE.perUse, rate = xpRateOf(setup?.rate) ?? XP_RATE.default;
    const groups = foeGroupsOf(record), uses = usesOfV1(record).slice(0, 40).map(use => ({ ...use, n: Math.min(use.n, 99) }));
    const xp = record?.result === 'win' ? (record.party ?? []).filter(hero => modules[hero.id] && alive.has(hero.id))
        .map(hero => ({ module: modules[hero.id], who: hero.label, xp: scaleXp(winXp(groups, Number(hero.level) || 1), rate) })).filter(entry => entry.xp > 0) : [];
    if (!xp.length && !uses.length) return null;
    return { xp, uses, perUse, paid: { xp: xp.map(({ who, xp: given }) => ({ who, xp: given })), practice: uses.map(use => ({ who: use.who, skill: use.skill, amount: Math.min(PRACTICE.max, perUse * use.n) })) } };
}

const checked = payload => (plain(payload) && Array.isArray(payload.xp) && payload.xp.length <= 99 && payload.xp.every(entry => text(entry?.module) && whole(entry.xp) && entry.xp > 0 && entry.xp <= XP_TOP)
    && Array.isArray(payload.uses) && payload.uses.length <= 40 && payload.uses.every(use => text(use?.who) && text(use?.skill) && whole(use.n) && use.n >= 1 && use.n <= 99)
    && practiceOf(payload.perUse) !== null ? payload : null);

function giveXp(ctx, awards) {
    const draft = ctx.draft('dataModules');
    for (const award of awards) {
        const definition = draft.pins?.[draft.active?.[award.module]?.hash]?.definition, fields = draft.instances?.[award.module]?.chat?.fields;
        if (!plain(fields) || !whole(fields.xp)) continue;
        if (plain(definition?.state) && Array.isArray(definition.rules)) {
            const evaluation = createEvaluation(definition, draft.instances[award.module].chat, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
            evaluation.effects([{ op: 'add', path: ['xp'], value: award.xp, bounds: 'clamp' }]);
            evaluation.rules();
            evaluation.finish();
        } else fields.xp = Math.max(0, fields.xp + award.xp);
    }
}

/** `rpg.board.award { xp, uses, perUse }`: internal, called only by the fight kind's settle. */
export function awardCommand(ctx, payload) {
    const given = checked(payload);
    if (!given) ctx.fail('INVALID', 'The fight\'s awards are damaged.');
    giveXp(ctx, given.xp);
    const domain = ctx.read('dataModules'), items = itemsOf(domain, given.uses), skills = items.length ? givePractice(ctx, domain, items, given.perUse) : [];
    return { summary: '', narrate: false, data: { awarded: { xp: given.xp.length, practice: skills.length } } };
}
