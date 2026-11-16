// The edit-message table and the two things every stack handler reads from its context.

import { resolveCurrency } from '../money.js';
import { STRINGS } from '../../../core/strings.js';

export const E = STRINGS.editMessages;

export const told = ctx => ctx.cause !== 'story';

// The chat's currency comes from the reader's settings or the pack.
export const currencyIn = ctx => resolveCurrency(ctx.settings());
