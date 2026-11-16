// The Money section's body (UI stage, step 3c): Story Block's General settings (the world's coins, the money words) drawn
// by the form engine in the concept's Money page: a Coins card (the coins as name and worth rows with "+ Add" and "Edit as
// text", the coin display under them), a card for the money words and an Advanced card (the money scale). It writes through
// the same settings store as the General group did (`settings.set('story-block', key, value)`). There is no card for how much
// the story may pay: the story decides, and an old saved `storyCoinPerReply` is not in the schema, so it is not drawn or used.
//
// The schema is the registry's (`registry.settingsDefs()`, Story Block's fields in its General group), regrouped into the
// cards and given what only the page needs: a check on the coins that says what the store cannot: a coin the story will
// not use (a number in its name, a name used twice, no worth) and coins past the eighth. A field in General that this file
// does not know goes in a card of its own at the end.
// Public face: re-exports its parts.

export { MONEY_MODULE, MONEY_FOLD, MONEY_CARDS } from './money-parts/names.js';
export { coinProblems, moneySchema } from './money-parts/schema.js';
export { moneyBody } from './money-parts/body.js';
