// Story Director: travel distance line formatting for the note.
import { ITEM_SEPARATOR } from '../note-format.js';

// (0.9.22) The places the story or the reader just named, by the world pack's roads: about 12
// tokens a place, and a few more when the reply said a time far off the map.
export const DISTANCES_OFF = 'Keep to these when the trip comes up again.';
const MODE_WORDS = Object.freeze({ foot: 'foot', ride: 'riding', wagon: 'wagon', boat: 'boat' });

function daysText(days) {
    return days < 3 ? String(Math.round(days * 2) / 2) : String(Math.round(days));
}

function distanceItem({ place, fastest, slowest, said }) {
    const low = daysText(fastest.days);
    const high = daysText(slowest.days);
    const how = low === high || fastest.mode === slowest.mode
        ? `${low} ${low === '1' || Number(low) < 1 ? 'day' : 'days'} by ${MODE_WORDS[fastest.mode] ?? fastest.mode}`
        : `${low}–${high} days (${MODE_WORDS[fastest.mode] ?? fastest.mode} to ${MODE_WORDS[slowest.mode] ?? slowest.mode})`;
    return `${place} ${how}${said ? `, not ${said.text}` : ''}`;
}

export function distancesLine(distances, from) {
    const list = (distances ?? []).filter(entry => entry?.place && entry.fastest && entry.slowest);
    if (!list.length || !from) return '';
    const off = list.some(entry => entry.said);
    return `Distances from ${from}: ${list.map(distanceItem).join(ITEM_SEPARATOR)}.${off ? ` ${DISTANCES_OFF}` : ''}`;
}
