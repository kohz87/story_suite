// The narration capture part (N7): arming, receiving and stripping a reply's block, and the fallback scan's one-time entitlement per reply (keyed by the
// reply's sid). The JSON block is no longer asked for; a stray one is stripped and nothing from it is applied or held.

import { getContext } from '../../../../../../../extensions.js';
import { extractNarrationCapture } from '../../core/core.js';
import { replyNamesSomeone } from '../../core/core-parts/reply-names.js';
import { getSettings } from '../../settings/runtime-settings.js';
import { narrationCaptureEnabled } from '../../calls/runtime-scan-helpers.js';

export function createNarrationPart(rt, deps) {
    const { getChatKey, getChatState, storySuiteV2Meters, updateInjection } = deps;
    const { narrationCaptures, captureRerenderPending, stateVersions } = rt;

    const NARRATION_CAPTURE_LIMIT = 8;
    const narrationCaptureStats = { requested: 0, used: 0, missing: 0, invalid: 0, unterminated: 0, outdated: 0, stripped: 0 };

    let narrationCaptureVersion = null;

    // (user decision 5) Hosted by Story Block v2 with the npc meters slice, the story's `~ npc` lines move
    // the meters, and code clamps and caps them. So Delta adds no model call of its own to a reply there:
    // no focused relationship pass after a one-pass block, no new-NPC relationship pass (a new NPC starts
    // at the base meter values), and, in one-pass mode, the backfill queue runs only with the one-pass
    // catch-up or when the reader asks. Without a host none of this applies.
    function hostedMeters() {
        return Boolean(storySuiteV2Meters());
    }
    function hostedOnePass(settings = getSettings()) {
        return hostedMeters() && narrationCaptureEnabled(settings);
    }

    // Bound to the reply's own ID (its sid), which survives a swipe back, a middle delete and a reload; a reply with no ID yet has no entitlement.
    function narrationCaptureKey(chatKey, messageId) {
        const sid = storySuiteV2Meters()?.replySid?.(Number(messageId)) ?? null;
        return sid ? `${chatKey}|${sid}` : `${chatKey}|#${messageId}`;
    }
    function dropNarrationCaptures() {
        narrationCaptures.clear();
    }
    // The instruction describes the dossier as it was when the prompt was built; any dossier write
    // before the reply arrives (a finishing scan, a reconcile) makes the block outdated.
    function noteNarrationCaptureVersion(key) {
        if (rt.narrationCaptureArmed === key) narrationCaptureVersion = Number(stateVersions.get(key) || 0);
    }
    // Runs before any lineage key reads the reply, so every checkpoint binds the stripped text. Any
    // block is removed even with the mode off; only a complete, parseable one is kept for the scan.
    function stripNarrationSwipes(message, lenient) {
        if (!Array.isArray(message?.swipes)) return;
        for (let index = 0; index < message.swipes.length; index += 1) {
            if (typeof message.swipes[index] === 'string') message.swipes[index] = extractNarrationCapture(message.swipes[index], { lenient }).text;
        }
    }
    // On MESSAGE_RECEIVED the reply is not drawn yet (the host draws it next, from the stripped text);
    // re-render only a message already in the chat. (b6-soak-5) A reply's own receipt re-renders it only
    // once the host says it is drawn (CHARACTER_MESSAGE_RENDERED, renderCapturedReply below).
    function renderCapturedReply(messageId) {
        const id = Number(messageId);
        if (!captureRerenderPending.delete(id)) return;
        const message = getContext().chat?.[id];
        if (message && !message.is_user && !message.is_system) rerenderNarrationMessage(id, message);
    }
    function rerenderNarrationMessage(messageId, message) {
        if (!globalThis.document?.querySelector?.(`#chat .mes[mesid="${Number(messageId)}"]`)) return;
        try { getContext().updateMessageBlock?.(messageId, message); }
        catch (error) { console.warn('[NPC State Delta] could not re-render a reply after removing its capture block.', error); }
    }
    // ONEPASSMISS-1: a failed hosted capture is a reply-scoped scan entitlement, not a
    // scanner result. It shares the capture's lineage binding and is consumed only once.
    function rememberCapture(chatKey, messageId, value) {
        narrationCaptures.set(narrationCaptureKey(chatKey, messageId), value);
        while (narrationCaptures.size > NARRATION_CAPTURE_LIMIT) narrationCaptures.delete(narrationCaptures.keys().next().value);
    }
    // NSD16: the fallback scan runs only when the reply has no <Changes> block at all and names someone (a bad line is refused alone, never rescued).
    function fallbackWanted(message, text) {
        if (/<Changes\b/i.test(String(message?.mes ?? ''))) return false;
        const ctx = getContext();
        return replyNamesSomeone(text, { npcs: getChatState(getChatKey())?.npcs || [], userName: ctx.name1 || '', charName: ctx.name2 || '' });
    }
    function captureNarrationBlock(chatKey, messageId, message, armed, fallbackEligible) {
        const wanted = fallbackEligible && fallbackWanted(message, message.mes);
        const extracted = extractNarrationCapture(message.mes, { lenient: true });
        stripNarrationSwipes(message, true);
        if (extracted.status === 'none') {
            if (armed) narrationCaptureStats.missing += 1;
        } else {
            // A stray block (from an older prompt, a card, another extension) is removed and never applied.
            message.mes = extracted.text;
            captureRerenderPending.add(Number(messageId));
            narrationCaptureStats.stripped += 1;
        }
        if (wanted && extracted.text.trim() && narrationCaptureEnabled()) rememberCapture(chatKey, messageId, { fallback: true });
    }
    function receiveNarrationBlock(messageId) {
        const chatKey = getChatKey();
        const armedHere = Boolean(rt.narrationCaptureArmed) && rt.narrationCaptureArmed === chatKey;
        const current = armedHere && Number(stateVersions.get(chatKey) || 0) === narrationCaptureVersion;
        disarmNarrationCapture();
        const message = Number.isInteger(messageId) ? getContext().chat?.[messageId] : null;
        if (!getSettings().enabled || chatKey === 'no-chat' || !message || message.is_user || message.is_system) return;
        if (armedHere) narrationCaptureStats[current ? 'requested' : 'outdated'] += 1;
        captureNarrationBlock(chatKey, messageId, message, current, armedHere && hostedOnePass());
    }
    // Swiping to a stored sibling must not bring back a block another reply path left in it.
    function stripSwipedNarrationBlock(messageId) {
        dropNarrationCaptures();
        const message = Number.isInteger(messageId) ? getContext().chat?.[messageId] : null;
        if (!getSettings().enabled || !message || message.is_user || message.is_system) return;
        const extracted = extractNarrationCapture(message.mes);
        stripNarrationSwipes(message, false);
        if (extracted.status === 'none') return;
        message.mes = extracted.text;
        rerenderNarrationMessage(messageId, message);
    }
    // Later receipt paths may return before refreshing the injection, and a quiet generation from
    // another extension must never carry the instruction.
    function disarmNarrationCapture() {
        rt.narrationCaptureArmed = '';
        rt.narrationCaptureWatch = [];
        if (rt.lastInjection.captureChars) updateInjection();
    }
    function takeNarrationCapture(chatKey, messageId) {
        const key = narrationCaptureKey(chatKey, messageId);
        const capture = narrationCaptures.get(key) || null;
        narrationCaptures.delete(key);
        return capture && narrationCaptureEnabled() ? capture : null;
    }

    return { narrationCaptureStats, hostedMeters, hostedOnePass, narrationCaptureKey, dropNarrationCaptures, noteNarrationCaptureVersion, renderCapturedReply, receiveNarrationBlock, stripSwipedNarrationBlock, disarmNarrationCapture, takeNarrationCapture };
}
