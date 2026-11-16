// The part's afterCapture: asks for the fight step when a reply won a fight.

import { FIGHT, LEAN_RPG_FEATURE } from '../names.js';
import { XP_RATE, xpRateFrom, xpRateOf } from '../levels.js';
import { fold, readSheet } from '../read.js';
import { boardWin } from '../board/awards.js';
import { isObject } from './shared-values.js';
import { standingSlots } from './levels.js';
import { fightOf } from './won.js';
import { boardGroups, openedSlots } from './opened.js';

/** The replies whose story is paid for (the same as the reply-end steps of the blocks: not a Continue's, nor the extractor's late lines). */
const PAID_TYPES = Object.freeze(['normal', 'swipe', 'regenerate', 'reread']);

/**
 * The part's afterCapture: the step for a fight this reply won, else nothing. `view.before()` is the state before the reply (sdk.js makeView); without it
 * (a view that cannot say) nothing is asked for.
 */
export function fightHook(view, info) {
    if (!PAID_TYPES.includes(info?.type ?? 'normal') || view?.feature?.(LEAN_RPG_FEATURE) !== true) return undefined;
    const board = boardWin(info?.receipts);
    // A Combat Rules v1 fight is paid by its settle (board/v1-award.js); this step only puts back the practice a story line of the reply added to the skills it practised (hold-v1.js). No old XP step.
    if (board?.v1) return board.claim && board.uses?.length ? { commands: [{ type: FIGHT, payload: { v1: 1, claim: board.claim, uses: board.uses } }] } : undefined;
    if (board && !board.won) return undefined;
    const sheet = readSheet(view.state);
    // XP is combat on the board only (owner, 9 Nov): on the new rules a fight the story settles without the board pays nothing.
    if (!board && sheet.characters.length && sheet.characters.every(character => character.scale === 2)) return undefined;
    const filled = sheet.foes.filter(foe => foe.filled);
    // (cheap first: a fight can only be won now if every filled group is Down; a board win is known by its receipt instead)
    if (!board && (!filled.length || !filled.every(foe => foe.hurt === 0))) return undefined;
    const earlier = typeof view.before === 'function' ? view.before() : null;
    if (!earlier) return undefined;
    const before = readSheet(earlier);
    // The groups the fight began with: the ones standing before the reply, and the ones that arrived in it (the pre-call's opened foes, put on the block by the
    // reply's roll, or the narrator's own set-slot line): a slot that was empty before, or held another group, and is filled now.
    const filledBefore = new Map(before.foes.filter(foe => foe.filled).map(foe => [foe.slot, fold(foe.name)]));
    const arrived = filled.filter(foe => filledBefore.get(foe.slot) !== fold(foe.name)).map(foe => foe.slot);
    // (a group the reply's roll opened in a Down group's slot, even one of the same name, is new: it is paid; a stale Down group never is)
    const opened = openedSlots(info?.receipts).filter(slot => filled.some(foe => foe.slot === slot));
    const was = [...new Set(board ? board.groups : [...standingSlots(before), ...arrived, ...opened])].sort((a, b) => a - b);
    if (!was.length) return undefined;
    // A board win the block no longer shows (a new group opened or the Down ones cleared after it): the step carries the groups.
    const shown = fightOf(sheet, was);
    const groups = board && !(shown.won && shown.groups.length === was.length) ? boardGroups(sheet, before, was, info?.receipts) : null;
    if (groups ? !groups.length : !shown.won) return undefined;
    // The XP rate in force, recorded with the step (a payload without `rate` is 100): a later change of the setting never moves a reply that has it.
    let rate = XP_RATE.default;
    try { rate = xpRateFrom(typeof view.settings === 'function' ? view.settings('story-block') : null); } catch { rate = XP_RATE.default; }
    // A Re-read keeps what the fight was paid with: the reply's earlier `rpg.fight` step decides the flat mark and the rate (one without them stays without);
    // a fight with no earlier step (first captured now) takes the formula and the setting in force.
    const old = info?.type === 'reread' ? (info.previous ?? []).filter(receipt => receipt?.type === FIGHT).map(receipt => receipt.replan?.payload).find(isObject) : undefined;
    let flat = true;
    const outnumbered = info?.type !== 'reread' || old?.outnumbered === 1;
    if (old) {
        flat = old.xp === 2;
        rate = old.rate === undefined ? XP_RATE.default : (xpRateOf(old.rate) ?? rate);
    }
    return { commands: [{ type: FIGHT, payload: { was, ...(groups ? { groups } : {}), ...(board?.bars ? { bars: 2, ...(flat ? { xp: 2 } : {}) } : {}), ...(outnumbered ? { outnumbered: 1 } : {}), ...(board?.cleared && board.claim ? { gone: 1, claim: board.claim } : {}), ...(rate !== XP_RATE.default ? { rate } : {}) } }] };
}
