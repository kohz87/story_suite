// The job: picking the entries a title tag marks out of a list of plain entry objects (shared by the portraits and settings readers).

import { entryText } from './pack-entries.js';

export const findTagged = (entries, test, tag) => {
    const out = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
        if (!entry || !test(entry.title)) continue;
        out.push({
            origin: `lorebook:${entry.book ?? ''}#${entry.uid ?? ''}`,
            title: String(entry.title).replace(tag, '').trim(),
            text: entryText(entry.content),
        });
    }
    return out;
};
