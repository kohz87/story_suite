// What a pack check needs to know of a template: how deep its data-each loops nest and whether a JSON attribute nests too deep.

import { compileTemplate } from './compile.js';

// How deep data-each loops may nest in a pack's template (B-b5b-robust-r2-2): each loop multiplies
// what the one around it draws.
export const MAX_LOOP_DEPTH = 3;

/**
 * What a pack check needs to know of a template: { loops: how deep data-each nests, deepJson: true when
 * a data-props or data-payload nests past MAX_JSON_DEPTH }.
 */
export function templateShape(html) {
    const compiled = compileTemplate(html);
    let loops = 0;
    let deepJson = false;
    const stack = compiled.nodes.map(node => [node, 0]);
    while (stack.length) {
        const [node, around] = stack.pop();
        if (node.kind !== 'element') continue;
        const depth = around + (node.each ? 1 : 0);
        loops = Math.max(loops, depth);
        if (node.deepJson) deepJson = true;
        for (const child of node.children ?? []) stack.push([child, depth]);
    }
    return { loops, deepJson };
}
