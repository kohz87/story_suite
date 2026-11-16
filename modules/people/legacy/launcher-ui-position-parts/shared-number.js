/* Number coercion shared by the launcher position parts: a finite number or a fallback. */

export function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
