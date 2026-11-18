/* Hosted party-sheet Level handling: reading a member's sheet level, applying it to dossiers' built-in Level, and stripping the scanner's own.
   On main until the RPG write-back (job R2) lands; pack format 4 removes this mirror again (job N4). */
import { normalizeCustomFields } from './names.js';

// (hosted) The sheet level of an ACTIVE party member, matched by exact name or alias (case-insensitive); null when none.
// `partyLevels` is [{ name, level }] of active members with a whole-number level; Story Block's `party.levels` is read in runtime-hosted.js.
export function sheetLevelOf(npc, partyLevels) {
    if (!Array.isArray(partyLevels) || !partyLevels.length) return null;
    const labels = new Set([npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])].map(label => String(label ?? '').trim().toLowerCase()).filter(Boolean));
    const found = partyLevels.find(entry => labels.has(String(entry?.name ?? '').trim().toLowerCase()));
    return Number.isInteger(found?.level) ? found.level : null;
}

// Sets the built-in Level of each active party member to the sheet's (1 to 99; the sheet is the party member's Level, so it may also lower it).
// Skipped when the dossier's Level is locked by hand. The custom fields are left as they are. Returns [{ id, reason }].
export function applySheetLevels(npcs, partyLevels) {
    const done = [];
    if (!Array.isArray(partyLevels) || !partyLevels.length) return done;
    for (const npc of npcs || []) {
        const sheet = sheetLevelOf(npc, partyLevels);
        if (sheet === null || sheet < 1 || sheet > 99 || (npc.manualProfileFields || []).includes('level') || npc.level === sheet) continue;
        npc.level = sheet;
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
