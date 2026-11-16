/* NPC State Delta normalizing, archiving and commanding NPC records with the appearance model applied. */
import * as mechanics from '../core-mechanics.js';
import { stripRecordCitations } from '../core-record.js';
import { normalizeAppearanceForms } from '../appearance.js';
import { isTerminalNpcDeath, normalizeTerminalNpc, protectTerminalNpc } from '../terminal-lifecycle.js';
import { applyModel } from './appearance-model.js';

export function normalizeNpcRecord(raw = {}) {
    return applyModel(mechanics.normalizeNpcRecord(raw));
}
export function normalizeScanNpc(rawInput = {}, options = {}) {
    const raw = stripRecordCitations(rawInput);
    return {
        ...mechanics.normalizeScanNpc(raw, options),
        overallAppearance: String(raw.overallAppearance ?? raw.overall_appearance ?? '').trim().slice(0, 800),
        overallAppearanceState: String(raw.overallAppearanceState ?? raw.overall_appearance_state ?? '').trim().toLowerCase(),
        overallAppearanceReason: String(raw.overallAppearanceReason ?? raw.overall_appearance_reason ?? '').trim().slice(0, 500),
        appearanceForms: normalizeAppearanceForms(raw.appearanceForms ?? raw.appearance_forms, { updates: true }),
        appearanceFormsProvided: Object.prototype.hasOwnProperty.call(raw, 'appearanceForms') || Object.prototype.hasOwnProperty.call(raw, 'appearance_forms'),
        currentForm: String(raw.currentForm ?? raw.current_form ?? '').trim().slice(0, 120),
        currentFormState: (() => {
            const value = String(raw.currentFormState ?? raw.current_form_state ?? '').trim().toLowerCase();
            if (['unknown', 'unspecified', 'clear'].includes(value)) return 'unknown';
            if (['select', 'switch', 'change', 'current'].includes(value)) return 'select';
            return 'keep';
        })(),
        currentFormReason: String(raw.currentFormReason ?? raw.current_form_reason ?? '').trim().slice(0, 500),
    };
}

// This facade is what the runtime imports. A deliberate manual Restore is the retained
// UI's explicit erroneous-death correction. Automatic model/structured writers do not
// call this path to revive a terminal record.
export function setNpcArchived(npc, archived, options = {}) {
    const current = normalizeNpcRecord(npc);
    const correcting = !archived && isTerminalNpcDeath(current)
        && (options.allowDeathCorrection === true || Number.isInteger(options.sourceMessageId));
    if (!archived && isTerminalNpcDeath(current) && !correcting) return normalizeTerminalNpc(current);
    const next = mechanics.setNpcArchived(current, archived, correcting
        ? { ...options, lifeState: options.lifeState ?? 'alive' }
        : (archived && isTerminalNpcDeath(current) ? { ...options, reason: 'deceased', lifeState: 'deceased' } : options));
    if (correcting) {
        const correctionReason = String(options.lifeStateReason || 'Manual correction: the prior death record was marked erroneous.').trim().slice(0, 500);
        Object.assign(next, {
            archived: false,
            archiveReason: '',
            archivedAt: null,
            archiveSourceMessageId: null,
            lifeState: 'alive',
            lifeStateCertainty: 'explicit',
            lifeStateReason: correctionReason,
            present: false,
            worldActive: false,
            deathCorrection: {
                reason: correctionReason,
                correctedAt: Date.now(),
                sourceMessageId: Number.isInteger(options.sourceMessageId) ? options.sourceMessageId : null,
                previousDeathSourceMessageId: Number.isInteger(current.archiveSourceMessageId) ? current.archiveSourceMessageId : null,
                previousDeathReason: String(current.lifeStateReason || '').trim().slice(0, 500),
            },
        });
    }
    return normalizeNpcRecord(next);
}

export function applyNpcStateCommand(state, command, options = {}) {
    const prior = (state?.npcs || []).filter(isTerminalNpcDeath).map(normalizeNpcRecord);
    const result = mechanics.applyNpcStateCommand(state, command, options);
    result.state.npcs = (result.state.npcs || []).map(npc => {
        const protectedNpc = mechanics.matchingNpcRecords(npc, prior)[0];
        return protectedNpc ? protectTerminalNpc(protectedNpc, applyModel(npc)) : applyModel(npc);
    });
    if (result.report?.status === 'restored' && prior.some(npc => String(npc.id) === String(result.report.npcId))) result.report.status = 'terminal-death';
    return result;
}
