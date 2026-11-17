// The state lines of the repair prompt cut to a length: the open hooks and quests lines are never cut (the repair's duplicate rule rests on them), the other lines give way, last first.

import { clip } from '../common.js';

const OPEN = /^Open (hooks|quests):/;

/** `lines` joined by line breaks within `limit` characters; the Open hooks / Open quests lines are kept whole, the rest is cut from the tail. */
export function fitState(lines, limit) {
    const kept = lines.reduce((sum, line) => sum + (OPEN.test(line) ? line.length + 1 : 0), 0);
    let room = Math.max(0, limit - kept);
    const out = [];
    for (const line of lines) {
        if (OPEN.test(line)) { out.push(line); continue; }
        if (room <= 0) continue;
        const text = clip(line, room);
        out.push(text);
        room -= text.length + 1;
    }
    return out.join('\n');
}
