/* Hosted party-sheet Level handling: reading a member's sheet level, applying it to dossiers, and stripping the scanner's own. */
import { normalizeCustomFieldNames, normalizeCustomFields } from './names.js';

// (hosted) The sheet level of an ACTIVE party member, matched by exact name or alias (case-insensitive); null when none.
// `partyLevels` is [{ name, level }] of active members with a whole-number level; Story Block's `party.levels` is read in runtime-hosted.js.
export function sheetLevelOf(npc, partyLevels) {
    if (!Array.isArray(partyLevels) || !partyLevels.length) return null;
    const labels = new Set([npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])].map(label => String(label ?? '').trim().toLowerCase()).filter(Boolean));
    const found = partyLevels.find(entry => labels.has(String(entry?.name ?? '').trim().toLowerCase()));
    return Number.isInteger(found?.level) ? found.level : null;
}

// Sets the stored Level of each active party member to the sheet's (the scanner's own Level for them is then not kept).
// Skipped when Level is not a configured field or the dossier's custom fields are locked by hand. Returns [{ id, reason }].
export function applySheetLevels(npcs, partyLevels, names) {
    const level = normalizeCustomFieldNames(names).find(name => name.toLowerCase() === 'level');
    const done = [];
    if (!level || !Array.isArray(partyLevels) || !partyLevels.length) return done;
    for (const npc of npcs || []) {
        const sheet = sheetLevelOf(npc, partyLevels);
        if (sheet === null || (npc.manualProfileFields || []).includes('customFields')) continue;
        const fields = normalizeCustomFields(npc.customFields);
        const key = Object.keys(fields).find(other => other.toLowerCase() === 'level');
        if (key && fields[key] === String(sheet)) continue;
        if (key) delete fields[key];
        npc.customFields = { ...fields, [level]: String(sheet) };
        done.push({ id: npc.id, reason: 'Level: from the party sheet' });
    }
    return done;
}

// (hosted) The scan result without the scanner's Level for people on the party sheet (an npcs[] or profileUpdates[] row whose name or
// aliases, or whose stored dossier's, match an active member). A copy; the result itself is not changed.
export function withoutSheetLevels(scanResult, stored, partyLevels) {
    if (!Array.isArray(partyLevels) || !partyLevels.length) return scanResult;
    const known = new Map((Array.isArray(stored) ? stored : []).map(npc => [npc?.id, npc]));
    const strip = row => {
        const onSheet = sheetLevelOf(row, partyLevels) !== null || sheetLevelOf(known.get(row?.id), partyLevels) !== null;
        if (!onSheet || !row?.customFields) return row;
        const fields = normalizeCustomFields(row.customFields);
        for (const key of Object.keys(fields)) if (key.toLowerCase() === 'level') delete fields[key];
        return { ...row, customFields: fields };
    };
    return { ...scanResult, ...(Array.isArray(scanResult?.npcs) ? { npcs: scanResult.npcs.map(strip) } : {}), ...(Array.isArray(scanResult?.profileUpdates) ? { profileUpdates: scanResult.profileUpdates.map(strip) } : {}) };
}
