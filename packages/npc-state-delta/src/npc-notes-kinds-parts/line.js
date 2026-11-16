// Turning a parsed line's labels into the line shape a kind handler takes.
import { readKnows } from '../npc-notes-knows.js';

const yes = value => /^(yes|true)$/i.test(String(value ?? '').trim());

/** A parsed line's labels ({ slugged label: text }) as the handler's line shape. `ctx`: { current, r, day } (the stored leaf, the reply key, the story day). */
export function noteLine(kind, labels, { current = '', r = null, day = null } = {}) {
    if (kind === 'lie') return { to: labels.to, said: labels.said, catch: yes(labels.caught) };
    if (kind === 'know') {
        if (yes(labels.told)) return { open: true, about: labels.about, fact: labels.fact };
        // One call per line, but addKnow keeps one reply's entries as a set: hand it the reply's earlier lines too.
        const same = readKnows(current).filter(entry => entry.r === r).map(({ about, fact, how, day: at, secret, rule }) => ({ about, fact, how, day: at, secret, rule }));
        return { lines: [...same, { about: labels.about, fact: labels.fact, how: labels.how, day, secret: yes(labels.secret) }] };
    }
    if (kind === 'taste') {
        const sign = labels.likes !== undefined ? '+' : labels.dislikes !== undefined ? '-' : '';
        return { sign, item: labels.likes ?? labels.dislikes, from: labels.from, why: labels.why };
    }
    const tags = String(labels.tag ?? '').split(',').map(tag => tag.trim()).filter(Boolean).map(tag => (/^[+-]/.test(tag) ? tag : `+${tag}`));
    return { with: labels.with, tags };
}
