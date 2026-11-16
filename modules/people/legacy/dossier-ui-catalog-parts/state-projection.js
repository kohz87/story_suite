/* NPC State Delta dossier surface: shaping the whole dossier state (details, ties, meters, key and cast views, index) for the panel. */
import { changeStamp, dossierDetailProjection, plain, RELATIONSHIP_AXES, wholeNumber } from '../dossier-ui-model.js';
import { v2MetersProjection } from '../dossier-ui-meters.js';
import { noteTieTags, readTieRows, tieRoster } from '../../core/core-keyrel.js';
import { libraryTone, moodTile } from '../dossier-ui-view-model.js';
import { sortDossierIndex } from './index-order.js';
import { keyProjection } from './key-projection.js';
import { castProjection } from './cast-projection.js';

// (hosted) The card's change is the meters' own net change of the latest reply window; a newer-or-equal manual edit keeps its
// card. Display only: built here from the view, never stored. Without a net change (or off a host) the stored change shows as before.
// The event's words, cleaned for the card: { tier, held, note, ask: { axis: n }, date } or null.
function eventDetails(event) {
    if (!event || typeof event !== 'object') return null;
    const tier = ['ordinary', 'meaningful', 'major', 'extreme'].includes(event.tier) ? event.tier : null;
    if (!tier) return null;
    const ask = Object.fromEntries(RELATIONSHIP_AXES.map(([axis]) => [axis, Math.round(Number(event.ask?.[axis]) || 0)]).filter(([, value]) => value !== 0));
    return { tier, held: event.held === true, note: plain(event.note).slice(0, 120), ask, date: plain(event.date).slice(0, 40), ...(plain(event.gate) ? { gate: plain(event.gate).slice(0, 80) } : {}), ...(plain(event.why) ? { why: plain(event.why).slice(0, 240) } : {}) };
}

function ownRelationshipChange(stored, net) {
    if (stored?.impact === 'manual' && (stored.message ?? -1) >= net.message) return stored;
    const delta = Object.fromEntries(RELATIONSHIP_AXES.map(([axis]) => [axis, Math.round(Number(net.delta?.[axis]) || 0)]));
    const event = eventDetails(net.event);
    // The reason: the story line's own (the event's why, or the same reply's one-pass evidence for its meters), else the scanner's reason for the same reply;
    // none recorded stays empty (the views say so).
    const reason = event?.why || (Number.isInteger(stored?.message) && stored.message === net.message ? plain(stored.reason) : '');
    return { impact: 'net', delta, reason, turn: null, message: net.message, when: changeStamp({ message: net.message }).label, hosted: true, ...(event ? { event } : {}) };
}

export function projectDossierState(state = {}, status = {}) {
    const portraitAssets = state?.portraitAssets && typeof state.portraitAssets === 'object' ? state.portraitAssets : {};
    const records = Array.isArray(state?.npcs) ? state.npcs : [];
    const formPortraits = state?.formPortraits && typeof state.formPortraits === 'object' ? state.formPortraits : {};
    const customFieldNames = Array.isArray(state?.customFieldNames) ? state.customFieldNames : undefined;
    const meterViews = state?.meterViews && typeof state.meterViews === 'object' ? state.meterViews : {};
    const keyViews = state?.keyViews && typeof state.keyViews === 'object' ? state.keyViews : {};
    const castViews = state?.castViews && typeof state.castViews === 'object' ? state.castViews : {};
    const sheetLevels = state?.sheetLevels && typeof state.sheetLevels === 'object' ? state.sheetLevels : {};
    const tieNames = tieRoster(records);   // once for the whole projection, not once per person
    const details = records.map(npc => {
        const detail = dossierDetailProjection(npc, portraitAssets, formPortraits[npc?.id] || {}, { customFieldNames });
        const meters = v2MetersProjection(Object.hasOwn(meterViews, String(npc?.id ?? '')) ? meterViews[npc.id] : null);
        const key = keyProjection(Object.hasOwn(keyViews, String(npc?.id ?? '')) ? keyViews[npc.id] : null);
        const cast = castProjection(Object.hasOwn(castViews, String(npc?.id ?? '')) ? castViews[npc.id] : null);
        // The ties as the board shows them: type, priority order and the Older fold (core-keyrel.js); a tie tag from the notes wins over the words.
        const tieRows = readTieRows(npc, { npcs: records, roster: tieNames, day: Number.isInteger(state?.storyDay) ? state.storyDay : null, tags: noteTieTags(meters?.notes?.ties) })
            .map(({ index, ...row }) => row);
        return { ...detail, tieRows, ...(meters?.relChange ? { lastRelationshipChange: ownRelationshipChange(detail.lastRelationshipChange, meters.relChange) } : {}), ...(meters?.recent ? { recentMeterChanges: meters.recent } : {}), ...(meters ? { v2Meters: meters } : {}), ...(key ? { key } : {}), ...(cast ? { cast } : {}), ...(Object.hasOwn(sheetLevels, String(npc?.id ?? '')) ? { levelFromSheet: true } : {}) };
    }).filter(npc => npc.id);
    return {
        chatKey: plain(status?.chatKey, 'no-chat'),
        hydrationStatus: plain(status?.hydrationStatus, 'ready'),
        hydrationError: plain(status?.hydrationError),
        turn: Number.isFinite(Number(state?.turn)) ? Number(state.turn) : 0,
        reply: wholeNumber(state?.reply) ?? -1,
        npcs: details,
        index: sortDossierIndex(details.map(npc => ({
            id: npc.id,
            name: npc.name,
            aliases: npc.aliases,
            role: npc.role,
            species: npc.species,
            gender: npc.gender,
            apparentAge: npc.apparentAge,
            homeBase: npc.homeBase,
            location: npc.location,
            status: npc.status,
            present: npc.present,
            worldActive: npc.worldActive,
            archived: npc.archived,
            archiveReason: npc.archiveReason,
            lifeState: npc.lifeState,
            bucket: npc.bucket,
            statusLabel: npc.statusLabel,
            // The same word the board, its pill and Right now show (the scanner's own word, which the mood numbers follow; the numbers' table word when it wrote none).
            mood: moodTile(npc).text,
            portrait: npc.portrait,
            updatedAt: npc.updatedAt,
            ...(libraryTone(npc.relationship) ? { tone: libraryTone(npc.relationship) } : {}),
            ...(npc.key ? { key: true } : {}),
        }))),
    };
}
