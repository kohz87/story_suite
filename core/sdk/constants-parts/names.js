// The rules domain and the name patterns for module ids and domains.

// A module may keep version markers in a `rules` domain.
export const RULES_DOMAIN = 'rules';
export const MODULE_ID_TEXT = /^[a-z0-9][a-z0-9._-]*$/;
export const DOMAIN_TEXT = /^[a-z][a-zA-Z0-9_-]*$/;
