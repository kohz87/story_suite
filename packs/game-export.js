// The job: "Export settings as a game pack" and its way back: the sections the owners hold (card-settings.js `sections`) become one format 4 game pack, and a game pack's sections are handed back to their owners.
import { SUITE_VERSION, validatePack } from './validate.js';

/** The `content` sections a game pack may carry that an owner can hold (a section no owner registered is simply not exported). */
export const GAME_SECTIONS = Object.freeze(['calendar', 'currency', 'economy', 'weather', 'names', 'you', 'rpg', 'pacing', 'start']);

const slug = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/**
 * Builds a game pack from the settings now in force: `{ ok: true, pack, text, sections: [{ section, owner }] }`, or `{ ok: false, message }` when no owner holds anything
 * worth exporting or the pack would not pass the game validator (what the owners read is checked, never trusted). `name`: what the reader calls it (default "My settings").
 */
export function buildGamePack(cardSettings, { name = 'My settings', author = '', version = '1.0.0' } = {}) {
    const content = {};
    const sections = [];
    for (const entry of cardSettings?.sections?.() ?? []) {
        if (!GAME_SECTIONS.includes(entry.section)) continue;
        let value;
        try { value = entry.read(); } catch { value = undefined; }
        if (value === undefined || value === null) continue;
        content[entry.section] = value;
        sections.push({ section: entry.section, owner: entry.owner });
    }
    if (!sections.length) return { ok: false, message: 'None of your settings differ from the built-in game, so there is nothing to export.' };
    const label = String(name).trim().slice(0, 60) || 'My settings';
    const pack = { id: slug(label) || 'my-settings', format: 4, kind: 'game', version, name: label, ...(author ? { author: String(author).slice(0, 60) } : {}),
        requires: { suite: `^${SUITE_VERSION.split('.').slice(0, 2).join('.')}` }, content };
    const checked = validatePack(pack);
    if (!checked.ok) return { ok: false, message: `The settings did not make a valid game pack: ${checked.errors.map(error => `${error.path} ${error.message}`).join('; ').slice(0, 300)}` };
    return { ok: true, pack, text: JSON.stringify(pack, null, 2), sections };
}

/**
 * Hands a game pack's sections back to their owners (a section the pack lacks is left alone; one no owner holds is `skipped`):
 * `{ ok, applied: [section], skipped: [section], failed: [{ section, message }] }`. The pack is checked first; nothing is written when it is not a valid game pack.
 */
export async function applyGamePack(cardSettings, input) {
    const checked = validatePack(input);
    if (!checked.ok) return { ok: false, applied: [], skipped: [], failed: [{ section: '', message: checked.errors[0]?.message ?? 'Not a valid pack.' }] };
    if (checked.pack.kind !== 'game') return { ok: false, applied: [], skipped: [], failed: [{ section: '', message: 'This is not a game pack.' }] };
    const held = new Map((cardSettings?.sections?.() ?? []).map(entry => [entry.section, entry]));
    const applied = [], skipped = [], failed = [];
    for (const section of GAME_SECTIONS) {
        const value = checked.raw.content?.[section];
        if (value === undefined) continue;
        const entry = held.get(section);
        if (!entry) { skipped.push(section); continue; }
        try {
            if (await entry.apply(value) === true) applied.push(section);
            else failed.push({ section, message: `${entry.label} did not apply it.` });
        } catch (error) { failed.push({ section, message: `${entry.label} could not apply it (${error?.message ?? error}).` }); }
    }
    return { ok: failed.length === 0, applied, skipped, failed };
}
