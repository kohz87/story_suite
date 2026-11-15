// Packing phrases into "Label: a, b, c" lines that fit a room.

const LINE_MAX = 200;

// Phrases packed into "Label: a, b, c" lines of at most LINE_MAX characters, using at most
// `room` characters in all (a newline counted per line): { lines, taken, used }.
export function pack(label, phrases, room) {
    const lines = [];
    let current = '';
    let used = 0;
    let taken = 0;
    while (taken < phrases.length) {
        const piece = current ? `, ${phrases[taken]}` : `${label}: ${phrases[taken]}`;
        if (current && current.length + piece.length > LINE_MAX) {
            lines.push(current);
            used += current.length + 1;
            current = '';
            continue;
        }
        if (used + current.length + piece.length + 1 > room) break;
        current += piece;
        taken += 1;
    }
    if (current) {
        lines.push(current);
        used += current.length + 1;
    }
    return { lines, taken, used };
}
