// Test helper: the toy layout split into two areas.
import { parseRules } from '../../scripts/codemod/rules.mjs';
import { TOY_RULES } from './codemod-toy.js';

// The toy layout split into two areas: "a" owns the core folders, "b" the ui and the tests.
const [STORE, RUNTIME, UI, TESTS] = TOY_RULES.rules;
export const SET_A = parseRules({ area: 'a', scope: ['pkg'], rules: [STORE, RUNTIME] });
export const SET_B = parseRules({ area: 'b', scope: ['pkg'], rules: [UI, TESTS] });
