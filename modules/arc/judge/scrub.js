// Story Director v2, part **arc**: keeping the unlearned secrets out of the Director judge's free text (switch story-director.world-events; final
// review H1). The judge is told the secrets so it can refuse a beat that gives one away; its NOTE (the arc's world note, sent to the narrator on every
// reply while the arc runs), its refusal reasons (shown on the arc card and the accept receipt) and its reshaped lines (they become beats) must never
// carry one. Code checks each against every secret text: one that shares a run of three words with a secret (two of them four letters or longer, so
// "of the city" alone is not a match) is dropped (the NOTE), replaced by a fixed reason (a refusal) or emptied (a reshape: the existing "could not be
// used" refusal). It catches a secret quoted or re-punctuated, not one paraphrased. Pure; runs on the judge's answer before it is applied and stored,
// so a replay reads the stored result and never checks again.

/** The fixed refusal reason for an item that touches a secret (the judge's own `refuse: secret`, or a reason that quoted one). */
export const SECRET_REASON = 'it touches a secret not yet learned';

const RUN = 3;
const LONG = 4;
const words = text => String(text ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

function runsOf(text) {
    const list = words(text);
    const out = new Set();
    for (let i = 0; i + RUN <= list.length; i += 1) {
        const run = list.slice(i, i + RUN);
        if (run.filter(word => word.length >= LONG).length >= 2) out.add(run.join(' '));
    }
    return out;
}

/** Whether `text` shares a run of three words (two of them long) with any of `secrets` (texts). */
export function sharesSecret(text, secrets) {
    const own = runsOf(text);
    if (!own.size) return false;
    return secrets.some(secret => [...runsOf(secret)].some(run => own.has(run)));
}

const SECRET_WORD = /^secret\s*[.!]?$/i;

/**
 * readJudge's answer with the secrets kept out: the NOTE dropped when it shares a run with a secret, a refusal's reason replaced by SECRET_REASON
 * (also for the judge's own `refuse: secret`), a reshaped line emptied. `secrets`: the brief's `[{ name, text }]`. Null in, null out.
 */
export function scrubJudge(answer, secrets) {
    if (!answer) return answer;
    const texts = (Array.isArray(secrets) ? secrets : []).map(item => item?.text).filter(text => typeof text === 'string' && text.trim());
    const items = {};
    for (const [n, row] of Object.entries(answer.items ?? {})) {
        if (row.verdict === 'refuse' && (SECRET_WORD.test(row.rest) || sharesSecret(row.rest, texts))) items[n] = { ...row, rest: SECRET_REASON };
        else if (row.verdict === 'reshape' && sharesSecret(row.rest, texts)) items[n] = { ...row, rest: '' };
        else items[n] = row;
    }
    return { items, note: sharesSecret(answer.note, texts) ? '' : answer.note };
}
