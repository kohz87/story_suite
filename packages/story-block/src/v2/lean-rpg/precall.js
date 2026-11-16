// The roll hook (SPEC_RPG §2R A3). Rolls are made by the fight board; the optional pre-check reads new foes without planning dice.
// The fight board is an interaction (board/interaction.js): the core settles a staged fight as the reply's prelude, so here beforeGenerate only offers separate dice for story
// checks beside it; with no fight to carry it offers the fight kind (the pre-check's groups as an opening) or tells the narrator how to open one (noFight). canGenerate holds a send
// for the reader's choice when a typed attack meets a known foe. Old chats keep their planner rolls and board records (resolve.js replays them); nothing here asks a model for a plan.
import { hashText, normalizeType } from '../assist/common.js';
import { DICE, LEAN_RPG_FEATURE, PRACTICE, PRACTICE_SETTING, ROLLS_SETTING, checksOn, practiceOf } from './names.js';
import { OPEN_FIGHT_LINE } from './cue.js';
import { claimKey } from './resolve.js';
import { readSheet } from './read.js';
import { dicePayload } from './checks/dice.js';
import { membersOf } from './practice.js';
import { knownFoeAction } from './board/action-gate.js';
import { readRecord } from '../persist.js';
import { priorPayload } from '../interaction/send.js';
import { pickPayload } from '../interaction/pick.js';
import { clearStart, holdStart, pendingStart } from '../interaction/start-hold.js';
import { CORE_FEATURE } from '../features.js';
import { isStandard, packRulesOf, rulesFromSettings } from './rules.js';
import { FOES_FRESH_REPLIES } from './board/offers.js';
import { FOES_TOUCH_QUERY } from './names.js';
import { isNamedIn } from './open.js';
import { runPrecheck, wantsPrecheck } from './board/precheck-run.js';

// Whether the fight board is on (one literal id, read once per call).
const boardOn = view => view?.feature?.(CORE_FEATURE.fightBoard) === true;
// The fight kind the board offers and carries (the registry's id; the core never names it), and the choices the pause offers.
const FIGHT_KIND = 'story-block/fight', CHOICES = ['board', 'auto', 'plain'];
// The interaction the chat's waiting send carries, as the core's hooks pick it (a staged fight with its Send copy, a regenerate's last one, a swipe's own).
const carried = (meta, messages, type, last, anchor, index) => {
    const box = meta?.storySuiteInteraction, held = pendingStart(meta, messages);
    return type === 'swipe' ? priorPayload(messages[index + 1]) : box && typeof box === 'object' ? pickPayload(box, messages, type, last, anchor, { auto: !held || held.choice === 'plain' }).payload ?? null : null;
};

// Whether a message's record holds a fight the board settled before the port (`rpg.resolve` with a board).
const oldFightIn = message => [message?.extra?.storySuite, ...(Array.isArray(message?.swipe_info) ? message.swipe_info.map(info => info?.extra?.storySuite) : [])]
    .some(record => (record?.receipts ?? []).some(receipt => receipt?.type === 'rpg.resolve' && receipt.replan?.payload?.board));

const readSettings = (view, moduleId) => {
    try {
        const values = typeof view?.settings === 'function' ? view.settings(moduleId) : null;
        return values && typeof values === 'object' ? values : {};
    } catch { return {}; }
};

/** Whether `state` already holds this message's rolls (its claim). */
export const claimed = (state, key) => state?.meta?.claims?.[claimKey(key)] === true;

/**
 * The sheet as the fight-start gate sees it (stale-foes rule, under the `foesFresh` mark; an old chat keeps every foe as it was). A group is fresh when the narrator
 * touched the Foes block (a `set-slot-N` line or a board fight's result, `rpg.foesTouched`) within FOES_FRESH_REPLIES replies before the reader's message; the replies are
 * counted only up to that message (index), so a swipe counts what the first try did. No receipt (foes set by hand) leaves the foes fresh. A stale group the reader's message
 * NAMES (isNamedIn, the pre-check's name rule) still counts, whatever its age: a parley then "I attack the Highmark Deserters" is an attack on them. Only a generic
 * target ("them", "it") needs fresh foes. Any other stale group is put down (hurt 0) so no fight stands, and its slot is listed in `stale` (a pre-check that opens a new
 * fight carries it, so those groups never join the fight). → { sheet, stale: [slot] }.
 */
