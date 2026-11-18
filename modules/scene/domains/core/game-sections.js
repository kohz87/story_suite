// The job: Story Block's money settings as the `currency` and `economy` sections of a game pack ("Export settings as a game pack"), and back.
import { DEFAULT_CURRENCY, coinPlural, coinsOf } from '../../../inventory/money.js';

const text = value => String(value ?? '').trim();
const scaleOf = stored => { const n = Number(stored); return Number.isFinite(n) && n > 0 ? n : 0; };

/**
 * `io` = { read(key) → stored value, write(key, value) → undefined | anything } on Story Block's own settings (`currency`, `currencyPlural`, `currencyShort`, `coins`, `economyScale`).
 * → `{ currency, economy }`, each `{ read() → the section or undefined when the reader left it alone, apply(value) → Promise<boolean> }`.
 */
export function moneySections(io) {
    const saved = key => io.read(key);
    return {
        currency: {
            read() {
                const name = text(saved('currency')), plural = text(saved('currencyPlural')), short = text(saved('currencyShort'));
                const coins = coinsOf(saved('coins'));
                if ((!name || name === DEFAULT_CURRENCY.name) && !plural && !short && !coins.length) return undefined;
                return { name: name || DEFAULT_CURRENCY.name, ...(plural ? { plural } : {}), ...(short ? { short } : {}),
                    ...(coins.length ? { coins: coins.map(({ name: coin, plural: many, value }) => ({ name: coin, plural: many, value })) } : {}) };
            },
            async apply(value) {
                io.write('currency', text(value?.name) || DEFAULT_CURRENCY.name);
                io.write('currencyPlural', text(value?.plural));
                io.write('currencyShort', text(value?.short));
                io.write('coins', Array.isArray(value?.coins) ? value.coins.map(({ name, plural, value: worth }) => ({ name: plural && plural !== coinPlural(name) ? `${name}/${plural}` : name, value: worth })) : []);
                return true;
            },
        },
        economy: {
            read() { const scale = scaleOf(saved('economyScale')); return scale ? { scale } : undefined; },
            async apply(value) { io.write('economyScale', String(value?.scale ?? 0)); return true; },
        },
    };
}
