// Small helpers for the money parts: tidy text, name length caps and the currency's coin list.

import { cutAt } from '../../../../../../core/text.js';

export const MAX_NAME = 24;

export const MAX_SHORT = 6;

export const tidy = (text, max) => cutAt(String(text ?? '').replace(/\s+/g, ' ').trim(), max);

export const coinList = currency => (Array.isArray(currency?.coins) ? currency.coins : []);
