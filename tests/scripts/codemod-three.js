// Test helper: the toy layout split into three areas (stores, ui, tests), applied one after the other.
import { parseRules } from '../../scripts/codemod/rules.mjs';
import { TOY_RULES } from './codemod-toy.js';
import { SET_A } from './codemod-sets.js';

const [, , UI, TESTS] = TOY_RULES.rules;
export const SET_UI = parseRules({ area: 'b', scope: ['pkg'], rules: [UI] });
export const SET_TESTS = parseRules({ area: 'c', scope: ['pkg'], rules: [TESTS] });
export const THREE = [SET_A, SET_UI, SET_TESTS];
