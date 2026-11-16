// Story Suite v2: reading the parts of a hidden pair's body beside its blocks (header words, sections), and the part that holds its blocks.

import { escapeRe } from '../lines.js';
import { sectionTags, commentText } from './comment-text.js';

// The parts of a hidden pair's body beside its blocks: { head: Set of header words, off: Set, story:
// lines, cut: line | null, echo: lines, assist: lines, next: lines }. `assist` and `next` are the Assist
// extractor's stored output (assistSections): the lines it read on this reply, and the ones it read here
// after the reader had sent, which the next reply applies.
export function commentParts(text, pair, tag = 'Changes') {
    const body = text.slice(pair.bodyStart, pair.bodyEnd);
    const nl = body.indexOf('\n');
    const head = (nl < 0 ? body : body.slice(0, nl)).trim().split(/\s+/).filter(Boolean);
    const off = new Set(head.filter(word => word.startsWith('off:')).flatMap(word => word.slice(4).split(',')).filter(Boolean));
    const names = sectionTags(tag);
    const story = [];
    const cut = [];
    const echo = [];
    const assist = [];
    const next = [];
    const into = { [`<${names.story}>`]: story, [`<${names.cut}>`]: cut, [`<${names.echo}>`]: echo, [`<${names.assist}>`]: assist, [`<${names.next}>`]: next };
    let list = null;
    if (Object.keys(into).some(open => body.includes(open))) {
        for (const line of body.split('\n')) {
            const trimmed = line.trim();
            if (into[trimmed]) list = into[trimmed];
            else if (Object.values(names).some(name => trimmed === `</${name}>`)) list = null;
            else if (list && trimmed) list.push(commentText(trimmed));
        }
    }
    return { head: new Set(head), off, story, cut: cut[0] ?? null, echo, assist, next };
}

// The part of a hidden comment's body that holds its blocks: up to its first section (<Changes-story>,
// -cut, -echo; hideBlock writes them after the blocks), so a kept body with an open tag in it (a Continue's
// block that held a second open tag) never reads the sections' lines as its own.
export function commentBlocks(inner, tag) {
    const names = Object.values(sectionTags(tag)).map(escapeRe).join('|');
    const found = new RegExp(`\\n[ \\t]*<(?:${names})>[ \\t]*(?=\\n|$)`).exec(inner);
    return found ? inner.slice(0, found.index + 1) : inner;
}
