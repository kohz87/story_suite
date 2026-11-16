/* NPC State Delta applying the appearance model to NPC records and merging appearance knowledge. */
import { APPEARANCE_MODEL_VERSION, applyAppearanceUpdate, normalizeAppearanceForms, normalizeAppearanceModel, resolveNpcAppearance } from '../../appearance/appearance.js';
import { normalizeTerminalNpc } from '../terminal-lifecycle.js';

export function lockedAppearance(npc = {}) {
    return Array.isArray(npc.manualProfileFields) && npc.manualProfileFields.includes('appearance');
}
export function applyModel(npc = {}, rawUpdate = null, options = {}) {
    const locked = lockedAppearance(npc);
    const model = rawUpdate
        ? applyAppearanceUpdate(npc, rawUpdate, { locked, context: options.developmentContext || '', seedContext: options.appearanceSeedContext || '', fillBlank: options.fillBlankAppearance === true })
        : normalizeAppearanceModel(npc, { locked });
    const next = { ...npc, ...model };
    next.appearance = resolveNpcAppearance(next);
    return normalizeTerminalNpc(next);
}
export function mergeAppearanceKnowledge(sources = [], current = {}) {
    const normalizedSources = sources.map(source => applyModel(source));
    const locked = normalizedSources.find(lockedAppearance);
    if (locked) return applyModel({ ...current, ...normalizeAppearanceModel(locked, { locked: true }) });

    const currentModel = normalizeAppearanceModel(current);
    const forms = [];
    for (const model of [...normalizedSources.map(item => normalizeAppearanceModel(item)), currentModel]) {
        for (const form of normalizeAppearanceForms(model.appearanceForms)) {
            const key = form.name.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
            const index = forms.findIndex(item => item.name.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim() === key);
            if (index >= 0) forms[index] = form;
            else if (forms.length < 8) forms.push(form);
        }
    }
    const latest = [...normalizedSources, current]
        .sort((a, b) => Number(a?.updatedAt || 0) - Number(b?.updatedAt || 0))
        .at(-1) || current;
    const selection = currentModel.currentForm || currentModel.currentFormUnknown
        ? currentModel
        : normalizeAppearanceModel(latest);
    const overall = currentModel.overallAppearance
        || [...normalizedSources].reverse().map(item => normalizeAppearanceModel(item).overallAppearance).find(Boolean)
        || '';
    return applyModel({
        ...current,
        overallAppearance: overall,
        unclassifiedAppearance: selection.unclassifiedAppearance || '',
        appearanceForms: forms,
        currentForm: selection.currentForm,
        currentFormUnknown: selection.currentFormUnknown,
        appearanceModelVersion: APPEARANCE_MODEL_VERSION,
    });
}
