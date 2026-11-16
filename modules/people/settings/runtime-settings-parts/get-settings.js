// getSettings: fills in and canonicalizes the stored settings, saving once when anything changed.

import { extension_settings } from '../../../../extensions.js';
import { npcBucket } from '../bucket.js';
import { normalizeScannerMaxOutputTokens } from '../../calls/scanner-routing.js';
import { normalizeRelationshipMapSettings } from '../../legacy/relationship-map-core.js';
import { normalizeDossierSkin } from '../../legacy/dossier-skin.js';
import { normalizeAllowance, pacingDefaults } from '../../legacy/relationship-pacing.js';
import { DEFAULT_RELATIONSHIP_CRITERIA, DEFAULT_MEMORY_CRITERIA, DEFAULT_BEHAVIOR_CRITERIA, normalizeRelationshipBaseline, normalizeNpcAdmissionMode, DEFAULT_PORTRAIT_STYLE_POSITIVE, DEFAULT_PORTRAIT_STYLE_NEGATIVE, DEFAULT_PORTRAIT_COMPOSITION, PORTRAIT_STYLE_PROMPT_LIMIT, PORTRAIT_COMPOSITION_PROMPT_LIMIT, normalizePortraitPromptFormat, normalizeCustomFieldNames } from '../../core/core.js';
import { normalizeSourceOfTruth } from '../../legacy/suite-handshake.js';
import { PORTRAIT_THEME_PRESETS } from './portrait-preset-constants.js';
import { portraitCustomPresetLibrary } from './portrait-preset-library.js';
import { DEFAULTS } from './defaults.js';
import { persistSettings } from './save.js';
import { injectDepthOf, normalizePresentCastDisplay } from './settings-values.js';

