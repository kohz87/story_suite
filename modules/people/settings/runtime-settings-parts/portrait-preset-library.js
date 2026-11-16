// The custom portrait preset library: shaping one preset, the whole library, picking one and minting the next id.

import { DEFAULT_PORTRAIT_STYLE_POSITIVE, DEFAULT_PORTRAIT_STYLE_NEGATIVE, DEFAULT_PORTRAIT_COMPOSITION, PORTRAIT_STYLE_PROMPT_LIMIT, PORTRAIT_COMPOSITION_PROMPT_LIMIT, normalizePortraitPromptFormat } from '../../core/core.js';
import { DEFAULT_CUSTOM_PORTRAIT_PRESET_ID, PORTRAIT_CUSTOM_PRESET_LIMIT } from './portrait-preset-constants.js';

export function portraitCustomPreset(raw = {}, index = 0) {
    const id = String(raw.id || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 64)
        || (index === 0 ? DEFAULT_CUSTOM_PORTRAIT_PRESET_ID : `custom-${index + 1}`);
    const name = String(raw.name || '').trim().slice(0, 80) || `Custom ${index + 1}`;
    return {
        id,
        name,
        positive: String(raw.positive ?? DEFAULT_PORTRAIT_STYLE_POSITIVE).slice(0, PORTRAIT_STYLE_PROMPT_LIMIT),
        negative: String(raw.negative ?? DEFAULT_PORTRAIT_STYLE_NEGATIVE).slice(0, PORTRAIT_STYLE_PROMPT_LIMIT),
        composition: String(raw.composition ?? DEFAULT_PORTRAIT_COMPOSITION).slice(0, PORTRAIT_COMPOSITION_PROMPT_LIMIT),
        promptFormat: normalizePortraitPromptFormat(raw.promptFormat ?? 'hybrid'),
        useMood: raw.useMood !== undefined ? Boolean(raw.useMood) : true,
        useLocation: raw.useLocation !== undefined ? Boolean(raw.useLocation) : false,
    };
}

export function portraitCustomPresetLibrary(raw) {
    const source = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const result = [];
    for (let index = 0; index < source.length && result.length < PORTRAIT_CUSTOM_PRESET_LIMIT; index += 1) {
        const preset = portraitCustomPreset(source[index], index);
        let id = preset.id;
        let suffix = 2;
        while (seen.has(id)) id = `${preset.id.slice(0, 56)}-${suffix++}`;
        seen.add(id);
        result.push({ ...preset, id });
    }
    if (!result.length) {
        result.push(portraitCustomPreset({
            id: DEFAULT_CUSTOM_PORTRAIT_PRESET_ID,
            name: 'Custom 1',
        }, 0));
    }
    return result;
}

export function portraitCustomPresetFor(source = {}, id = '') {
    const presets = portraitCustomPresetLibrary(source.portraitCustomPresets);
    const selectedId = String(id || source.portraitCustomPresetId || '').trim();
    return presets.find(item => item.id === selectedId) || presets[0];
}

export function nextPortraitCustomPresetId(presets = []) {
    const taken = new Set((presets || []).map(item => String(item?.id || '')));
    const base = `custom-${Date.now().toString(36)}`;
    let id = base;
    let suffix = 2;
    while (taken.has(id)) id = `${base}-${suffix++}`;
    return id;
}
