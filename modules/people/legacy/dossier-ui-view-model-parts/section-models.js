/* NPC State Delta dossier view-model part: the data of the board's section tiles: Right now, Ties, Past and Secrets. */
import { plain, stringList } from '../dossier-ui-model.js';
import { parseKeyRelationshipEntry } from '../../social/social-bonds.js';
import { tieTone } from '../dossier-ui-bond-tone.js';
import { object } from './shared-object.js';
import { bondTone, boardTone } from './bond-tones.js';

export function rightNowModel(npc) {
    const cast = object(npc.cast);
    const key = object(npc.key);
    const place = plain(npc.location) || plain(cast.where);
    const doing = plain(cast.doing);
    return {
        mood: plain(npc.mood),
        place,
        doing,
        summary: doing || place,
        goal: plain(npc.goal) || plain(cast.goal),
        condition: plain(npc.status),
        homeBase: plain(npc.homeBase),
        inChat: npc.present === true,
        away: key.away ?? null,
        lastHeard: cast.lastHeard ? { text: plain(cast.lastHeard.text), on: plain(cast.lastHeard.on) } : null,
    };
}

function tagTone(tags) {
    return boardTone(tieTone(tags) || 'neutral') === 'grey' ? '' : boardTone(tieTone(tags));
}

export function tiesModel(npc) {
    // The board lists the active ties in priority order (type, then most recent); older ones sit in the Older ties fold of the section.
    const texts = Array.isArray(npc.tieRows) ? npc.tieRows.filter(row => row.state === 'active').map(row => row.entry) : stringList(npc.keyRelationships, 12);
    const entries = texts.map(text => {
        const parsed = parseKeyRelationshipEntry(text);
        return {
            text,
            name: parsed?.subject ?? text,
            relation: parsed?.relation ?? '',
            dynamic: parsed?.dynamic ?? '',
        };
    });
    // Tie tags (feature notes) tint a face by the bond: rival red, owes gold, ally green; else the relation word's tone.
    const tagged = new Map(object(npc.v2Meters).notes?.ties?.map(row => [String(row.name).toLowerCase(), row.tags]) ?? []);
    const faces = entries.slice(0, 3).map(entry => ({ name: entry.name, tone: tagTone(tagged.get(entry.name.toLowerCase())) || bondTone(entry.relation) }));
    return { count: entries.length, names: faces.map(face => face.name), faces, entries };
}

export function pastModel(npc) {
    const memories = stringList(npc.memories, 8);
    return {
        count: memories.length,
        latest: memories.length ? memories[memories.length - 1] : '',
        // One dot per remembered thing (violet); a lie told is gold and something known blue (feature notes). At most 5.
        dots: [...memories.map(() => 'mem'), ...(object(npc.v2Meters).notes?.lies ?? []).map(() => 'lie'), ...(object(npc.v2Meters).notes?.knows ?? []).map(() => 'know')].slice(0, 5),
        memories,
        background: plain(npc.background),
    };
}

export function secretsModel(npc) {
    const notes = Array.isArray(object(npc.v2Meters).secrets) ? npc.v2Meters.secrets : [];
    const open = notes.filter(note => note?.state === 'open').length;
    const hidden = notes.filter(note => note?.state === 'hidden');
    return {
        present: notes.length > 0,
        total: notes.length,
        open,
        hidden: hidden.length,
        next: hidden.length ? plain(hidden[0].opens) || null : null,
        lastOpen: open ? plain(notes.filter(note => note?.state === 'open').pop().title) : '',
        notes,
    };
}
