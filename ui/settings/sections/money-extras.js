// Renders the two small Rules pages, Money (coins and prices; a coin line that does not read is refused under its row by the row itself) and Chat extras (its module switches, inner chatter and the tabs under each reply).
import { sectionFrame } from './start.js';
import { replyTabsPanel } from './reply-tabs.js';

/** Returns the Money page nodes for `section`. */
export function renderMoneySection(section, ctx) {
  return sectionFrame(section, ctx);
}

/** Returns the Chat extras page nodes for `section`, headed by its module switches, with the Tabs panel (the tabs under each reply) last. */
export function renderExtrasSection(section, ctx) {
  return sectionFrame(section, ctx, { after: [replyTabsPanel(ctx)] });
}
