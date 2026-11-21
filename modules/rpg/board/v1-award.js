// What a settled v1 fight pays the party, as the one internal call the settle makes (`rpg.board.award`): tier XP for a win, then practice for the skills the fight used.
// The numbers are worked out by code from the record (`paidOf`, pure); the call only writes them, once per settle, so a swipe, a Re-read, a middle delete, a rewind and a reload (which run the settle again) pay the same.
// The v1 Character has no XP line for the story to write, so XP needs no hold; the story's own `practice-N` line in the same reply is put back after the reply's lines by the step in fight-parts/hold-v1.js (this call runs BEFORE them, in the settle).
import { createEvaluation } from '../../data-modules/interpreter.js';
import { PRACTICE, practiceOf } from '../names.js';
import { XP_RATE, scaleXp, xpRateOf } from '../levels.js';
import { foeGroupsOf, usesOfV1, winXp } from '../combat/rewards.js';
import { hordeXp } from '../combat/horde-pay.js';
import { V1 } from '../combat/numbers.js';
import { givePractice } from '../practice-parts/give.js';
import { itemsOf } from '../practice-parts/slots.js';
import { waitShare } from './v1-away.js';
import { heroesOf, raiseToStory, writeBack } from './v1-story-facts.js';

const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const whole = value => Number.isSafeInteger(value);
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
// (the most one hero can be paid: the 100 a win is held to, at the highest XP rate, 300 %; a horde's award (marked `horde: 1`) 100 a wave, over the most waves a horde can have)
const XP_TOP = 300, XP_TOP_HORDE = XP_TOP * V1.horde.xpWaves;

/**
 * What this record pays: `{ xp: [{ module, who, xp }], uses: [{ who, skill, n }], perUse, paid, horde? }` (`horde: 1` for a horde's record), or null when nothing is paid. `xp` only for a won fight (every standing or Down hero who is not dead, at that hero's own level; the XP rate is the setup's; a horde per wave, combat/horde-pay.js),
 * `uses` for every segment (the skills used in these exchanges). `paid` is what the receipt tells: `{ xp: [{ who, xp }], practice: [{ who, skill, amount }] }` (the practice before the block's own limits).
 * `modules` maps a hero id to its Character block, `alive` the heroes that are not dead.
 */
export function paidOf(record, setup, { modules = {}, alive = new Set() } = {}) {
    const perUse = practiceOf(setup?.practice) ?? PRACTICE.perUse, rate = xpRateOf(setup?.rate) ?? XP_RATE.default;
    const groups = foeGroupsOf(record), uses = usesOfV1(record).slice(0, 40).map(use => ({ ...use, n: Math.min(use.n, 99) }));
    const xp = record?.result === 'win' ? (record.party ?? []).filter(hero => modules[hero.id] && alive.has(hero.id))
        .map(hero => ({ module: modules[hero.id], who: hero.label, xp: scaleXp(record.horde ? hordeXp(record, Number(hero.level) || 1, setup?.xpRule) : winXp(groups, Number(hero.level) || 1, setup?.xpRule), rate) })).filter(entry => entry.xp > 0) : [];
    // a companion who waited out a won fight (setup.waits, kept at open) is paid `awayXp` percent of what a hero of their level earns, when that setting was on
    if (record?.result === 'win' && Number.isInteger(setup?.awayXp)) {
        for (const wait of Array.isArray(setup.waits) ? setup.waits : []) {
            const won = record.horde ? hordeXp(record, Number(wait?.level) || 1, setup?.xpRule) : winXp(groups, Number(wait?.level) || 1, setup?.xpRule);
            const share = waitShare(scaleXp(won, rate), setup.awayXp);
            if (modules[wait?.id] && alive.has(wait.id) && share > 0) xp.push({ module: modules[wait.id], who: String(wait.label ?? wait.id), xp: share });
        }
    }
    if (!xp.length && !uses.length) return null;
    return { xp, uses, perUse, ...(record.horde ? { horde: 1 } : {}), paid: { xp: xp.map(({ who, xp: given }) => ({ who, xp: given })), practice: uses.map(use => ({ who: use.who, skill: use.skill, amount: Math.min(PRACTICE.max, perUse * use.n) })) } };
}

const topOf = payload => (payload.horde === 1 ? XP_TOP_HORDE : payload.horde === undefined ? XP_TOP : 0);
const checked = payload => (plain(payload) && Array.isArray(payload.xp) && payload.xp.length <= 99 && payload.xp.every(entry => text(entry?.module) && whole(entry.xp) && entry.xp > 0 && entry.xp <= topOf(payload))
    && Array.isArray(payload.uses) && payload.uses.length <= 40 && payload.uses.every(use => text(use?.who) && text(use?.skill) && whole(use.n) && use.n >= 1 && use.n <= 99)
    && practiceOf(payload.perUse) !== null
    && (payload.wears === undefined || (Array.isArray(payload.wears) && payload.wears.length <= 24 && payload.wears.every(wear => text(wear?.owner) && ['defence', 'weapon'].includes(wear.slot)))) ? payload : null);

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
    const heroes = heroesOf(given.xp, itemsOf(ctx.read('dataModules'), given.uses));
    const before = raiseToStory(ctx, heroes);   // NPC State's higher Level first, then the fight's XP; a level the XP gained is written back to the person
    giveXp(ctx, given.xp);
    const domain = ctx.read('dataModules'), items = itemsOf(domain, given.uses), skills = items.length ? givePractice(ctx, domain, items, given.perUse) : [];
    writeBack(ctx, heroes, before);
    // (the gear a decisive hit or miss wore, worked out by v1-wear.js: by the fight's own record, so it wears whatever the switch says now, as the soak and stats it rolled with)
    for (const wear of given.wears ?? []) ctx.call('gear.wear', { owner: wear.owner, slot: wear.slot, steps: 1, recorded: true });
    return { summary: '', narrate: false, data: { awarded: { xp: given.xp.length, practice: skills.length } } };
}
