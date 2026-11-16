/* NPC State Delta portrait actions: reading, showing and resetting the generated portrait seed. */
import { currentSessionIs } from '../../legacy/dossier-tools-core.js';

export function portraitSeedFromOverlay(overlay) {
    const raw = String(overlay?.querySelector?.('#npc_state_delta_tools_seed')?.value ?? '').trim();
    if (!raw) return null;
    const seed = Number(raw);
    if (!Number.isSafeInteger(seed) || seed < 0) {
        throw new Error('Portrait seed must be a whole number from 0 to 9007199254740991, or blank to generate a fresh seed for each preview.');
    }
    return seed;
}

export function resetGeneratedSeed(session, overlay) {
    session.generatedPortraitSeed = null;
    const panel = overlay?.querySelector?.('[data-generation-seed]');
    const value = overlay?.querySelector?.('[data-generation-seed-value]');
    if (panel) panel.hidden = true;
    if (value) value.textContent = '';
}

export function showGeneratedSeed(session, overlay, seed) {
    if (!currentSessionIs(session) || !Number.isSafeInteger(seed) || seed < 0) return false;
    session.generatedPortraitSeed = seed;
    const panel = overlay?.querySelector?.('[data-generation-seed]');
    const value = overlay?.querySelector?.('[data-generation-seed-value]');
    if (value) value.textContent = String(seed);
    if (panel) panel.hidden = false;
    return true;
}
