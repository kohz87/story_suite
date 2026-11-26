// A posted companion who travels with You again leaves their post: one host step on the reply that brought them back (or before the next reply,
// after the reader's own "Add to party"), planned again like a timer's when the story before it changes.
import { refuse, copy, createEvaluation, atPath } from '../interpreter.js';
import { activeDefinition, inputsOf } from '../adapters.js';
import { draftOf, stateOf, instancePath, prefixImports } from '../part/shared.js';
import { POSTS, lapsedPosts } from './posts.js';

/** → `{ vacate }`, the `dm.vacate` command's handler (`deps`: the part's dependency, guard, finish and restore). */
export function createVacate(deps) {
    function vacate(ctx, payload, call = {}) {
        if (ctx.cause !== 'system' || ctx.caller !== null) refuse('REFUSED', '', 'A post is freed only as a host system step.');
        const prefix = stateOf(ctx), module = payload.module;
        const lapsed = lapsedPosts(prefix).find(entry => entry.module === module);
        if (!lapsed) refuse('NO_LONGER_DONE', '', 'Nobody who holds a post travels with You.');
        const definition = activeDefinition(prefix, module);
        call.label = definition.name;
        deps.dependency(definition, prefix);
        const active = prefix.domains.dataModules.active[module], draft = draftOf(ctx), instance = atPath(draft, instancePath(module, 'chat'));
        const before = copy(instance.fields), inputs = inputsOf(prefix, definition);
        const evaluation = createEvaluation(definition, instance, { inputs, source: ctx.source, cursor: ctx.cursor(), subject: 'chat' });
        evaluation.effects(lapsed.posts.map(post => ({ op: 'set', path: [post], value: '' })));
        evaluation.rules();
        const result = evaluation.finish();
        const recorded = deps.guard(ctx, prefix, { kind: 'dm.vacate', module, hash: active.hash, generation: active.generation, subject: 'chat',
            reads: result.reads.map(read => read.path), imports: prefixImports(definition), posted: lapsed.posts.map(post => before[post]),
            decision: { inputs, conds: result.conds } });
        const gone = lapsed.posts.map(post => `${before[post]} travels with You again and leaves the ${POSTS[post]} post`).join('; ');
        return deps.finish(ctx, prefix, draft, recorded, { visits: result.visits, notes: result.notes, replan: true, result: { subject: 'chat', posts: lapsed.posts }, summary: `${definition.name}: ${gone}.` });
    }
    return { vacate };
}
