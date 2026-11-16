// Reading a stage threshold, the stage a value stands at and a meter value from a change line.

/** True when `value` has reached threshold `at`: at or above it, or at or below it for a negative one. */
export function thresholdReached(value, at) {
    return at < 0 ? value <= at : value >= at;
}

/** The stage `value` stands at among ascending `stages` (the farthest threshold reached), or null. */
export function stageAt(stages, value) {
    const list = Array.isArray(stages) ? stages : [];
    const below = list.find(stage => stage.at < 0 && value <= stage.at);
    if (below) return below;
    return list.filter(stage => stage.at >= 0 && value >= stage.at).at(-1) ?? null;
}

/**
 * One label value from a change line: `+5` / `-3` (move by), `=40` or a bare `40` (set to).
 * Anything after the number is ignored ("+5 (she smiled)"). → { mode: 'add' | 'set', value } or null.
 */
export function parseMeterValue(raw) {
    const text = String(raw ?? '').trim().replace(/[−–—]/g, '-');
    // The number must end there (or before a space, a bracket or punctuation): `1e9`, `1.5` and
    // `99999` are not meter values.
    const match = /^(=\s*)?([+-])?\s*(\d{1,4})(?=$|\s|[(;,!?)]|\.(?!\d))/.exec(text);
    if (!match) return null;
    const amount = Number(match[3]);
    const signed = match[2] === '-' ? -amount : amount;
    if (match[1] || !match[2]) return { mode: 'set', value: signed };
    return { mode: 'add', value: signed };
}
