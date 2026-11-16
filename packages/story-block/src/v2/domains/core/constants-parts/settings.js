// The core module's settings: the currency, coins, money scale and inner-chatter options.

import { DEFAULT_CURRENCY, MAX_COIN_VALUE } from '../../money.js';
import { CORE_FEATURE } from '../../../../../../../core/features.js';
import { STRINGS } from '../../../../../../../core/strings.js';
import { CHATTER_LIMIT } from '../../../extras.js';

// The chat's one currency (MODULES.md F1): its name (singular) and plural, renamable by the reader,
// never a second one.
export const CORE_SETTINGS = Object.freeze({
    section: 'Story Block',
    defaults: Object.freeze({ currency: DEFAULT_CURRENCY.name, currencyPlural: '', currencyShort: '', economyScale: '0', coins: Object.freeze([]), coinDisplay: 'mixed', chatterInPrompt: false, chatterMax: 3 }),
    schema: Object.freeze({
        currency: Object.freeze({ type: 'text', label: 'Currency (one coin: mark, crown, gold)', max: 24 }),
        currencyPlural: Object.freeze({ type: 'text', label: 'Currency, plural (blank: the name with an s)', max: 24 }),
        currencyShort: Object.freeze({ type: 'text', label: 'Currency, short form (blank: its first letter)', max: 6 }),
        // A number from 0.001 to 1000, kept as text so it can hold a fraction (MODULES §F104).
        economyScale: Object.freeze({
            type: 'text', max: 12, label: 'Money scale (0: the pack\'s)',
            help: 'How many of your coins one coin of the built-in defaults is worth, from 0.001 to 1000: 100 for a copper-coin world (a hundred copper to a built-in gold), 1 for gold. 0 or blank: the enabled pack\'s scale, else 1. Numbers a pack writes are never scaled.',
        }),
        // The world's coins (money.js coinsOf, MODULES §F108): "copper: 1", "silver: 10", smallest first.
        coins: Object.freeze({
            type: 'list', label: 'Coins (smallest first)', form: 'lines',
            of: Object.freeze({ name: Object.freeze({ type: 'text', label: 'Coin', max: 49 }), value: Object.freeze({ type: 'int', label: 'Worth', min: 1, max: MAX_COIN_VALUE }) }),
            help: 'The coins of this world and what each is worth in the smallest one, one per line: "copper: 1", "silver: 10", "gold: 100" (a plural after a slash: "penny/pennies: 1"). The wallet counts the smallest coin; "+ coin 3 silver" is 30 copper. Empty: the enabled pack\'s coins, else the one currency above.',
        }),
        coinDisplay: Object.freeze({
            type: 'choice', label: 'Coin display', options: Object.freeze([
                Object.freeze({ value: 'mixed', label: 'Mixed coins (3 silver 5 copper)' }),
                Object.freeze({ value: 'base', label: 'Smallest coin only (35 copper)' }),
            ]),
            help: 'How amounts are shown when the world has coins.',
        }),
        // MODULES §F115: chatter stays out of later prompts unless the reader asks (it would steer the story).
        chatterInPrompt: Object.freeze({ type: 'bool', group: 'Inner chatter', label: STRINGS.extras.inPrompt, help: STRINGS.extras.inPromptHelp, feature: CORE_FEATURE.chatter }),
        // The most `~ chatter` lines a reply may show; the grammar line asks for up to this many (one per NPC with something on their mind).
        chatterMax: Object.freeze({ type: 'int', min: 1, max: CHATTER_LIMIT, group: 'Inner chatter', label: STRINGS.extras.chatterMax, help: STRINGS.extras.chatterMaxHelp, feature: CORE_FEATURE.chatter }),
    }),
});
