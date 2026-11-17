// Story Suite v2: "Discard repair" (the reply sheet): take a reply's repaired lines (the <Changes-assist> comment the repair wrote) out of its text and read the
// reply again. The text keeps a mark that the repair was discarded (capture/echo-parts/assist.js), so it is never asked again: a swipe back, a reload, a Re-read
// and a rewind read the same text. When the Re-read refuses (a reply is being written, a module is waiting, the chat changed), the text is put back as it was.
// `createDiscard({ ctx, reread, refusal })` → discardRepair(index).
import { repairState, withoutRepair } from '../capture.js';

export function createDiscard({ ctx, reread, refusal }) {
    const write = (message, text) => {
        message.mes = text;
        if (Array.isArray(message.swipes) && Number.isInteger(message.swipe_id)) message.swipes[message.swipe_id] = text;
    };

    /** discardRepair(index) → what Re-read answers ({ ok, receipts, … } | { ok: false, code, message }); a reply with no stored repair is refused and left alone. */
    async function discardRepair(index) {
        const message = Number.isInteger(index) ? ctx?.chat?.[index] : undefined;
        if (!message) return refusal('NOT_FOUND', `There is no message ${index} in this chat.`);
        if (message.is_user) return refusal('REFUSED', 'This is the reader\'s own message; only replies hold a repair.');
        const before = String(message.mes ?? '');
        if (repairState(before) !== 'repaired') return refusal('REFUSED', 'This reply holds no repair to discard.');
        const after = withoutRepair(before);
        write(message, after);
        let result;
        try { result = await reread(index); } catch (error) { result = refusal('FAILED', `${error?.message ?? error}`); }
        // Nothing changed when the Re-read refused: the text goes back (unless the reply was edited or replaced meanwhile).
        if (!result?.ok && ctx?.chat?.[index] === message && String(message.mes ?? '') === after) write(message, before);
        return result;
    }

    return { discardRepair };
}
