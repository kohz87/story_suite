/* Where the relationship map writes the ring word: a free stretch of the ring clear of every face label. */
import { MAP_SPAN } from './span-and-caps.js';
import { mapRadius } from './geometry.js';

// Where the outer ring's word ("cold · hostile") is written: in a free stretch of the ring, so no face's label is ever written over it.
// Candidate spots every 3 degrees on the ring just inside the dashed circle; each is tested against the boxes of the faces and their labels
// (`boxes`, {l,r,t,b} in the map's own 780-unit space) and the free spot nearest the bottom (the old, fixed place) wins; with none free,
// the one with the most room. `word` is the text's size ({w,h} in units, drawn on the baseline). Pure: a function of the boxes.
const WORD_RADIUS = -80;
export const WORD_SIZE = Object.freeze({ w: 124, h: 21 });
const NODE_FOOT = Object.freeze({ half: 60, up: 34, down: 70 });
// The boxes the markup alone can know (no measuring): each face with a label under it, at the biggest sizes the labels take.
export const nodeBoxes = (nodes = [], size = MAP_SPAN) => nodes.map(node => {
    const x = (node.x / 100) * size, y = (node.y / 100) * size;
    return { l: x - NODE_FOOT.half, r: x + NODE_FOOT.half, t: y - NODE_FOOT.up, b: y + NODE_FOOT.down };
});
export function ringWordSpot(boxes = [], word = WORD_SIZE, size = MAP_SPAN) {
    const r = mapRadius(WORD_RADIUS, size);
    let best = null;
    for (let deg = 0; deg < 360; deg += 3) {
        const rad = deg * Math.PI / 180;
        const cos = Math.cos(rad);
        const anchor = cos > 0.5 ? 'end' : (cos < -0.5 ? 'start' : 'middle');
        const x = size / 2 + r * cos;
        const y = size / 2 + r * Math.sin(rad);
        const left = anchor === 'end' ? x - word.w : (anchor === 'start' ? x : x - word.w / 2);
        const box = { l: left, r: left + word.w, t: y - word.h * 0.8, b: y + word.h * 0.3 };
        if (box.l < 0 || box.r > size || box.t < 0 || box.b > size) continue;
        // The room left to the nearest box (negative when they overlap): the smaller of the gaps on the two axes, the larger one counts.
        const room = Math.min(Infinity, ...boxes.map(at => Math.max(at.l - box.r, box.l - at.r, at.t - box.b, box.t - at.b)));
        const away = Math.abs(((deg - 90 + 540) % 360) - 180);
        const free = room > 4;
        if (!best || (free && !best.free) || (free === best.free && (free ? away < best.away : room > best.room))) best = { x, y, anchor, room, away, free };
    }
    const spot = best || { x: size / 2, y: size / 2 + r, anchor: 'middle' };
    return { x: spot.x, y: spot.y, anchor: spot.anchor };
}
