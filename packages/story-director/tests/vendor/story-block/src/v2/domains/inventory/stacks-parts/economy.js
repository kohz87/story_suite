// The money scale: how many of the chat's coins one default coin is worth.

// The money scale (MODULES §F104): how many of the chat's coins one coin of the built-in defaults is worth.
// Defaults are gold-scale; a pack whose currency is copper-like says `economy: { scale }`. The scale only
// multiplies built-in default numbers, never what a pack or the reader wrote.
export const ECONOMY_SCALE = Object.freeze({ min: 0.001, max: 1000 });

const scaleIn = value => {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value.trim()) : NaN;
    return Number.isFinite(n) && n >= ECONOMY_SCALE.min && n <= ECONOMY_SCALE.max ? n : null;
};

/**
 * `{ scale, source }`: the reader's `economyScale` setting when it is a number from 0.001 to 1000
 * (`source: 'settings'`; 0 or blank: use the pack's), else the enabled pack's `economy.scale`
 * (`'pack'`), else 1 (`'default'`). `packEconomy` is packs.economy's answer ({ scale } or null).
 */
export function economyOf(settings, packEconomy = null) {
    const set = scaleIn(settings?.economyScale);
    if (set !== null) return { scale: set, source: 'settings' };
    const pack = scaleIn(packEconomy?.scale);
    if (pack !== null) return { scale: pack, source: 'pack' };
    return { scale: 1, source: 'default' };
}

/** A built-in default amount in the chat's coins: × scale, rounded, at least 1. */
export function scaledDefault(amount, scale = 1) {
    return Math.max(1, Math.round(amount * (scaleIn(scale) ?? 1)));
}
