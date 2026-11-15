// The Money page's module id, fold key and the cards it is drawn in.

import { SETTINGS_TEXT } from '../../form/schema.js';

/** Story Block's module id and the fold key of its General group, which `openSettings({ fold })` has always taken for the money settings. */
export const MONEY_MODULE = 'story-block';
export const MONEY_FOLD = `${MONEY_MODULE}::group:${SETTINGS_TEXT.general}`;

/** The cards, in order: a title and the fields in each. */
export const MONEY_CARDS = Object.freeze([
    Object.freeze({ title: 'Coins', keys: Object.freeze(['coins', 'coinDisplay']) }),
    Object.freeze({ title: 'Money words', keys: Object.freeze(['currency', 'currencyPlural', 'currencyShort']) }),
    Object.freeze({ title: 'Advanced', keys: Object.freeze(['economyScale']) }),
]);