function currentFoes(view, messages, sheet, text, index) {
    const standing = sheet.foes.filter(foe => foe.filled && foe.hurt > 0);
    if (!standing.length) return { sheet, stale: [] };
    let touched = -1;
    try {
        if (view.rule?.('foesFresh') !== true) return { sheet, stale: [] };
        touched = view.query?.(FOES_TOUCH_QUERY);
    } catch { return { sheet, stale: [] }; }
    if (!Number.isInteger(touched) || touched < 0) return { sheet, stale: [] };
    const since = messages.slice(0, index + 1).filter((message, at) => at > touched && !message?.is_user && !message?.is_system).length;
    if (since <= FOES_FRESH_REPLIES) return { sheet, stale: [] };
    const gone = standing.filter(foe => !isNamedIn(foe.name, [text])).map(foe => foe.slot);
    return gone.length ? { sheet: { ...sheet, foes: sheet.foes.map(foe => (gone.includes(foe.slot) ? { ...foe, hurt: 0 } : foe)) }, stale: gone } : { sheet, stale: [] };
}

/** The text of the reply just before the reader's last message (the narration that introduced the foes), or ''. */
const previousReply = messages => { const before = messages.at(-2); return before && !before.is_user && !before.is_system ? String(before.mes ?? '') : ''; };

/**
 * The hook. `deps`: { chat() → SillyTavern's chat array, metadata() → the chat's metadata, moduleId,
 * skip { peek() → whether the next reply is to go out with no dice, clear() } (start.js: "Send without the RPG for now"),
 * callModel(prompt, { maxTokens, profile, helper, timeoutMs }) → text (the foe pre-check's one Assist call; none: no pre-check), onPlanning(working) (the screens redraw), timeoutMs, timer }.
 * Returns { canGenerate(view, info), beforeGenerate(view, info) → { commands } | { lines } | null, afterCapture(), afterReceive(info, state, query) }.
 */
