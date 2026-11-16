// The job: saying what is wrong with a template's shape for a pack.

import { templateShape, MAX_LOOP_DEPTH } from '../../../ui/legacy/view/template/index.js';
import { MAX_JSON_DEPTH } from '../../../ui/legacy/view/template/json.js';

// What is wrong with a template's shape for a pack (B-b5b-robust-r2-2, r2-3), or ''.
export function shapeProblem(template) {
    const shape = templateShape(template);
    if (shape.loops > MAX_LOOP_DEPTH) return `nests loops (data-each) ${shape.loops} deep; at most ${MAX_LOOP_DEPTH} are allowed`;
    if (shape.deepJson) return `has data-props or data-payload nested more than ${MAX_JSON_DEPTH} deep`;
    return '';
}
