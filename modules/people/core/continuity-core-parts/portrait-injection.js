/* NPC State Delta portrait prompts and the injection text with resolved appearance. */
import * as mechanics from '../core-mechanics.js';
import { normalizeAppearanceModel, resolveNpcAppearance } from '../appearance.js';
import { normalizeTerminalNpc } from '../terminal-lifecycle.js';
import { lockedAppearance } from './appearance-model.js';

export function buildNpcPortraitPrompts(rawNpc = {}, options = {}) {
    const model = normalizeAppearanceModel(rawNpc, { locked: lockedAppearance(rawNpc) });
    const formSpecific = Boolean(model.currentFormUnknown
        || (model.currentForm && String(model.currentForm).trim().toLocaleLowerCase() !== 'base'));
    return mechanics.buildNpcPortraitPrompts({
        ...rawNpc,
        ...(formSpecific ? { species: '', race: '' } : {}),
        appearance: resolveNpcAppearance(rawNpc),
    }, options);
}

export function buildInjection(npcs, text, turn = 0, limit = 3, behaviorCriteria = mechanics.DEFAULT_BEHAVIOR_CRITERIA, budgetTokens = mechanics.DEFAULT_INJECTION_BUDGET_TOKENS, socialGraph = null, { namedNpcIds = [], customFieldNames = [], sceneDeferred = false, awayNotes = null, gearLines = null, storyDay = null } = {}) {
    const resolved = (Array.isArray(npcs) ? npcs : []).map(npc => ({
        ...normalizeTerminalNpc(npc),
        appearance: resolveNpcAppearance(npc),
    }));
    return mechanics.buildInjection(resolved, text, turn, limit, behaviorCriteria, budgetTokens, socialGraph, { includeAppearance: true, namedNpcIds, customFieldNames, sceneDeferred: sceneDeferred === true, awayNotes, gearLines, storyDay });
}
