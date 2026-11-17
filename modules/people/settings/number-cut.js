// How the old panel's number boxes cut a typed value (role: settings-number-cut).

/** Whole number cut to min..max. A blank or non-number is `fallback`; a typed 0 is kept where min allows 0 (0 = off), else it is `fallback`. */
export function cutSettingNumber(raw, min, max, fallback) {
    const typed = String(raw ?? '').trim() === '' ? NaN : Number(raw);
    const use = Number.isFinite(typed) && (typed !== 0 || min <= 0) ? typed : fallback;
    return Math.max(min, Math.min(max, Math.round(use)));
}
