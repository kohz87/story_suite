// The `rpg.fight` step: pays the party for a won fight and records the awards.

import { createEvaluation } from '../../../packages/story-block/src/v2/data-modules/interpreter.js';
import { FIGHT } from '../names.js';
import { XP_RATE, clampLevel, scaleXp, xpRateOf } from '../levels.js';
import { levelOfClass } from '../formula.js';
import { readSheet } from '../read.js';
import { CLAIM, isObject, slotsOf, whole } from './shared-values.js';
import { memberLevel } from './levels.js';
import { fightOf, groupsOf } from './won.js';
import { memberXp, outnumberedMultiplier } from './xp-amount.js';
import { fightWitness, fromOf, paidOf } from './witness.js';

/** Said once in a reply where the narrator wrote XP for a won fight (a Problems line). */
export const FIGHT_XP_HELD = 'XP for the fight is given by code; the narrator\'s XP line was not used.';

/** What the reply's XP lines may have moved on a member's block: XP, the level (older blocks: Soul Class) and the points the level brings. */
const RISES = Object.freeze(['xp', 'soul', 'level', 'points']);

/**
 * `rpg.fight { was }`: pays the party for the fight (see the top). A system step after the reply's lines; NO_LONGER_DONE when the story it is planned on
 * no longer holds a won fight (a delete or a Re-read changed it), and the block then goes.
 */
