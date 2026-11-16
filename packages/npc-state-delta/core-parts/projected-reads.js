// Portrait-prompt and injection builders that project NPCs onto the story calendar before calling continuity.
import * as continuity from '../continuity-core.js';
import * as mechanics from '../core-mechanics.js';
import { calendarNpcProjection } from '../core-birthday.js';

export function buildNpcPortraitPrompts(rawNpc = {}, options = {}) {
    return continuity.buildNpcPortraitPrompts(calendarNpcProjection(rawNpc), options);
}

export function buildInjection(npcs, text, turn = 0, limit = 3, behaviorCriteria = mechanics.DEFAULT_BEHAVIOR_CRITERIA, budgetTokens = mechanics.DEFAULT_INJECTION_BUDGET_TOKENS, socialGraph = null, options = {}) {
    const projected = (Array.isArray(npcs) ? npcs : []).map(npc => calendarNpcProjection(npc));
    return continuity.buildInjection(projected, text, turn, limit, behaviorCriteria, budgetTokens, socialGraph, options);
}
