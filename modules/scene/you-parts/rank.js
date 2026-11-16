// The Rank of {{user}}'s look: the label a pack gives, the Guild standing and whether a rank text agrees with it. Pure.

import { packLevelsOf } from '../../../../../../../modules/rpg/levels.js';

// The Rank's label the first enabled pack that declares one gives ('' when no pack does: this story has no Rank).
export function rankLabelIn(query) {
    try {
        const found = query('packs.youRank', {});
        return typeof found?.label === 'string' ? found.label : '';
    } catch { return ''; }
}

// The pack's Guild standing, read from its rank data module (`content.rpg.playerRank`: Ersveil's guild-membership) through the data-modules view,
// which sees a transaction's drafts: { registered, letter, label } or null when no pack names one or the story has no such module (then nothing here applies).
export function guildOf(domain, query) {
    try {
        const rank = packLevelsOf(query('packs.content', { kind: 'rpg' }))?.playerRank;
        if (!rank) return null;
        const wanted = rank.module.trim().toLowerCase();
        const id = Object.keys(domain?.active ?? {}).find(key => key === wanted || key.split('/')[1] === wanted);
        const chat = id ? query('dataModules.view', { module: id })?.chat : null;
        if (!chat) return null;
        const letter = typeof chat[rank.field] === 'string' || typeof chat[rank.field] === 'number' ? String(chat[rank.field]).trim() : '';
        return { registered: chat.registered !== false && !!letter, letter, label: rank.label };
    } catch { return null; }
}

// Does a rank text agree with the Guild module? Unregistered: it must not claim registration or a letter (neutral text and "unregistered" pass).
// Registered: it must not say unregistered or name another letter.
const NOT_REGISTERED = /\b(unregistered|not registered|no rank|unranked)\b/i;
const LETTER = /(?:^|\s)([FEDCBAS])(?:-rank\b|\s+rank\b)|^\s*([FEDCBAS])\s*$|\bGuild\s+([FEDCBAS])\b/;
export function rankAgrees(text, guild) {
    if (!guild || !text) return true;
    const says = NOT_REGISTERED.test(text);
    const m = LETTER.exec(text);
    const named = m ? (m[1] ?? m[2] ?? m[3]) : '';
    if (!guild.registered) return says || (!named && !/\bregistered\b/i.test(text));
    return !says && (!named || named === guild.letter);
}
