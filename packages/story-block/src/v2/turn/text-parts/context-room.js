// Context room: works out the context size, reply length and prompt room from SillyTavern's settings.

/**
 * The room the prompt has, from the interceptor's `size` and SillyTavern's context `c`: { size (the
 * context size the reader set), reply (the reply's length, or null), room (tokens the prompt may take) }
 * or null. SillyTavern 1.19 hands the interceptor its context size less the reply's length
 * (getMaxContextSize); the API settings tell the context size the reader set and the reply's length, and
 * take the reply off a size that still holds it. Without a size, the settings alone (the settings' prompt
 * size before a reply).
 */
export function contextRoom(c, size = null) {
    const n = value => {
        const x = Number(value);
        return Number.isFinite(x) && x > 0 ? Math.round(x) : null;
    };
    const cc = c?.mainApi === 'openai' ? c?.chatCompletionSettings : null;
    const full = n(cc ? cc.openai_max_context : c?.maxContext);
    const reply = n(cc ? cc.openai_max_tokens : c?.amount_gen ?? c?.amountGen);
    const given = n(size);
    if (given) {
        if (full && reply && given === full - reply) return { size: full, reply, room: given };
        if (full && reply && given === full && reply < full) return { size: full, reply, room: full - reply };
        return { size: given, reply: null, room: given };
    }
    if (full) return { size: full, reply, room: reply && reply < full ? full - reply : full };
    return null;
}
