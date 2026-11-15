// Shortens and places non-overlapping place labels around map markers.

import { SLOTS, labelSize } from './label-metrics.js';

const GAP = 3;

function slotBox(slot, x, y, r, size) {
    const dx = slot.includes('e') ? r + GAP : slot.includes('w') ? -(r + GAP) - size.w : -size.w / 2;
    let dy;
    if (slot === 'n') dy = -(r + GAP) - size.h;
    else if (slot === 's') dy = r + GAP;
    else if (slot.startsWith('n')) dy = -r - size.h / 2;
    else if (slot.startsWith('s')) dy = r - size.h / 2;
    else dy = -size.h / 2;
    return { x: x + dx, y: y + dy, w: size.w, h: size.h };
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A shorter label: the first word when that says enough, else the first 10 characters and "…". */
export function shorten(text) {
    // A town's "N places inside" stays whole: the name is cut, the count is not ("Bluewatch V… · 6 inside").
    const count = String(text).match(/^(.+) · (\d+) places? inside$/);
    if (count) return `${count[1].length > 12 ? `${count[1].slice(0, 11).trimEnd()}…` : count[1]} · ${count[2]} inside`;
    const words = String(text).split(/\s+/).filter(Boolean);
    if (words.length > 1 && words[0].length >= 4) return `${words[0]}…`;
    return text.length > 11 ? `${text.slice(0, 10).trimEnd()}…` : text;
}

/**
 * Places labels so none overlaps another label or a marker, in priority order (first wins):
 * each tries its full text in the eight SLOTS, then its shortened text; a label that fits nowhere
 * is left out (its place still shows, and hover or focus brings the name back).
 * `items`: `[{ id, x, y, r, text }]` (stage pixels, already in priority order); `markers`: every
 * marker on screen `[{ id, x, y, r }]`; `width`/`height`: the stage. Returns `[{ id, slot, text, x, y, w, h }]`.
 */
export function placeLabels(items, markers, width, height) {
    const taken = [];
    const placed = [];
    const markerBoxes = markers.map(marker => ({ id: marker.id, box: { x: marker.x - marker.r, y: marker.y - marker.r, w: marker.r * 2, h: marker.r * 2 } }));
    const inside = box => box.x >= 0 && box.y >= 0 && box.x + box.w <= width && box.y + box.h <= height;
    for (const item of items) {
        let done = null;
        for (const text of [item.text, shorten(item.text)]) {
            const size = labelSize(text);
            for (const slot of SLOTS) {
                const box = slotBox(slot, item.x, item.y, item.r, size);
                if (!inside(box)) continue;
                if (taken.some(other => overlaps(box, other))) continue;
                if (markerBoxes.some(marker => marker.id !== item.id && overlaps(box, marker.box))) continue;
                done = { id: item.id, slot, text, ...box };
                break;
            }
            if (done || text === shorten(text)) break;
        }
        if (!done) continue;
        taken.push(done);
        placed.push(done);
    }
    return placed;
}