export function getSettings() {
    let settings = npcBucket(extension_settings);
    let dirty = false;
    // (an empty bucket is a new one: the sdk's settings may have made it before the first read)
    if (!settings || !Object.keys(settings).length) {
        settings = structuredClone(DEFAULTS);
        settings = Object.assign(npcBucket(extension_settings, { create: true }), settings);
        dirty = true;
    }

    const assign = (key, value, equal = Object.is) => {
        if (equal(settings[key], value)) return;
        settings[key] = structuredClone(value);
        dirty = true;
    };
    const sameJson = (a, b) => {
        try { return JSON.stringify(a) === JSON.stringify(b); }
        catch { return false; }
    };

    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (settings[key] === undefined) assign(key, value);
    }
    if (!settings.dataFiles || typeof settings.dataFiles !== 'object') assign('dataFiles', {});
    if (!settings.sidecarTombstones || typeof settings.sidecarTombstones !== 'object') assign('sidecarTombstones', {});
    if (!settings.recoveryFiles || typeof settings.recoveryFiles !== 'object') assign('recoveryFiles', {});
    if (!settings.recoveryHistory || typeof settings.recoveryHistory !== 'object') assign('recoveryHistory', {});
    if (!settings.recoveryGarbage || typeof settings.recoveryGarbage !== 'object') assign('recoveryGarbage', {});

    // Current-format settings are canonicalized in place; older Delta schemas are unsupported.
    assign('relationshipBaseline', normalizeRelationshipBaseline(settings.relationshipBaseline), sameJson);
    const pacing = pacingDefaults(settings);
    assign('relationshipImpactCriteria', pacing.impactCriteria);
    assign('relationshipCaps', pacing.caps, sameJson);
    assign('relationshipAllowance', normalizeAllowance(settings.relationshipAllowance), sameJson);
    assign('relationshipPacingMigrated', true);
    assign('customFieldNames', normalizeCustomFieldNames(settings.customFieldNames), sameJson);
    assign('sourceOfTruth', normalizeSourceOfTruth(settings.sourceOfTruth), sameJson);
    assign('relationshipCriteria', typeof settings.relationshipCriteria === 'string' ? settings.relationshipCriteria : DEFAULT_RELATIONSHIP_CRITERIA);
    assign('memoryCriteria', typeof settings.memoryCriteria === 'string' ? settings.memoryCriteria : DEFAULT_MEMORY_CRITERIA);
    assign('behaviorCriteria', typeof settings.behaviorCriteria === 'string' ? settings.behaviorCriteria : DEFAULT_BEHAVIOR_CRITERIA);
    assign('admissionMode', normalizeNpcAdmissionMode(settings.admissionMode));
    assign('presentCastDisplay', normalizePresentCastDisplay(settings.presentCastDisplay));
    assign('presentCastDisplayChosen', settings.presentCastDisplayChosen === true);
    assign('launcherWithStoryBlock', settings.launcherWithStoryBlock === true);
    assign('launcherWithStoryBlockV2', settings.launcherWithStoryBlockV2 === true);
    // 1.0.70 raised the default budget from 1800 to 4000 tokens. An install still on the old default
    // is moved once; any value the player chose, including a later deliberate 1800, is kept.
    const legacyDefaultBudget = settings.injectBudgetDefaultUpgraded !== true && Number(settings.injectBudgetTokens) === 1800;
    assign('injectBudgetTokens', legacyDefaultBudget ? 4000 : Math.max(512, Math.min(6000, Math.round(Number(settings.injectBudgetTokens) || 4000))));
    assign('injectBudgetDefaultUpgraded', true);
    const legacyDefaultDepth = settings.injectDepthTailUpgraded !== true && Number(settings.injectDepth) === 1;
    assign('injectDepth', legacyDefaultDepth ? 0 : injectDepthOf(settings));
    assign('injectDepthTailUpgraded', true);
    assign('layeredSecrets', settings.layeredSecrets !== false);
    assign('fullScanEveryTurn', settings.fullScanEveryTurn === true);
    assign('narrationCapture', settings.narrationCapture === true);
    assign('narrationCaptureCompact', settings.narrationCaptureCompact === true);
    assign('narrationCaptureCatchUp', Number.isFinite(Number(settings.narrationCaptureCatchUp)) ? Math.max(0, Math.min(50, Math.round(Number(settings.narrationCaptureCatchUp)))) : 8);
    assign('scannerConnectionProfile', typeof settings.scannerConnectionProfile === 'string' ? settings.scannerConnectionProfile.trim() : '');
    assign('portraitGenerationEnabled', settings.portraitGenerationEnabled !== false);
    assign('portraitThemePreset', PORTRAIT_THEME_PRESETS[settings.portraitThemePreset] ? settings.portraitThemePreset : 'custom');
    const portraitCustomPresets = portraitCustomPresetLibrary(settings.portraitCustomPresets);
    assign('portraitCustomPresets', portraitCustomPresets, sameJson);
    const portraitCustomPresetId = portraitCustomPresets.some(item => item.id === settings.portraitCustomPresetId)
        ? settings.portraitCustomPresetId
        : portraitCustomPresets[0].id;
    assign('portraitCustomPresetId', portraitCustomPresetId);
    const activeCustomPortraitPreset = portraitCustomPresets.find(item => item.id === portraitCustomPresetId) || portraitCustomPresets[0];
    if (settings.portraitThemePreset === 'custom') {
        assign('portraitStylePositive', activeCustomPortraitPreset.positive);
        assign('portraitStyleNegative', activeCustomPortraitPreset.negative);
        assign('portraitComposition', activeCustomPortraitPreset.composition);
        assign('portraitPromptFormat', activeCustomPortraitPreset.promptFormat);
        assign('portraitUseMood', activeCustomPortraitPreset.useMood);
        assign('portraitUseLocation', activeCustomPortraitPreset.useLocation);
    }
    assign('portraitStylePositive', String(settings.portraitStylePositive ?? DEFAULT_PORTRAIT_STYLE_POSITIVE).slice(0, PORTRAIT_STYLE_PROMPT_LIMIT));
    assign('portraitStyleNegative', String(settings.portraitStyleNegative ?? DEFAULT_PORTRAIT_STYLE_NEGATIVE).slice(0, PORTRAIT_STYLE_PROMPT_LIMIT));
    assign('portraitComposition', String(settings.portraitComposition ?? DEFAULT_PORTRAIT_COMPOSITION).slice(0, PORTRAIT_COMPOSITION_PROMPT_LIMIT));
    assign('portraitPromptFormat', normalizePortraitPromptFormat(settings.portraitPromptFormat));
    assign('portraitUseMood', settings.portraitUseMood !== false);
    assign('portraitUseLocation', settings.portraitUseLocation === true);
    assign('portraitSaveToGallery', settings.portraitSaveToGallery === true);
    assign('autoPruneStale', settings.autoPruneStale !== false);
    const archiveAfter = Math.max(10, Math.min(999, Math.round(Number(settings.staleArchiveAfter) || 30)));
    assign('staleArchiveAfter', archiveAfter);
    assign('staleDeleteAfter', Math.max(archiveAfter + 1, Math.min(1000, Math.round(Number(settings.staleDeleteAfter) || 50))));
    assign('injectLimit', Math.max(1, Math.min(12, Math.round(Number(settings.injectLimit) || 3))));
    assign('fullCastScanEveryTurn', settings.fullCastScanEveryTurn === true);
    assign('scannerMaxOutputTokens', normalizeScannerMaxOutputTokens(settings.scannerMaxOutputTokens));
    assign('relationshipMap', normalizeRelationshipMapSettings(settings.relationshipMap), sameJson);
    assign('dossierStyle', normalizeDossierSkin(settings.dossierStyle));
    // The fantasy calendar (calendar-settings.js) is optional: absent means none; only a stored
    // object is a calendar.
    if (settings.calendarConfig !== undefined && (!settings.calendarConfig || typeof settings.calendarConfig !== 'object' || Array.isArray(settings.calendarConfig))) {
        delete settings.calendarConfig;
        dirty = true;
    }
    assign('schemaVersion', DEFAULTS.schemaVersion);

    if (dirty) persistSettings();
    return settings;
}
