// The default settings table every stored settings object is filled from.

import { normalizeRelationshipMapSettings } from '../../legacy/relationship-map-core.js';
import { DOSSIER_SKIN_DEFAULT } from '../../legacy/dossier-skin.js';
import { DEFAULT_ALLOWANCE } from '../../legacy/relationship-pacing.js';
import { DEFAULT_RELATIONSHIP, DEFAULT_RELATIONSHIP_CAPS, DEFAULT_RELATIONSHIP_CRITERIA, DEFAULT_IMPACT_CRITERIA, DEFAULT_MEMORY_CRITERIA, DEFAULT_BEHAVIOR_CRITERIA, DEFAULT_PORTRAIT_STYLE_POSITIVE, DEFAULT_PORTRAIT_STYLE_NEGATIVE, DEFAULT_PORTRAIT_COMPOSITION } from '../../core/core.js';
import { normalizeSourceOfTruth } from '../../legacy/suite-handshake.js';
import { DEFAULT_CUSTOM_PORTRAIT_PRESET_ID } from './portrait-preset-constants.js';
import { portraitCustomPreset } from './portrait-preset-library.js';

export const DEFAULTS = Object.freeze({
    schemaVersion: 30,
    enabled: true,
    autoScan: true,
    fullScanEveryTurn: false,
    narrationCapture: false,
    // (1.2.11) With one-pass capture: a quiet Refresh of the NPCs most in the last N captured
    // replies (0 = never), for the slow fields a block beside the story tends to leave thin.
    narrationCaptureCatchUp: 8,
    // (1.2.17) Opt-in: the one-pass rules in fewer words (about 500 tokens less per armed reply).
    narrationCaptureCompact: false,
    portraitGenerationEnabled: true,
    portraitThemePreset: 'fantasy_anime',
    portraitCustomPresetId: DEFAULT_CUSTOM_PORTRAIT_PRESET_ID,
    portraitCustomPresets: [portraitCustomPreset({ id: DEFAULT_CUSTOM_PORTRAIT_PRESET_ID, name: 'Custom 1' })],
    portraitStylePositive: DEFAULT_PORTRAIT_STYLE_POSITIVE,
    portraitStyleNegative: DEFAULT_PORTRAIT_STYLE_NEGATIVE,
    portraitComposition: DEFAULT_PORTRAIT_COMPOSITION,
    portraitPromptFormat: 'hybrid',
    portraitUseMood: true,
    portraitUseLocation: false,
    portraitSaveToGallery: false,
    scanEvery: 5,
    scanDepth: 6,
    maxNpcs: 40,
    autoPruneStale: true,
    staleArchiveAfter: 30,
    staleDeleteAfter: 50,
    admissionMode: 'conservative',
    inject: true,
    // (1.2.16) 0: after the player's message, the cache-friendly tail. An install still on the old
    // default 1 is moved once (injectDepthTailUpgraded); any other depth the player set is kept.
    injectDepth: 0,
    // How many present NPCs the live dossier carries at most (the most relevant first).
    injectLimit: 3,
    injectBudgetTokens: 4000,
    customFieldNames: [],
    sourceOfTruth: normalizeSourceOfTruth(),
    branchRescan: true,
    midDeleteRewind: false,
    presentCastDisplay: 'full',
    presentCastDisplayChosen: false,
    // The floating npc state button while Story Block carries Delta's Present NPCs and Dossiers tabs.
    launcherWithStoryBlock: false,
    // The same button while a Story Block v2 host carries Delta (its Cast tab and overlay).
    launcherWithStoryBlockV2: false,
    relationshipBaseline: { ...DEFAULT_RELATIONSHIP },
    relationshipCaps: { ...DEFAULT_RELATIONSHIP_CAPS },
    relationshipAllowance: { ...DEFAULT_ALLOWANCE },
    relationshipCriteria: DEFAULT_RELATIONSHIP_CRITERIA,
    relationshipImpactCriteria: DEFAULT_IMPACT_CRITERIA,
    memoryCriteria: DEFAULT_MEMORY_CRITERIA,
    behaviorCriteria: DEFAULT_BEHAVIOR_CRITERIA,
    autoArchiveDeaths: true,
    autoReactivateArchived: true,
    // (memory facts) The code derives memory facts from structured events of a new live reply (src/memory-fact-*.js). Off: none derived, no prompt text, no marks.
    memoryFacts: true,
    // (v2 hidden notes) A scan that builds a new dossier also writes 2 to 5 layered hidden notes. Hosted only.
    layeredSecrets: true,
    dataFiles: {},
    sidecarTombstones: {},
    recoveryFiles: {},
    recoveryHistory: {},
    recoveryGarbage: {},
    // Settings whose controls live in their own modules (full-cast.js, scanner-output-ui.js,
    // relationship-map.js, calendar-settings.js); declared and normalized here, the one settings owner.
    fullCastScanEveryTurn: false,
    scannerMaxOutputTokens: 0,
    relationshipMap: normalizeRelationshipMapSettings(),
    dossierStyle: DOSSIER_SKIN_DEFAULT,
});
