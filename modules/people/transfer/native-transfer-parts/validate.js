// Checks of the manifest metadata a native bundle declares: declared contents, portable settings and source history.
import { PORTRAIT_STYLE_PROMPT_LIMIT, PORTRAIT_COMPOSITION_PROMPT_LIMIT } from '../../core/core-mechanics.js';

const PORTABLE_SETTING_SCHEMA = Object.freeze({
    portraitGenerationEnabled: { type: 'boolean' },
    portraitThemePreset: { type: 'string', max: 80 },
    portraitStylePositive: { type: 'string', max: PORTRAIT_STYLE_PROMPT_LIMIT },
    portraitStyleNegative: { type: 'string', max: PORTRAIT_STYLE_PROMPT_LIMIT },
    portraitComposition: { type: 'string', max: PORTRAIT_COMPOSITION_PROMPT_LIMIT },
    portraitPromptFormat: { type: 'string', max: 40 },
    portraitUseMood: { type: 'boolean' },
    portraitUseLocation: { type: 'boolean' },
    portraitSaveToGallery: { type: 'boolean' },
});

const DECLARED_BOOLEAN_FIELDS = Object.freeze([
    'dossiers', 'portraits', 'socialGraph', 'dismissedIdentitySuppression',
    'portablePortraitSettings', 'sourceHistoryAudit',
]);

export function validateDeclaredContents(value) {
    if (value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('NPC State Delta native bundle has invalid declared-contents metadata.');
    for (const field of DECLARED_BOOLEAN_FIELDS) {
        if (field in value && typeof value[field] !== 'boolean') throw new Error(`NPC State Delta native bundle has invalid declared field ${field}.`);
    }
    if ('historyRestorePolicy' in value && value.historyRestorePolicy !== 'target-safe-baseline') {
        throw new Error(`NPC State Delta native bundle requests unsupported history restore policy: ${String(value.historyRestorePolicy || 'empty')}.`);
    }
    return structuredClone(value);
}

export function validatePortableSettings(value) {
    if (value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('NPC State Delta native bundle has invalid portable settings.');
    const output = {};
    for (const [key, item] of Object.entries(value)) {
        const rule = Object.hasOwn(PORTABLE_SETTING_SCHEMA, key) ? PORTABLE_SETTING_SCHEMA[key] : null;
        if (!rule) throw new Error(`NPC State Delta native bundle contains unsupported portable setting: ${key}.`);
        if (rule.type === 'boolean') {
            if (typeof item !== 'boolean') throw new Error(`NPC State Delta native portable setting ${key} must be boolean.`);
            output[key] = item;
            continue;
        }
        if (typeof item !== 'string' || item.length > rule.max) throw new Error(`NPC State Delta native portable setting ${key} is invalid or exceeds ${rule.max} characters.`);
        output[key] = item;
    }
    return output;
}

export function validateHistoryArchive(value) {
    if (value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('NPC State Delta native bundle has invalid source-history metadata.');
    if (value.policy !== 'audit-only-source-history') throw new Error('NPC State Delta native bundle declares an unsupported source-history policy.');
    for (const field of ['lineage', 'checkpoints', 'inlineCards']) {
        if (field in value && !Array.isArray(value[field])) throw new Error(`NPC State Delta native history field ${field} must be an array.`);
    }
    if ('branchRootSnapshot' in value && value.branchRootSnapshot !== null && (typeof value.branchRootSnapshot !== 'object' || Array.isArray(value.branchRootSnapshot))) {
        throw new Error('NPC State Delta native branchRootSnapshot is invalid.');
    }
    if ('truncated' in value && typeof value.truncated !== 'boolean') throw new Error('NPC State Delta native history truncated flag must be boolean.');
    return structuredClone(value);
}