export function createPrecall({ chat, metadata = () => null, moduleId = 'story-block', skip: noDice = { peek: () => false, clear: () => {} }, callModel = null, onPlanning = () => {}, timeoutMs, timer }) {
    // A retried interceptor must not repeat a check, but an edited or different message still needs its own check.
    const checked = new WeakMap();
    // No foe is filled in and nothing was rolled: if a fight starts in this reply, the narrator sets the Foes line and stops at the first clash.
    // (a block of Down groups only is a won fight: no fight is on)
    const noFight = (sheet, board = false, stale = []) => (sheet.foes.length && !sheet.foes.some(foe => foe.filled && foe.hurt > 0)
        ? { lines: [board ? { text: `${stale.length ? 'The Foes listed are from an earlier scene and are not in this fight.' : 'No foes are set.'} If a fight begins, set the Foes line and tell the approach only. The fight has not started: end at the moment of engagement.`, keep: true } : OPEN_FIGHT_LINE] } : null);

    // A running pre-check also holds another send; stale working states are ignored by pendingStart after a reload. A choice of `plain` releases it.
    const waiting = held => (held && held.choice !== 'plain' ? held : null);

    // The foe pre-check (board/precheck-run.js): a typed attack with no foe standing is read once for its groups; the fight kind is offered with its opening (the groups, the
    // rules and the practice in force: interaction/start.js previews it, records it as the hold and holds the send). → { interactionStart } or null (the send goes on as it does without the pre-check).
    async function precheck(view, sheet, messages, key, text, startAnchor, stale) {
        let meta;
        try { meta = metadata(); } catch { return null; }
        const values = readSettings(view, moduleId), held = pendingStart(meta, messages);
        let pack = null;
        try { pack = packRulesOf(view.query?.('packs.content', { kind: 'rpg' })); } catch { /* no pack rules */ }
        const rules = rulesFromSettings(values, pack);
        if (!startAnchor || !callModel || held?.choice === 'plain' || !isStandard(rules) || noDice.peek() || !wantsPrecheck(values, sheet, text)) return null;
        checked.set(messages.at(-1), key);
        const working = holdStart(meta, messages, { kindId: FIGHT_KIND, title: 'Fight', mode: 'working' });
        try { onPlanning(true); } catch { /* the screen redraws on the next event */ }
        let groups = [];
        try { groups = await runPrecheck({ callModel, message: text, previous: previousReply(messages), sheet, values, limit: timeoutMs, timer, query: (name, args) => view.query?.(name, args) }); } finally {
            if (working) clearStart(meta, working);
            try { onPlanning(false); } catch { /* the screen redraws on the next event */ }
        }
        if (!groups.length) return null;
        const practice = practiceOf(values[PRACTICE_SETTING]) ?? PRACTICE.perUse;
        return { interactionStart: { kindId: FIGHT_KIND, title: 'Fight', anchor: startAnchor, message: hashText(text), choices: CHOICES, opening: { args: { opening: { groups, key, rules, practice, stale } } } } };
    }

    // A known standing foe and a typed attack hold the send for the reader's choice (the pause); a waiting choice or a carried fight is the core's hold, not this one.
    function canGenerate(view, info = {}) {
        if (view?.feature?.(LEAN_RPG_FEATURE) !== true) return null;
        const type = normalizeType(info.type);
        if (info.commit !== true || !['normal'].includes(type) || !boardOn(view)) return null;
        let meta;
        try { meta = metadata(); } catch { return null; }
        const messages = chat() ?? [], last = messages.at(-1);
        if (!last?.is_user || pendingStart(meta, messages) || carried(meta, messages, type, last, readRecord(messages.at(-2))?.sid, messages.length - 1)) return null;
        const sheet = currentFoes(view, messages, readSheet(view.state), String(last.mes ?? ''), messages.length - 1).sheet;
        if (!(sheet.characters.length && sheet.foes.some(foe => foe.filled && foe.hurt > 0) && knownFoeAction(last.mes, sheet))) return null;
        if (!holdStart(meta, messages, { kindId: FIGHT_KIND, title: 'Fight', mode: 'known', choices: CHOICES })) return null;
        return { ok: false, reason: 'Choose how to play the waiting fight.', action: false, interactionStart: true };
    }

    async function offerFor(view, info = {}) {
        const type = normalizeType(info?.type);
        const skipped = (reason, answer = null) => type === 'normal' && info?.commit !== false
            ? { ...(answer ?? {}), problems: [{ code: 'DICE_SKIPPED', quiet: true, message: `Story-check dice were not offered: ${reason}.` }] } : answer;
        if (view?.feature?.(LEAN_RPG_FEATURE) !== true) return skipped('the RPG is off');
        if (info?.commit === false) return null;
        if (!['normal', 'regenerate', 'swipe'].includes(type)) return null;
        // The reader's message: the last one for a send or a regenerate, the one before the reply for a swipe.
        const messages = chat() ?? [];
        if (!messages.some(message => message && !message.is_user)) return skipped('there is no earlier story reply');
        const index = type === 'swipe' ? messages.length - 2 : messages.length - 1;
        const last = messages[index];
        if (!last?.is_user) return skipped('there is no reader message to roll for');
        const text = String(last.mes ?? '').trim();
        if (!text) return skipped('the reader message is empty');
        const { sheet, stale } = currentFoes(view, messages, readSheet(view.state), text, index);
        const key = `${index}-${hashText(text)}`;
        const startAnchor = readRecord(messages[index - 1])?.sid;
        const on = boardOn(view);
        const values = readSettings(view, moduleId);
        const diceReason = () => type === 'normal' && noDice.peek() ? 'the reader chose to send without the RPG'
            : !sheet.characters.length ? 'there is no active character' : !checksOn(values) ? 'Story checks are off' : null;
        const makeDice = () => ({ type: DICE, payload: dicePayload(membersOf(view, sheet), values) });
        let meta = null;
        try { meta = metadata(); } catch { /* no fight without chat metadata */ }
        // A fight the reader staged and sent, or one an earlier try of this reply carried (a regenerate, a swipe): the core settles it as the reply's preludes (interaction/hooks.js);
        // here it only tells the narrator the fight already rolled and offers the separate story-check dice.
        if (on && carried(meta, messages, type, last, startAnchor, index)?.kindId === FIGHT_KIND) {
            const reason = diceReason();
            const answer = { ...(reason ? {} : { lines: [{ text: 'Use story-check dice only for separate non-combat attempts; the fight board already rolled every exchange, so do not roll those again.', keep: true }] }), ...(reason ? {} : { commands: [makeDice()] }) };
            return reason ? skipped(reason, answer) : answer;
        }
        if (type !== 'normal' && claimed(view.state, key)) return null;
        if (on && type === 'normal' && info.commit !== false && !(info.again && checked.get(last) === key) && !waiting(pendingStart(meta, messages))) {
            const offer = await precheck(view, sheet, messages, key, text, startAnchor, stale);
            if (offer) {
                const reason = diceReason();
                const answer = { ...offer, ...(values[ROLLS_SETTING] !== 'off' ? noFight(sheet, on, stale) ?? {} : {}), ...(reason ? {} : { commands: [makeDice()] }) };
                return reason ? skipped(reason, answer) : answer;
            }
        }
        const reason = diceReason();
        if (reason && (type === 'normal' && noDice.peek() || !sheet.characters.length)) return skipped(reason);
        // Story checks (checks/dice.js): this reply, which carries no fight, is offered three dice, rolled from its own seed and recorded with it, together with the
        // rules, difficulty numbers and practice in force now and each member's bonuses (a Re-read and a replay use these, never the settings of the day). The switch is
        // Story checks alone, as the grammar line is: Rolls (the fights' setting) does not matter, so the static prompt does not move with it.
        const dice = reason ? null : makeDice();
        if (values[ROLLS_SETTING] === 'off') return dice ? { commands: [dice] } : skipped(reason);
        // No model is asked for a plan: with no fight to carry the reply goes out as one the planner once answered "none" to.
        const first = noFight(sheet, on, stale);
        return dice ? { ...(first ?? {}), commands: [dice] } : skipped(reason, first);
    }

    // A swipe of a reply whose fight was settled before the port (a board `rpg.resolve`) is written without the fight: its record cannot be settled again (INTERACTION-PLAN §6.4).
    // So is a regenerate of it: every pre-port board send linked its fight on the reader's message (`extra.rpgFightLinks`), and that link is still there.
    // Swiping back keeps it. A quiet Problem says so, beside whatever the generation is offered.
    const fightLinked = message => Object.values(message?.extra?.rpgFightLinks ?? {}).some(value => value === true);
    const NOT_CARRIED = {
        swipe: 'This reply\'s fight was made before the update, so the new try is written without it. Swipe back to keep it.',
        regenerate: 'This reply\'s fight was made before the update, so the new reply is written without it.',
    };
    async function beforeGenerate(view, info = {}) {
        const answer = await offerFor(view, info);
        const type = normalizeType(info?.type);
        if (info?.commit === false || (type !== 'swipe' && type !== 'regenerate') || view?.feature?.(LEAN_RPG_FEATURE) !== true || !boardOn(view)) return answer;
        const last = (chat() ?? []).at(-1);
        if (!(type === 'swipe' ? oldFightIn(last) : fightLinked(last))) return answer;
        const note = { code: 'FIGHT_NOT_CARRIED', quiet: true, message: NOT_CARRIED[type] };
        return { ...(Array.isArray(answer) ? { lines: answer } : answer ?? {}), problems: [...(answer?.problems ?? []), note] };
    }

    // The reply is captured: the one-time "send without the RPG" flag goes.
    function afterCapture() {
        noDice.clear();
    }

    return { canGenerate, beforeGenerate, afterCapture };
}
