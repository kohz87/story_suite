// The assist settings: their keys, defaults, feature texts and overlay fields.

import { DEFAULT_KINDS } from '../safety.js';

// The settings live in Story Block's own module settings (the parts' defaults share one bucket, so
// each key carries the part's name). Both helpers are off until the reader turns them on.
export const SETTING = Object.freeze({
    classifier: 'assistClassifier',
    extractor: 'assistExtractor',
    profile: 'assistProfile',
    extractorProfile: 'assistExtractorProfile',
    extractorKinds: 'assistExtractorKinds',
});

export const DEFAULTS = Object.freeze({
    [SETTING.classifier]: false,
    [SETTING.extractor]: false,
    [SETTING.profile]: '',
    [SETTING.extractorProfile]: '',
    [SETTING.extractorKinds]: DEFAULT_KINDS,
});

// The two switches are features of Story Block (MODULES §F100, Settings → Features): their texts are
// here, the reader's choice is extension_settings.storySuite.features (the runtime gives the helpers
// these two keys from it). A value an older version stored under the keys is that choice until the
// reader changes the feature.
export const FEATURE_TEXT = Object.freeze({
    classifier: Object.freeze({
        label: 'Roll checks before the reply',
        describe: 'One small extra model call per message: when you try something risky, the check is rolled first and the reply tells how it went.',
        needs: 'Needs a module that keeps checks, like Story Director.',
    }),
    extractor: Object.freeze({
        label: 'Safety net: read changes the reply forgot',
        describe: 'One cheap extra model call per reply: time, place, who came or went, weather, quest progress or a hand-over the story told but its change lines missed are kept anyway, marked "assist". Never adds coin, items, XP or loot.',
    }),
});

// The overlay's field types (registry.js). The profile is a `profile` field (profile-field.js, MODULES §G):
// a dropdown of SillyTavern's Connection Manager profiles after "Same as chat", storing the profile's name
// ('' the chat's connection; a name typed by an older version is the same value), in its own "Assist" group.
export const SCHEMA = Object.freeze({
    [SETTING.profile]: Object.freeze({
        type: 'profile',
        group: 'Assist',
        label: 'Connection profile for these calls',
        help: 'The Connection Manager profile the two helpers\' extra calls use (a cheaper model, say). Same as chat: the chat\'s connection.',
    }),
    [SETTING.extractorProfile]: Object.freeze({
        type: 'profile',
        group: 'Assist',
        label: 'Connection profile for the safety net',
        help: 'The profile the safety net\'s one call per reply uses. Same as chat here: the profile above.',
    }),
    [SETTING.extractorKinds]: Object.freeze({
        type: 'text',
        group: 'Assist',
        label: 'Kinds the safety net may write',
        help: `"op kind" pairs, comma-separated (default: ${DEFAULT_KINDS}). Coin, new items, XP, loot and heals are never written, whatever this says.`,
    }),
});
