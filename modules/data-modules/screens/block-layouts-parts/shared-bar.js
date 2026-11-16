// Draws the one bar track (a plain range or a signed one from a centre line) that the entries and the number map both use.
import { h } from '../../../../ui/legacy/view/widgets/dom.js';

export function barNode(doc, value, min, max) {
    const track = h(doc, 'div', 'ss-bar-track');
    const fill = h(doc, 'div', 'ss-bar-fill');
    if (min < 0) {
        track.classList.add('ss-b-track-c');
        track.appendChild(h(doc, 'span', 'ss-b-mid'));
        const reach = Math.min(1, Math.abs(value) / Math.max(Math.abs(min), Math.abs(max), 1)) * 50;
        fill.style.width = `${reach}%`;
        if (value < 0) fill.classList.add('ss-b-neg');
        fill.style.setProperty('--ss-bar-color', value < 0 ? 'var(--ss-bad)' : 'var(--ss-tick)');
    } else {
        const span = max - min;
        track.style.setProperty('--ss-fill', String(span > 0 ? Math.round(Math.min(1, Math.max(0, (value - min) / span)) * 10000) / 10000 : 0));
        fill.style.setProperty('--ss-bar-color', 'var(--ss-accent)');
    }
    track.appendChild(fill);
    return track;
}
