/* NPC State Delta merging a scan result into the NPC list with appearance and terminal-death rules. */
import * as mechanics from '../core-mechanics.js';
import { stripRecordCitations } from '../core-record.js';
import { APPEARANCE_MODEL_VERSION, carryOmittedPhysicalTraits, completeFormWithShared, normalizeAppearanceForms } from '../appearance.js';
import { isTerminalNpcDeath, normalizeTerminalNpc, protectTerminalNpc } from '../terminal-lifecycle.js';
import { lockedAppearance, applyModel, mergeAppearanceKnowledge } from './appearance-model.js';
import { normalizeNpcRecord } from './records.js';

// (stage 73) A scan row's text fields lose the message citations the model appended ("... [m1, m2]") before anything reads them.
function stripScanCitations(scanResult) {
    if (!scanResult || typeof scanResult !== 'object') return scanResult;
    const clean = rows => (Array.isArray(rows) ? rows.map(row => (row && typeof row === 'object' ? stripRecordCitations(row) : row)) : rows);
    const out = { ...scanResult };
    for (const key of ['npcs', 'profileUpdates', 'profile_updates']) if (Array.isArray(out[key])) out[key] = clean(out[key]);
    return out;
}

export function mergeScanResult(state, rawScanResult, options = {}) {
    const scanResult = stripScanCitations(rawScanResult);
    const previous = (state?.npcs || []).map(normalizeNpcRecord);
    // (C05, C-1) Confirmed death is terminal for every merge: scanner, Refresh, backfill and import
    // output, with or without a source message, cannot make the NPC alive or present again. Only
    // the reader's own correction (manual Restore / life state in the editor) and owned rollback can.
    const result = mechanics.mergeScanResult(state, scanResult, options);
    const ordinary = Array.isArray(scanResult?.npcs) ? scanResult.npcs : [];
    const profiles = Array.isArray(scanResult?.profileUpdates)
        ? scanResult.profileUpdates
        : (Array.isArray(scanResult?.profile_updates) ? scanResult.profile_updates : []);

    result.state.npcs = (result.state.npcs || []).map(rawNpc => {
        const sources = mechanics.matchingNpcRecords(rawNpc, previous);
        let ordinaryUpdate = ordinary.find(raw => mechanics.scanRowMatchesNpc(raw, rawNpc));
        let profileUpdate = profiles.find(raw => mechanics.scanRowMatchesNpc(raw, rawNpc));
        const rawForms = ordinaryUpdate && (ordinaryUpdate.appearanceForms ?? ordinaryUpdate.appearance_forms);
        const seed = !sources.length && rawForms
            ? {
                ...rawNpc,
                appearanceModelVersion: APPEARANCE_MODEL_VERSION,
                appearanceForms: normalizeAppearanceForms(rawNpc.appearanceForms)
                    .map(form => ({ ...form, appearance: completeFormWithShared(rawNpc.overallAppearance, form.appearance) })),
            }
            : (sources.length && !lockedAppearance(rawNpc) ? carryOmittedPhysicalTraits(sources[0], rawNpc) : rawNpc);

        const formSwitch = Boolean(
            ordinaryUpdate?.currentForm || ordinaryUpdate?.currentFormState
            || profileUpdate?.currentForm || profileUpdate?.currentFormState
            || (ordinaryUpdate && (ordinaryUpdate.appearanceForms ?? ordinaryUpdate.appearance_forms))
            || (profileUpdate && (profileUpdate.appearanceForms ?? profileUpdate.appearance_forms))
        );
        // A fill call (appearance-fill.js) lets a BLANK current-look slot take the update the core merge could not ground.
        const fillSlot = options.fillBlankAppearance === true && !String(sources[0]?.appearance || rawNpc.appearance || '').trim();
        const appearanceRejected = !formSwitch && !fillSlot && (sources.length
            ? (sources[0]?.appearance ? mechanics.normalizeName(rawNpc.appearance) === mechanics.normalizeName(sources[0]?.appearance) : !rawNpc.appearance)
            : (!rawNpc.appearance));
        if (appearanceRejected) {
            if (ordinaryUpdate && (ordinaryUpdate.appearance || ordinaryUpdate.appearanceState)) {
                ordinaryUpdate = { ...ordinaryUpdate };
                delete ordinaryUpdate.appearance;
                delete ordinaryUpdate.appearanceState;
                delete ordinaryUpdate.appearanceReason;
            }
            if (profileUpdate && (profileUpdate.appearance || profileUpdate.appearanceState)) {
                profileUpdate = { ...profileUpdate };
                delete profileUpdate.appearance;
                delete profileUpdate.appearanceState;
                delete profileUpdate.appearanceReason;
            }
        }

        // Ordinary scans ground appearance only in story text about this NPC; targeted Refresh and
        // backfill reconcile one named NPC and keep their whole window.
        const appearanceOptions = options.allowTargetedDurableSeed === true || !options.developmentContext
            ? options
            : {
                ...options,
                appearanceSeedContext: options.developmentContext,
                developmentContext: mechanics.npcScopedNarration(options.developmentContext, rawNpc, (result.state.npcs || [])
                    .filter(other => other !== rawNpc && String(other?.id || '') !== String(rawNpc?.id || ''))
                    .flatMap(other => [other?.name, ...(Array.isArray(other?.aliases) ? other.aliases : [])])
                    .filter(Boolean)
                    .slice(0, 64)),
            };
        let npc = applyModel(seed);
        if (ordinaryUpdate) npc = applyModel(npc, ordinaryUpdate, appearanceOptions);
        if (profileUpdate) npc = applyModel(npc, profileUpdate, appearanceOptions);
        if (sources.length) npc = mergeAppearanceKnowledge(sources, npc);

        const terminalSource = sources.find(isTerminalNpcDeath);
        if (terminalSource) return protectTerminalNpc(terminalSource, npc);
        return isTerminalNpcDeath(npc) ? normalizeTerminalNpc(npc) : npc;
    });
    return result;
}
