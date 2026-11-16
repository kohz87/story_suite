// The core's hooks for a reply with an interaction: canGenerate holds the send until the waiting interaction is played, beforeGenerate asks
// for its settle (and its opening) as preludes of the reply, afterReceive opens the next segment or closes. A chat that never used an
// interaction has no metadata box, so every hook answers nothing and the turn is byte-identical to one without the port.

import { normalizeType } from '../assist/common.js';
import { readRecord } from '../persist.js';
import { clearStart, pendingStart } from './start.js';
import { linkMessage, priorPayload, readSend } from './send.js';
import { priorOpening } from './prior.js';
import { receiveSegment } from './carry.js';
import { interactionPayload } from './session.js';
import { interactionInputError } from './watch.js';

const KEY = 'storySuiteInteraction';
const SETTLE = 'interaction.settle';
const plain = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sidOf = message => readRecord(message)?.sid;
const titleOf = (kind, id) => String(kind?.title ?? String(id ?? 'interaction').split('/').at(-1)).trim() || 'interaction';

export function createInteractionHooks({ chat, metadata, kindOf }) {
    const boxOf = () => { try { const meta = metadata(); return plain(meta?.[KEY]) ? { meta, box: meta[KEY] } : null; } catch { return null; } };
    const nameOf = id => titleOf(kindOf(id), id);
    const openingOf = (session, copy) => (plain(copy?.opening) ? copy.opening : session && !session.carriedKey && session.offset === 0 && plain(session.opening) ? session.opening : null);

    // The payload this send carries, and its opening: the staged session (with its Send copy), else the Send copy, else (regenerate) the last payload the reader's message is linked to.
    function pick(box, messages, type, last, anchor) {
        const session = plain(box.open) && box.open.anchor === anchor ? box.open : null, copy = readSend(box, messages);
        const staged = session?.steps?.length ? session : null;
        if (staged) return copy && copy.payload.steps.length === staged.steps.length && !staged.invalidated ? { payload: interactionPayload(staged), opening: openingOf(staged, copy), session: staged } : { wait: staged };
        if (copy) return { payload: structuredClone(copy.payload), opening: openingOf(null, copy), session };
        const lastOne = box.last;
        if (type === 'regenerate' && plain(lastOne) && lastOne.anchor === anchor && last?.extra?.storySuiteInteractionLinks?.[lastOne.key]) {
            return { payload: structuredClone(lastOne), opening: plain(box.lastOpening) && box.lastOpening.payload.anchor === anchor ? box.lastOpening : null, session };
        }
        return { session };
    }

    function canGenerate(view, info = {}) {
        const found = boxOf();
        if (!found) return null;
        const { meta, box } = found, messages = chat() ?? [], last = messages.at(-1);
        const featureOn = id => view?.feature?.(id) !== false;
        let payload = null;
        if (last?.is_user) {
            const anchor = sidOf(messages.at(-2)), type = normalizeType(info.type);
            const pending = pendingStart(meta, messages), picked = pick(box, messages, type, last, anchor);
            if (info.commit === true && (picked.wait || (pending && !picked.payload))) {
                const title = picked.wait ? nameOf(picked.wait.kindId) : titleOf(kindOf(pending.kindId), pending.title);
                return { ok: false, reason: `Play the waiting ${title}.`, action: false, ...(pending ? { interactionStart: true } : {}) };
            }
            if (picked.wait) return null;
            payload = picked.payload ?? null;
            if (!payload && picked.session?.steps?.length) return { ok: false, reason: `The ${nameOf(picked.session.kindId)} no longer matches this reply. Restore the reply or discard it.`, action: false };
        } else if (last && !String(last.mes ?? '')) payload = priorPayload(last);
        if (!payload) return null;
        const error = interactionInputError(view?.state, payload, { kindOf, featureOn });
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
        const picked = type === 'swipe' ? { payload: priorPayload(messages[index + 1]), opening: priorOpening(messages[index + 1]) } : pick(box, messages, type, last, anchor);
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
        if (kindOf(session.kindId)?.carry === true) { session.anchor = record.sid; session.idle = true; session.idleFrom = prior; } else delete box.open;
    }

    return { canGenerate, beforeGenerate, afterReceive };
}
