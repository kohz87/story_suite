// Story Suite v2: the Story Suite roots every token and building block is scoped under.

/**
 * The Story Suite roots (as in controls.css): every token and building block is scoped under them. The last three are
 * the furniture in the chat: the bar above the message box, the Choices under a reply, the notes under a reply. They are
 * roots so the same tokens reach them (Glass, Solid and Follow SillyTavern alike).
 */
export const THEME_ROOTS = Object.freeze(['.story-suite-overlay', '.story-suite-sheet', '.ss-gameview', '.ss-dialog', '.ss-cards', '.ss-card', '.ss-hud', '[data-ss-screen]', '.story-suite-bar', '.story-suite-extras', '.story-suite-reply-note', '.ss-send-note', '.rpg-fight-offer', '.rpg-fight-pause']);
export const ROOT_SELECTOR = `:where(${THEME_ROOTS.join(', ')})`;
