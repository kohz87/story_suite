// The core's hooks for a reply with an interaction: canGenerate holds the send until the waiting interaction is played, beforeGenerate asks
// for its settle (and its opening) as preludes of the reply, afterReceive opens the next segment or closes. A chat that never used an
// interaction has no metadata box, so every hook answers nothing and the turn is byte-identical to one without the port.

import { normalizeType } from '../assist/common.js';
import { readRecord } from '../persist.js';
import { clearStart, pendingStart } from './start-hold.js';
import { linkMessage, priorPayload } from './send.js';
import { pickPayload as pick } from './pick.js';
import { priorOpening } from './prior.js';
import { receiveSegment } from './carry.js';
import { interactionInputError } from './watch.js';

const KEY = 'storySuiteInteraction';
const SETTLE = 'interaction.settle';
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sidOf = message => readRecord(message)?.sid;
const titleOf = (kind, id) => String(kind?.title ?? String(id ?? 'interaction').split('/').at(-1)).trim() || 'interaction';

export function createInteractionHooks({ chat, metadata, kindOf, featureLabel = null, preview = null }) {
    const boxOf = () => { try { const meta = metadata(); return plain(meta?.[KEY]) ? { meta, box: meta[KEY] } : null; } catch { return null; } };
    const nameOf = id => titleOf(kindOf(id), id);
    // The last payload carries a regenerate only while its kind's feature is on (switched off, the reply is regenerated without it, as before).
    const lastOn = (box, view) => { const kind = plain(box.last) ? kindOf(box.last.kindId) : null; return !kind || typeof kind.feature !== 'string' || view?.feature?.(kind.feature) !== false; };

    const startOn = (held, view) => { const feature = kindOf(held.kindId)?.feature; return typeof feature !== 'string' || view?.feature?.(feature) !== false; };

    function canGenerate(view, info = {}) {
        const found = boxOf();
        if (!found) return null;
        const { meta, box } = found, messages = chat() ?? [], last = messages.at(-1);
        const featureOn = id => view?.feature?.(id) !== false;
        let payload = null, opening = null;
        if (last?.is_user) {
            const anchor = sidOf(messages.at(-2)), type = normalizeType(info.type);
            // (a waiting choice of `plain` is released: the reader chose to send the message as it is)
            // (a waiting choice of a kind whose feature is off is not held either: there is no screen left to clear it)
            const held = pendingStart(meta, messages), pending = held && held.choice !== 'plain' && startOn(held, view) ? held : null;
            // (a kind that says `autoSend` carries what is staged with the next message, unless a waiting choice asks for "Send with this …")
            const picked = pick(box, messages, type, last, anchor, { auto: kindOf(box.open?.kindId)?.autoSend === true && !pending, last: lastOn(box, view) });
            if (info.commit === true && (picked.wait || (pending && !picked.payload))) {
                const title = picked.wait ? nameOf(picked.wait.kindId) : titleOf(kindOf(pending.kindId), pending.title);
                return { ok: false, reason: picked.wait?.invalidated ? `The earlier ${title} was taken back. Restore that reply or discard.` : `Play the waiting ${title}.`, action: false, ...(pending ? { interactionStart: true } : {}) };
            }
            if (picked.wait) return null;
            payload = picked.payload ?? null;
            opening = picked.opening ?? null;
            // (a kind whose staged steps go with the next message cannot silently leave the story: staged on another reply, the send waits until it is restored or discarded)
            if (!payload && !picked.session && info.commit === true && plain(box.open) && box.open.steps?.length && kindOf(box.open.kindId)?.autoSend === true) return { ok: false, reason: `The ${nameOf(box.open.kindId)} no longer matches this reply. Restore the reply or discard it.`, action: false };
            if (!payload && picked.session?.steps?.length) return { ok: false, reason: `The ${nameOf(picked.session.kindId)} no longer matches this reply. Restore the reply or discard it.`, action: false };
        } else if (last && !String(last.mes ?? '')) { payload = priorPayload(last); opening = priorOpening(last); }
        if (!payload) return null;
        const error = interactionInputError(view?.state, payload, { kindOf, featureOn, featureLabel: featureLabel ?? undefined, preview, opening });
        return error ? { ok: false, reason: error, action: false } : null;
    }

    function beforeGenerate(view, info = {}) {
        const type = normalizeType(info?.type);
        if (info?.commit === false || !['normal', 'regenerate', 'swipe'].includes(type)) return null;
        const found = boxOf();
        if (!found) return null;
        const { box } = found, messages = chat() ?? [], index = type === 'swipe' ? messages.length - 2 : messages.length - 1, last = messages[index];
        if (!last?.is_user) return null;
        const anchor = sidOf(messages[index - 1]);
        const picked = type === 'swipe' ? { payload: priorPayload(messages[index + 1]), opening: priorOpening(messages[index + 1]) } : pick(box, messages, type, last, anchor, { auto: kindOf(box.open?.kindId)?.autoSend === true && !pendingStart(found.meta, messages), last: lastOn(box, view) });
        if (!picked.payload) return null;
        linkMessage(last, picked.payload.key);
        const { opening } = picked;
        return { commands: [...(opening ? [{ type: SETTLE, payload: opening.payload, seed: opening.seed }] : []), { type: SETTLE, payload: picked.payload }] };
    }

    // The reply is captured: its settle opens the next segment (a carried kind) or closes; a reply with no settle keeps a no-step carried session on the new reply.
    function afterReceive(view, info = {}) {
        const found = boxOf();
        if (!found || normalizeType(info.type) === 'continue') return;
        const { meta, box } = found, messages = chat() ?? [], record = readRecord(messages[info.index]);
        const receipts = record?.receipts ?? [];
        const receipt = receipts.findLast(item => item?.type === SETTLE && plain(item.replan?.payload) && item.replan.payload.opening !== true);
        const opening = receipts.findLast(item => item?.type === SETTLE && item.replan?.payload?.opening === true);
        clearStart(meta);
        delete box.send;
        if (opening) box.lastOpening = { payload: structuredClone(opening.replan.payload), seed: opening.seed };
        if (receipt) {
            const payload = receipt.replan.payload;
            receiveSegment(box, kindOf(payload.kindId), payload, receipt.data?.v2?.result, record.sid, receipt.id, view?.state);
            return;
        }
        const session = plain(box.open) ? box.open : null, prior = sidOf(messages[info.index - 2]);
        if (!record?.sid || !session || session.steps?.length) return;
        const replaced = ['regenerate', 'swipe'].includes(normalizeType(info.type)) && session.idle === true && session.idleFrom === prior;
        if (session.anchor !== prior && !replaced) return;
        if (kindOf(session.kindId)?.carry === true) {
            // (the anchors it passed through are kept, so deleting these replies one by one walks it back the same way)
            if (!replaced) session.idlePath = [...(session.idlePath ?? []), session.anchor];
            session.anchor = record.sid; session.idle = true; session.idleFrom = prior;
        } else delete box.open;
    }

    return { canGenerate, beforeGenerate, afterReceive };
}
