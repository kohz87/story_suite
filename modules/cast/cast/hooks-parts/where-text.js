// Story Director v2, cast part: the line a planner call is told the party is at ("Bluewatch Village / Guild Office, Bluewatch Reach"), with the region by name, never by its id.

import { ask } from '../entries.js';

/** The pack region's name for `region` when it is a pack region's id (a pack's places keep ids); else the region as it is. */
export function regionName(query, region) {
    const text = String(region ?? '').trim();
    if (!text) return '';
    const regions = ask(query, 'packs.content', { kind: 'regions' }, []);
    const found = (Array.isArray(regions) ? regions : []).find(row => typeof row?.id === 'string' && row.id.toLowerCase() === text.toLowerCase());
    return typeof found?.name === 'string' && found.name.trim() ? found.name.trim() : text;
}

/** "Place, Region" for a planner prompt, from the frame's party (`frame.party.place`, `.region`) and query. */
export function whereText(frame) {
    return [frame?.party?.place, regionName(frame?.query, frame?.party?.region)].filter(Boolean).join(', ');
}
