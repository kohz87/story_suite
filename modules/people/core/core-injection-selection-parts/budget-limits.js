/* NPC State Delta injection budget limits: the default, minimum and maximum dossier token budgets and the section-cap base. */
export const DEFAULT_INJECTION_BUDGET_TOKENS = 4000;
// Section caps are sized for this budget and grow in proportion above it (see buildInjection).
export const INJECTION_CAP_BASE_TOKENS = 1800;
export const MIN_INJECTION_BUDGET_TOKENS = 512;
export const MAX_INJECTION_BUDGET_TOKENS = 6000;
