/* Where relationship map nodes sit: radius from a value, angles by home base, and a point on the ring. */
import { MAP_CENTER, MAP_SPAN } from './span-and-caps.js';
import { plain, score } from './shared-values.js';

// Closer to the centre is higher. Positive values pull in faster than negative values push out.
export function mapRadius(value, size = MAP_SPAN) {
    const v = score(value);
    return (size / MAP_SPAN) * (v >= 0 ? 245 - v * 1.85 : 245 - v * 1.15);
}

function idHash(text) {
    let hash = 0x811c9dc5;
    for (const char of String(text)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
}

// People from the same home base sit side by side; inside a group the order comes from the id, so
// a node keeps its place while values change.
export function mapAngles(npcs = []) {
    const groupOf = npc => plain(npc.homeBase).toLocaleLowerCase();
    const ordered = [...npcs].sort((a, b) => {
        const ga = groupOf(a), gb = groupOf(b);
        if (ga !== gb) return !ga ? 1 : (!gb ? -1 : ga.localeCompare(gb));
        return idHash(a.id) - idHash(b.id) || String(a.id).localeCompare(String(b.id));
    });
    const step = 360 / Math.max(1, ordered.length);
    return new Map(ordered.map((npc, index) => [npc.id, -90 + (index + 0.5) * step]));
}

export function point(value, angle) {
    const r = mapRadius(value);
    const theta = angle * Math.PI / 180;
    return { x: MAP_CENTER + r * Math.cos(theta), y: MAP_CENTER + r * Math.sin(theta) };
}
