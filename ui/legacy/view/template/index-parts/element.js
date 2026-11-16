// Compiles one parsed element (and its children) into a binding node: data-each, data-if, data-bind, data-command, data-draft, widgets and the rest.

import { compileExpr, isLoopName, parseInterpolation, parsePath, splitPairs } from '../../bind.js';
import { attrAllowed } from '../sanitize.js';
import { MAX_JSON_DEPTH, compileJson, jsonDepth } from '../json.js';
import { STRINGS } from '../../../../../../../core/strings.js';

const COMMAND_TYPE = /^[a-z0-9][\w-]*(?:\.[\w-]+)+$/i;
const DRAFT_TAGS = new Set(['input', 'select', 'textarea', 'button']);
const BINDING_ATTRS = new Set(['data-each', 'data-if', 'data-bind', 'data-bind-attr', 'data-bind-var', 'data-class', 'data-payload', 'data-props']);
const BOOLEAN_ATTRS = new Set(['checked', 'disabled', 'selected', 'hidden', 'open', 'readonly', 'required', 'multiple', 'reversed', 'novalidate']);

export function compileChildren(nodes, warnings) {
    return nodes.map(node => (node.type === 'text' ? compileText(node.text) : compileElement(node, warnings))).filter(Boolean);
}

function compileText(text) {
    const parts = parseInterpolation(text);
    return parts ? { kind: 'text', parts } : { kind: 'text', text };
}

function compileElement(node, warnings) {
    const { tag, svg } = node;
    const attrs = new Map(node.attrs);
    const take = name => {
        const value = attrs.get(name);
        attrs.delete(name);
        return value;
    };
    const out = {
        kind: 'element', tag, svg,
        attrs: [], dynamicAttrs: [], bindText: null, bindAttrs: [], vars: [], classes: [],
        each: null, cond: null, command: null, payload: null, draft: null, draftClose: null, submit: null, widget: null, children: [],
    };

    const each = take('data-each');
    if (each !== undefined) {
        const match = /^\s*([\s\S]+?)\s+as\s+([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?\s*$/.exec(each);
        if (!match || !isLoopName(match[2]) || (match[3] && (!isLoopName(match[3]) || match[3] === match[2]))) {
            warnings.push(`data-each="${each}" should read "list as name" or "list as name, index" (names other than state, q, draft, settings, fmt and the helpers); the element was left out.`);
            return null;
        }
        out.each = { list: compileExpr(match[1]), path: parsePath(match[1]), name: match[2], index: match[3] ?? null };
    }
    const cond = take('data-if');
    if (cond !== undefined) out.cond = compileExpr(cond);

    const bind = take('data-bind');
    if (bind !== undefined) out.bindText = compileExpr(bind);

    for (const [name, expr] of splitPairs(take('data-bind-attr'))) {
        const lower = name.toLowerCase();
        if (lower === 'style' || lower === 'class' || lower.startsWith('data-') || !attrAllowed(tag, svg, svg ? name : lower)) {
            warnings.push(`data-bind-attr cannot set ${name} on <${tag}>${lower === 'class' ? ' (use data-class)' : lower === 'style' ? ' (use data-bind-var)' : ''}.`);
            continue;
        }
        out.bindAttrs.push({ name: svg ? name : lower, expr: compileExpr(expr), boolean: BOOLEAN_ATTRS.has(lower) });
    }
    for (const [name, expr] of splitPairs(take('data-bind-var'))) {
        if (!/^--[A-Za-z0-9_-]+$/.test(name)) {
            warnings.push(`data-bind-var sets CSS custom properties only (--name); "${name}" was skipped.`);
            continue;
        }
        out.vars.push({ name, expr: compileExpr(expr) });
    }
    for (const [name, expr] of splitPairs(take('data-class'))) {
        if (!/^-?[A-Za-z_][\w-]*$/.test(name)) {
            warnings.push(`data-class "${name}" is not a class name.`);
            continue;
        }
        out.classes.push({ name, expr: compileExpr(expr) });
    }

    const command = attrs.get('data-command');
    const payload = take('data-payload');
    if ([payload, attrs.get('data-props')].some(text => text !== undefined && jsonDepth(text) > MAX_JSON_DEPTH)) out.deepJson = true;
    if (command !== undefined) {
        if (COMMAND_TYPE.test(command.trim())) {
            out.payload = payload === undefined ? null : compileJson(payload, warnings, `data-payload of ${command}`);
            // A payload that does not read as JSON leaves the button without its command.
            if (payload === undefined || out.payload) out.command = command.trim();
            else attrs.delete('data-command');
        } else {
            warnings.push(`data-command="${command}" is not a command name (module.action).`);
            attrs.delete('data-command');
        }
    } else if (payload !== undefined) warnings.push('data-payload without data-command was ignored.');

    const draft = attrs.get('data-draft');
    if (draft !== undefined) {
        const path = parsePath(draft.trim().replace(/^draft\./, ''));
        if (!DRAFT_TAGS.has(tag)) warnings.push(`data-draft belongs on an input, select, textarea or button, not <${tag}>.`);
        else if (!path) warnings.push(`data-draft="${draft}" is not a path.`);
        else {
            out.draft = { path, type: tag === 'input' ? (attrs.get('type') ?? 'text') : tag };
        }
    }

    const close = take('data-draft-close');
    if (close !== undefined) {
        const path = parsePath(close.trim().replace(/^draft\./, ''));
        if (path) out.draftClose = { path };
        else warnings.push(`data-draft-close="${close}" is not a path.`);
    }

    const submit = attrs.get('data-submit');
    if (submit !== undefined) {
        if (COMMAND_TYPE.test(submit.trim())) out.submit = submit.trim();
        else {
            warnings.push(`data-submit="${submit}" is not a command name (module.action).`);
            attrs.delete('data-submit');
        }
    }

    const inlineControl = take('data-inline-control');
    const inlineControls = ['ss.editable', 'story-block.inventory-add'];
    if (tag === 'ss-widget' || (tag === 'span' && inlineControls.includes(inlineControl))) {
        const props = take('data-props');
        const name = tag === 'ss-widget' ? (attrs.get('name') ?? '').trim() : inlineControl;
        if (!name) warnings.push('An <ss-widget> has no name.');
        out.widget = { name, props: props === undefined ? null : compileJson(props, warnings, `data-props of ${name || 'a widget'}`) };
    } else if (attrs.has('data-props')) {
        take('data-props');
        warnings.push(`data-props belongs on <ss-widget>, not <${tag}>.`);
    }
    if (inlineControl !== undefined && !(tag === 'span' && inlineControls.includes(inlineControl))) warnings.push(STRINGS.editMessages.inlineControl);

    for (const name of BINDING_ATTRS) attrs.delete(name);
    for (const [name, value] of attrs) {
        const parts = name === 'style' ? null : parseInterpolation(value);
        if (parts) out.dynamicAttrs.push({ name, parts });
        else out.attrs.push([name, value]);
    }
    if ((out.command || out.draft) && tag === 'button' && !attrs.has('type')) out.attrs.push(['type', 'button']);
    if (!out.bindText && !out.widget) out.children = compileChildren(node.children, warnings);
    return out;
}