export function fightXp(ctx, payload = {}) {
    if (ctx.cause !== 'system' || ctx.caller !== null) ctx.fail('REFUSED', 'The XP for a fight is given by Story Block after a reply, not by an action.');
    const was = slotsOf(payload?.was);
    if (payload?.bars !== undefined && payload.bars !== 2) ctx.fail('INVALID', 'The fight\'s mark was damaged.');
    const bars = payload?.bars === 2;
    if (payload?.xp !== undefined && (payload.xp !== 2 || !bars)) ctx.fail('INVALID', 'The fight\'s XP mark was damaged.');
    const flat = payload?.xp === 2;
    if (payload?.outnumbered !== undefined && payload.outnumbered !== 1) ctx.fail('INVALID', 'The fight\'s outnumbered mark was damaged.');
    const outnumbered = payload?.outnumbered === 1;
    if (payload?.gone !== undefined && payload.gone !== 1) ctx.fail('INVALID', 'The fight\'s clear mark was damaged.');
    const gone = payload?.gone === 1;
    // (a cleared fight carries its own board resolve's claim: the clear emptied the block, so the win stands only while that resolve does)
    if (gone !== (payload?.claim !== undefined) || (gone && !CLAIM.test(payload.claim))) ctx.fail('INVALID', 'The fight\'s clear mark was damaged.');
    const rate = payload?.rate === undefined ? XP_RATE.default : xpRateOf(payload.rate);
    if (rate === null) ctx.fail('INVALID', 'The XP rate of the fight was damaged.');
    if (!was.length) ctx.fail('INVALID', 'The XP for a fight needs the groups it was fought against.');
    const domain = ctx.read('dataModules');
    const sheet = readSheet({ domains: { dataModules: domain } });
    const given = payload?.groups === undefined ? null : groupsOf(payload.groups, was);
    if (payload?.groups !== undefined && !given) ctx.fail('INVALID', 'The groups of the fight were damaged.');
    // (`gone: 1`: the claim of this reply's board resolve is held while that resolve stands, and not otherwise (a delete or a Re-read took the fight back); claiming it here would only
    // be new if the resolve were absent, and the failure drops that)
    if (gone && ctx.claim(payload.claim)) ctx.fail('NO_LONGER_DONE', 'The fight on the board this XP was for was taken back.');
    const fight = given ? { won: true, groups: given } : fightOf(sheet, was);
    if (!fight.won) ctx.fail('NO_LONGER_DONE', 'No won fight is left to give XP for on this story.');
    const from = fromOf(domain, ctx.source);
    const multiplier = outnumbered ? outnumberedMultiplier(fight.groups, sheet.characters.length) : 1;
    const witness = fightWitness(sheet, domain, ctx.source, { was, groups: given, ...(outnumbered ? { outnumbered: 1 } : {}) });
    const predicate = { kind: FIGHT, ...(bars ? { bars: 2 } : {}), ...(flat ? { xp: 2 } : {}), ...(outnumbered ? { outnumbered: 1 } : {}), ...(gone ? { gone: 1 } : {}) };
    ctx.replayGuard({ owner: ctx.module, version: 2, epoch: ctx.epoch, rulesHash: null, predicate, inputHash: ctx.hash({ source: ctx.source, predicate, witness }) }, { was, ...(given ? { groups: given } : {}), ...(bars ? { bars: 2 } : {}), ...(flat ? { xp: 2 } : {}), ...(outnumbered ? { outnumbered: 1 } : {}), ...(gone ? { gone: 1, claim: payload.claim } : {}), ...(rate !== XP_RATE.default ? { rate } : {}) });
    const draft = ctx.draft('dataModules');
    const awards = [];
    for (const character of paidOf(sheet)) {
        const definition = draft.pins?.[draft.active?.[character.module]?.hash]?.definition;
        const fields = draft.instances?.[character.module]?.chat?.fields;
        if (!isObject(fields) || !whole(fields.xp)) continue;
        // What the story added to this member's xp, soul and points in this reply (the narrator's XP line and its rise) is not used.
        const kept = from[character.module];
        const keys = RISES.filter(key => whole(kept?.[key]) && key in fields);
        // (a marked fight has no narrator XP to hold back: a story line cannot add XP to a marked character at all)
        const held = !bars && Boolean(kept) && keys.some(key => fields[key] !== kept[key]);
        const instance = draft.instances[character.module].chat;
        // The fight pays at the level the member had before this reply's own (held back) XP line raised it.
        const before = held ? (whole(kept.level) ? clampLevel(kept.level) : whole(kept.soul) ? levelOfClass(kept.soul) : null) : null;
        const xp = scaleXp(memberXp(fight.groups, before ?? memberLevel(character), bars, flat, multiplier), rate);
        if (isObject(definition?.state) && Array.isArray(definition.rules)) {
            const evaluation = createEvaluation(definition, instance, { inputs: {}, source: {}, cursor: null, subject: 'chat' });
            if (held) evaluation.effects(keys.map(key => ({ op: 'set', path: [key], value: kept[key] })));
            if (xp > 0) evaluation.effects([{ op: 'add', path: ['xp'], value: xp, bounds: 'clamp' }]);
            evaluation.rules();
            evaluation.finish();
        } else {
            // A bare block (no pinned rules to run): XP only, held to 0–100.
            if (held) Object.assign(fields, Object.fromEntries(keys.map(key => [key, kept[key]])));
            fields.xp = Math.max(0, Math.min(100, fields.xp + xp));
        }
        if (xp > 0 || held) awards.push({ who: character.who, module: character.module, xp, ...(held ? { held: true } : {}) });
    }
    const held = awards.some(award => award.held);
    return {
        summary: `Fight won: ${awards.filter(award => award.xp > 0).map(award => `${award.who} +${award.xp} XP`).join(', ') || 'no XP to give'}${multiplier > 1 ? ` (outnumbered ×${multiplier})` : ''}.`, narrate: false, replan: true,
        data: { v2: { result: { fight: { lv: 1, ...(bars ? { bars: 2 } : {}), ...(flat ? { xp: 2 } : {}), ...(outnumbered ? { outnumbered: 1, multiplier } : {}), ...(rate !== XP_RATE.default ? { rate } : {}), groups: fight.groups, awards } } } },
        ...(held ? { problem: FIGHT_XP_HELD } : {}),
    };
}
