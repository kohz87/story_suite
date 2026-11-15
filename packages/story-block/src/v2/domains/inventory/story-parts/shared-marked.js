// Tells whether the reply being read carries a rule mark.

// A rule mark of the reply being read (turn/rule-marks.js): a reply captured before it has none and keeps the old rule.
export const marked = (ctx, name) => Array.isArray(ctx?.carrier?.rules) && ctx.carrier.rules.includes(name);
