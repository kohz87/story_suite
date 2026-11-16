// NPC record entry points that normalize with birthday, field-change and profile-development state on top of continuity.
import * as continuity from '../continuity-core.js';
import { withStoryDateMemo } from '../calendar.js';
import { normalizeNpcBirthday, normalizeScanBirthday } from '../birthday.js';
import { withAppearanceDerivedApparentAge, normalizeFieldChanges, normalizeFieldChangeDays, normalizeFieldChangeMessages } from '../core-birthday.js';
import { PROFILE_DEVELOPMENT_FIELDS, profileDevelopmentForNpc } from '../core-profile-development.js';

export function normalizeNpcRecord(raw = {}) {
    const npc = withAppearanceDerivedApparentAge(normalizeNpcBirthday(continuity.normalizeNpcRecord(raw)), raw.appearance);
    npc.fieldChanges = normalizeFieldChanges(raw.fieldChanges);
    const fieldChangeDays = normalizeFieldChangeDays(raw.fieldChangeDays);
    if (Object.keys(fieldChangeDays).length) npc.fieldChangeDays = fieldChangeDays;
    else delete npc.fieldChangeDays;
    const fieldChangeMessages = normalizeFieldChangeMessages(raw.fieldChangeMessages);
    if (Object.keys(fieldChangeMessages).length) npc.fieldChangeMessages = fieldChangeMessages;
    else delete npc.fieldChangeMessages;
    for (const field of Object.keys(PROFILE_DEVELOPMENT_FIELDS)) {
        const config = PROFILE_DEVELOPMENT_FIELDS[field];
        const development = profileDevelopmentForNpc(field, npc);
        if (development) npc[config.ledgerKey] = development;
    }
    return npc;
}

export function normalizeScanNpc(raw = {}, options = {}) {
    return withAppearanceDerivedApparentAge({ ...continuity.normalizeScanNpc(raw, options), ...normalizeScanBirthday(raw) }, raw.appearance);
}

export function setNpcArchived(npc, archived, options = {}) {
    return normalizeNpcBirthday(continuity.setNpcArchived(npc, archived, options));
}

export function applyNpcStateCommand(state, command, options = {}) {
    const result = continuity.applyNpcStateCommand(state, command, options);
    result.state.npcs = withStoryDateMemo(() => (result.state.npcs || []).map(npc => normalizeNpcBirthday(npc)));
    return result;
}
