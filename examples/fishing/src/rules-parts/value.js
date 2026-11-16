// A value in the smallest coin as words, using the currency in play.

/**
 * A value in the smallest coin as words, using a currency shaped like Story Block's
 * ({ tiers: [{ name, rate }] smallest first, each rate counting the tier before; or { single }):
 * 672 → "6 gold 7 silver 2 copper". Without a currency: "672 coin".
 */
export function formatValue(value, currency) {
    const tiers = Array.isArray(currency?.tiers) ? currency.tiers.filter(t => t && t.name) : [];
    if (currency?.mode !== 'single' && tiers.length) {
        let unit = 1;
        const worth = tiers.map((tier, i) => {
            if (i > 0) unit *= Math.max(1, Math.round(Number(tier.rate) || 1));
            return { name: tier.name, unit };
        });
        let rest = value;
        const parts = [];
        for (const tier of worth.reverse()) {
            const n = Math.floor(rest / tier.unit);
            rest -= n * tier.unit;
            if (n) parts.push(`${n} ${tier.name}`);
        }
        return parts.join(' ') || `0 ${worth[worth.length - 1].name}`;
    }
    return `${value} ${String(currency?.single ?? '').trim() || 'coin'}`;
}
