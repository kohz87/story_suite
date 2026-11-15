// Infers the type of an expression and checks that a condition is boolean.
import { DM_DESCRIPTORS as D, DM_LIMITS as L, dmOwn, dmInt } from '../schema.js';
import { STRINGS } from '../../strings.js';
import { fieldType } from './types.js';
import { pathType } from './path.js';
import { BAD, bool, str, int } from './shared-types.js';

/** Infer one expression, charging AST operator/literal visits including dynamic path expressions. */
export function expressionType(expression, env, at, add) {
    let nodes = 0;
    const visit = (value, path, depth = 1, allowText = false) => {
        nodes += 1;
        if (nodes > L.expressionNodes || depth > L.expressionDepth) {
            add('DM_BUDGET', path, `An expression permits depth ${L.expressionDepth} and ${L.expressionNodes} AST nodes.`);
            return BAD;
        }
        if (typeof value === 'boolean') return { ...bool(), values: [value] };
        if (value === null) return { type: 'null' };
        if (typeof value === 'number') {
            if (!dmInt(value)) { add('DM_BOUNDS', path, 'Integer literals must be safe integers.'); return BAD; }
            return int(value, value);
        }
        if (typeof value === 'string') return str([value]);
        if (!Array.isArray(value) || !value.length || !dmOwn(D.arities, value[0]) || value.length !== D.arities[value[0]] + 1) {
            add('DM_SCHEMA', path, 'Expected a JSON scalar or a declared fixed-arity AST operator.');
            return BAD;
        }
        const [op, a, b, c] = value;
        const child = (v, i, allow = false) => visit(v, `${path}[${i}]`, depth + 1, allow);
        if (op === 'get') {
            const result = pathType(a, { ...env, writing: false }, `${path}[1]`, add, (v, p) => visit(v, p, depth + 1));
            if (result.type === 'text' && !allowText) { add('DM_SCHEMA', path, STRINGS.editMessages.textComparison); return BAD; }
            return result;
        }
        if (op === 'arg' || op === 'bind' || op === 'reward') {
            const source = op === 'arg' ? env.args : op === 'bind' ? env.bindings : env.rewards;
            if (typeof a !== 'string' || !dmOwn(source, a)) { add('DM_SCHEMA', path, `Unknown ${op} reference in this expression context.`); return BAD; }
            const result = op === 'reward' ? source[a] : fieldType(source[a]);
            if (result.type === 'text' && !allowText) { add('DM_SCHEMA', path, STRINGS.editMessages.textComparison); return BAD; }
            return result;
        }
        if (op === 'check') { add('DM_SCHEMA', path, 'SD checks inside a dm root need data-modules v1.1; this definition needs data-modules v1.1.'); return BAD; }
        if (op === 'timer') {
            if (a !== 'periods' || !env.timer) { add('DM_SCHEMA', path, 'timer.periods is available only inside timer effects.'); return BAD; }
            return int(0, Math.ceil(L.elapsedMinutes / env.timer.every));
        }
        if (op === 'input') {
            const imported = dmOwn(env.inputs, a) && env.inputs[a];
            if (!imported || typeof b !== 'string' || !dmOwn(imported, b)) { add('DM_SCHEMA', path, 'input must name a declared scalar import projection.'); return BAD; }
            const result = imported[b];
            if (result.type === 'text' || result.type === 'map') { add('DM_SCHEMA', path, 'Only scalar non-text public projections may be used in expressions.'); return BAD; }
            return result;
        }
        const textComparison = ['eq', 'ne'].includes(op);
        const x = child(a, 1, textComparison && typeof b === 'string');
        if (op === 'not') {
            if (x.type !== 'bool' && x.type !== 'invalid') add('DM_SCHEMA', path, 'not requires a boolean operand.');
            return bool();
        }
        const y = child(b, 2, textComparison && typeof a === 'string');
        if (x.type === 'invalid' || y.type === 'invalid') return BAD;
        if (['eq', 'ne', 'lt', 'le', 'gt', 'ge'].includes(op)) {
            if (textComparison && ((x.type === 'text' && typeof b === 'string') || (y.type === 'text' && typeof a === 'string'))) return bool();
            if (x.type !== y.type || (['lt', 'le', 'gt', 'ge'].includes(op) && x.type !== 'int')) add('DM_SCHEMA', path, 'Comparison operands must have the same type; ordered comparisons require integers.');
            return bool();
        }
        if (op === 'and' || op === 'or') {
            if (x.type !== 'bool' || y.type !== 'bool') add('DM_SCHEMA', path, `${op} requires boolean operands.`);
            return bool();
        }
        if (x.type !== 'int' || y.type !== 'int') { add('DM_SCHEMA', path, 'Arithmetic requires integer operands without coercion.'); return BAD; }
        let lo, hi;
        if (op === 'add') { lo = x.min + y.min; hi = x.max + y.max; }
        if (op === 'sub') { lo = x.min - y.max; hi = x.max - y.min; }
        if (op === 'mul') {
            const endpoints = [x.min * y.min, x.min * y.max, x.max * y.min, x.max * y.max];
            lo = Math.min(...endpoints); hi = Math.max(...endpoints);
        }
        if (op === 'min') { lo = Math.min(x.min, y.min); hi = Math.min(x.max, y.max); }
        if (op === 'max') { lo = Math.max(x.min, y.min); hi = Math.max(x.max, y.max); }
        if (op === 'floorDiv') {
            if (!dmInt(b, 1)) { add('DM_BOUNDS', `${path}[2]`, 'floorDiv requires a positive integer literal divisor.'); return BAD; }
            lo = Math.floor(x.min / b); hi = Math.floor(x.max / b);
        }
        if (op === 'clamp') {
            const z = child(c, 3);
            if (z.type === 'invalid') return BAD;
            if (!dmInt(b) || !dmInt(c) || b > c) { add('DM_BOUNDS', path, 'clamp bounds must be ordered integer literals.'); return BAD; }
            lo = Math.max(b, Math.min(c, x.min)); hi = Math.max(b, Math.min(c, x.max));
        }
        // Ranges that sometimes overflow are guarded dynamically. A range with no safe
        // result is statically impossible. Children are checked before an outer clamp.
        if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > L.integer || hi < -L.integer) {
            add('DM_BOUNDS', path, 'Every possible arithmetic result overflows the host integer interval.');
            return BAD;
        }
        // Timer multiplication must be proved safe over the entire elapsed-time budget.
        if (env.timer && (lo < -L.integer || hi > L.integer)) add('DM_BOUNDS', path, 'Timer arithmetic must fit the host interval for every permitted elapsed interval.');
        return int(Math.max(-L.integer, lo), Math.min(L.integer, hi));
    };
    return visit(expression, at);
}

export function conditionType(expression, env, at, add) {
    const type = expressionType(expression, env, at, add);
    if (!['bool', 'invalid'].includes(type.type)) add('DM_CONDITION', at, 'A condition must produce a boolean, without coercion.');
}
