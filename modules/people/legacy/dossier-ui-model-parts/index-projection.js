/* NPC State Delta dossier surface: the life bucket, status label and index row of a dossier. */
import { plain, stringList } from './values.js';
import { portraitSource } from './portrait-source.js';

export function dossierLifeBucket(npc = {}) {
    const reason = plain(npc?.archiveReason).toLocaleLowerCase();
    const lifeState = plain(npc?.lifeState).toLocaleLowerCase();
    if (reason === 'deceased' || lifeState === 'dead' || lifeState === 'deceased') return 'dead';
    if (npc?.archived === true) return 'archived';
    return 'active';
}

export function dossierStatusLabel(npc = {}) {
    const bucket = dossierLifeBucket(npc);
    if (bucket === 'dead') return 'Deceased';
    if (bucket === 'archived') return plain(npc?.archiveReason).toLocaleLowerCase() === 'stale' ? 'Archived · stale' : 'Archived';
    if (npc?.present === true) return 'In chat';
    if (npc?.worldActive === true) return 'Active off-screen';
    return 'Off-screen';
}

export function dossierIndexProjection(npc = {}, portraitAssets = {}) {
    return {
        id: plain(npc?.id),
        name: plain(npc?.name, 'Unnamed NPC'),
        aliases: stringList(npc?.aliases, 12),
        role: plain(npc?.role),
        species: plain(npc?.species),
        gender: plain(npc?.gender),
        homeBase: plain(npc?.homeBase),
        apparentAge: plain(npc?.apparentAge),
        location: plain(npc?.location),
        status: plain(npc?.status),
        present: npc?.present === true,
        worldActive: npc?.worldActive === true,
        archived: npc?.archived === true,
        archiveReason: plain(npc?.archiveReason),
        lifeState: plain(npc?.lifeState, 'unknown'),
        bucket: dossierLifeBucket(npc),
        statusLabel: dossierStatusLabel(npc),
        portrait: portraitSource(npc, portraitAssets),
        updatedAt: Number(npc?.updatedAt) || 0,
    };
}
