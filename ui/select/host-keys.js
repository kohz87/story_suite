// The host settings the Look and Tools pages show: which keys, shared by the page's rows and the port's writes.

/** The Look page's five host settings, in row order. */
export const LOOK = Object.freeze(['panelStyle', 'glassStrength', 'font', 'textSize', 'sendPending']);
/** The Tools page's three budgets, in row order (callQueue is in the Models page's Calls group). */
export const BUDGETS = Object.freeze(['tailBudget', 'contextShare', 'maxChangeLines']);
/** The row key a host setting has in the view (`host.<name>`). */
export const hostKey = name => `host.${name}`;
