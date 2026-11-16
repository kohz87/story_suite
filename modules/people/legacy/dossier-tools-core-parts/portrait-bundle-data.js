/* NPC State Delta supporting tools: portrait file validation and the portable portrait settings and bundle summary shapes. */
import { PORTRAIT_STYLE_PROMPT_LIMIT, PORTRAIT_COMPOSITION_PROMPT_LIMIT } from '../core-mechanics.js';
import { plain, safeNumber, clampText } from './values.js';

const PORTRAIT_FILE_LIMIT = 16 * 1024 * 1024;

export function validatePortraitFile(file) {
    if (!file) return { ok: false, reason: 'No image was selected.' };
    if (!/^image\/(?:png|jpeg|webp|gif|avif|bmp)$/i.test(plain(file.type))) return { ok: false, reason: 'Choose a supported image file.' };
    if (safeNumber(file.size, 0) > PORTRAIT_FILE_LIMIT) return { ok: false, reason: 'Image exceeds the 16 MB input safety limit.' };
    return { ok: true, reason: '' };
}
export function summarizeDecodedBundle(decoded = {}) {
    const npcs = Array.isArray(decoded?.state?.npcs) ? decoded.state.npcs : [];
    const portraits = npcs.filter(npc => plain(npc?.portrait?.dataUrl)).length;
    const history = decoded?.historyArchive && typeof decoded.historyArchive === 'object' ? decoded.historyArchive : null;
    return {
        dossiers: npcs.length,
        portraits,
        portableSettings: Boolean(decoded?.portableSettings && typeof decoded.portableSettings === 'object'),
        historyIncluded: Boolean(history),
        checkpoints: Array.isArray(history?.checkpoints) ? history.checkpoints.length : 0,
        inlineHistory: Array.isArray(history?.inlineCards) ? history.inlineCards.length : 0,
        sourceChatKey: clampText(decoded?.metadata?.sourceChatKey || '', 180),
        formatVersion: safeNumber(decoded?.metadata?.formatVersion, 0),
        appVersion: clampText(decoded?.metadata?.appVersion || '', 60),
    };
}

export function buildPortablePortraitSettings(raw = {}) {
    return {
        portraitGenerationEnabled: raw?.portraitGenerationEnabled !== false,
        portraitThemePreset: clampText(raw?.portraitThemePreset || 'custom', 80),
        portraitStylePositive: clampText(raw?.portraitStylePositive || '', PORTRAIT_STYLE_PROMPT_LIMIT),
        portraitStyleNegative: clampText(raw?.portraitStyleNegative || '', PORTRAIT_STYLE_PROMPT_LIMIT),
        portraitComposition: clampText(raw?.portraitComposition || '', PORTRAIT_COMPOSITION_PROMPT_LIMIT),
        portraitPromptFormat: clampText(raw?.portraitPromptFormat || 'hybrid', 40),
        portraitUseMood: raw?.portraitUseMood !== false,
        portraitUseLocation: raw?.portraitUseLocation === true,
        portraitSaveToGallery: raw?.portraitSaveToGallery === true,
    };
}
