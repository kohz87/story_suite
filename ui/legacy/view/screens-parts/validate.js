// Checking a screen definition: one plain error string per problem.

import { themeVars } from '../css.js';
import { MOUNTS, CSS_LIMIT, SUMMARY_MAX } from './constants.js';
import { dataOrder } from './data.js';
import { isRecord } from './shared-record.js';

const SCREEN_ID = /^[A-Za-z0-9][\w.-]*(?:\/[A-Za-z0-9][\w.-]*)*$/;
const ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PROPERTY = /^--[A-Za-z0-9_-]+$/;
const BINDING_KEYS = new Set(['query', 'args']);
const STEP_KEYS = new Set(['id', 'title', 'template', 'layout']);


const utf8 = new TextEncoder();
const label = def => (typeof def?.id === 'string' && def.id ? `Screen "${def.id}"` : 'The screen');

/** One error string per problem with a screen definition; empty when it is fine. */
export function validateScreen(def, { id = null } = {}) {
    if (!isRecord(def)) return ['A screen definition must be an object.'];
    const errors = [];
    const name = label(def);
    if (typeof def.id !== 'string' || !SCREEN_ID.test(def.id)) {
        errors.push('The screen needs an id made of letters, digits, ".", "_", "-" and "/" (for example "example-module/world").');
    } else if (id !== null && def.id !== id) {
        errors.push(`${name} was given for screen "${id}".`);
    }
    if (def.title !== undefined && typeof def.title !== 'string') errors.push(`${name}: the title must be text.`);
    if (def.defaultOn !== undefined && typeof def.defaultOn !== 'boolean') errors.push(`${name}: defaultOn must be true or false.`);
    // In the bar by default (the game view's navigation, the Story panel's tabs), until the reader moves it under More.
    if (def.bar !== undefined && typeof def.bar !== 'boolean') errors.push(`${name}: bar must be true or false.`);
    // A tab or screen that is shown only while it is active: active(state, ctx) → { on, badge? }, and the note Settings shows for it.
    if (def.active !== undefined && typeof def.active !== 'function') errors.push(`${name}: active must be a function (state, ctx) → { on, badge? }.`);
    // A card screen's own part of the closed line under a reply: a template read in the card's scope, like its body.
    if (def.summary !== undefined && (typeof def.summary !== 'string' || def.summary.length > SUMMARY_MAX)) errors.push(`${name}: summary must be a template of text, at most ${SUMMARY_MAX} characters.`);
    if (def.activeNote !== undefined && typeof def.activeNote !== 'string') errors.push(`${name}: activeNote must be text.`);
    if (def.icon !== undefined && typeof def.icon !== 'string') errors.push(`${name}: the icon must be text.`);
    if (def.width !== undefined && def.width !== 'wide') errors.push(`${name}: width must be "wide" (a dialog's wider window) or left out.`);
    if (def.order !== undefined && !(typeof def.order === 'number' && Number.isFinite(def.order))) errors.push(`${name}: order must be a number (lower comes first).`);

    const mounts = Array.isArray(def.mounts) ? def.mounts : null;
    if (!mounts || !mounts.length) errors.push(`${name} must list where it may appear (mounts: ${MOUNTS.join(', ')}).`);
    else {
        for (const mount of mounts) if (!MOUNTS.includes(mount)) errors.push(`${name}: "${mount}" is not a mount (use ${MOUNTS.join(', ')}).`);
        if (new Set(mounts).size !== mounts.length) errors.push(`${name} lists a mount twice.`);
    }

    errors.push(...bodyErrors(def, name));
    if (def.css !== undefined) {
        if (typeof def.css !== 'string') errors.push(`${name}: css must be text.`);
        else if (utf8.encode(def.css).length > CSS_LIMIT) errors.push(`${name}: css is larger than 64 KB.`);
    }
    if (def.theme !== undefined) {
        if (!isRecord(def.theme)) errors.push(`${name}: theme must be an object of CSS custom properties.`);
        else {
            for (const [key, value] of Object.entries(def.theme)) {
                if (!PROPERTY.test(key)) errors.push(`${name}: theme key "${key}" is not a CSS custom property (--name).`);
                else if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) {
                    errors.push(`${name}: theme value for ${key} must be text or a number.`);
                } else {
                    for (const warning of themeVars({ [key]: value }).warnings) errors.push(`${name}: ${warning}`);
                }
            }
        }
    }
    if (def.data !== undefined) errors.push(...dataErrors(def.data, name));
    if (def.steps !== undefined) errors.push(...stepErrors(def, name, mounts));
    return errors;
}

// Exactly one of `template` (HTML text) and `layout` ({ root: Node }).
function bodyErrors(def, name, what = '') {
    const hasTemplate = def.template !== undefined;
    const hasLayout = def.layout !== undefined;
    if (hasTemplate === hasLayout) return [`${name}${what} needs exactly one of template or layout.`];
    if (hasTemplate && typeof def.template !== 'string') return [`${name}${what}: the template must be text.`];
    if (hasLayout && !(isRecord(def.layout) && isRecord(def.layout.root))) return [`${name}${what}: layout must be { root: { … } }.`];
    return [];
}

function dataErrors(data, name) {
    if (!isRecord(data)) return [`${name}: data must be an object of { query, args } bindings.`];
    const errors = [];
    for (const [alias, binding] of Object.entries(data)) {
        if (!ALIAS.test(alias)) errors.push(`${name}: "${alias}" is not a usable data name (letters, digits and _).`);
        if (!isRecord(binding)) {
            errors.push(`${name}: data "${alias}" must be { query, args }.`);
            continue;
        }
        if (typeof binding.query !== 'string' || !binding.query) errors.push(`${name}: data "${alias}" needs a query name.`);
        if (binding.args !== undefined && !isRecord(binding.args)) errors.push(`${name}: data "${alias}" args must be an object.`);
        for (const key of Object.keys(binding)) if (!BINDING_KEYS.has(key)) errors.push(`${name}: data "${alias}" has an unknown field "${key}".`);
    }
    if (!errors.length) {
        const order = dataOrder(data);
        if (!order.ok) errors.push(`${name}: ${order.message}`);
    }
    return errors;
}

function stepErrors(def, name, mounts) {
    const errors = [];
    if (!mounts || mounts.some(mount => mount !== 'dialog')) errors.push(`${name}: steps are only for screens shown as a dialog (mounts: ['dialog']).`);
    if (!Array.isArray(def.steps) || !def.steps.length) return [...errors, `${name}: steps must be a list of { id, title, template }.`];
    const seen = new Set();
    def.steps.forEach((step, index) => {
        const where = ` step ${index + 1}`;
        if (!isRecord(step)) {
            errors.push(`${name}${where} must be { id, title, template }.`);
            return;
        }
        if (typeof step.id !== 'string' || !step.id) errors.push(`${name}${where} needs an id.`);
        else if (seen.has(step.id)) errors.push(`${name}: two steps are called "${step.id}".`);
        else seen.add(step.id);
        if (step.title !== undefined && typeof step.title !== 'string') errors.push(`${name}${where}: the title must be text.`);
        errors.push(...bodyErrors(step, name, where));
        for (const key of Object.keys(step)) if (!STEP_KEYS.has(key)) errors.push(`${name}${where} has an unknown field "${key}".`);
    });
    return errors;
}
