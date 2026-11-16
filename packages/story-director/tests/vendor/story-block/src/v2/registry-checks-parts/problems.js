// Checks a module definition and lists what refuses it.

import { parseRange } from '../packs/version.js';
import { HOST_DOMAIN } from '../timeline/gate.js';
import { SLUG } from '../packs/limits.js';
import { featureProblems } from '../features.js';
import { isObject, jsonProblem } from './shared-basics.js';
import { CAPTURE_PREFIX, HOST_MODULE, STANDARD_PREFIX } from './names.js';
import { MAX_CAPABILITIES } from './lists.js';
import { fieldProblem } from './fields.js';
import { headsOf, grammarOf } from './capture-heads.js';

const MODULE_ID = /^[a-z0-9][a-z0-9._-]*$/;
// Domain names are JSON Pointer segments (/domains/<name>/…): no `/` or `~`.
const DOMAIN = /^[a-z][a-zA-Z0-9_-]*$/;
const COMMAND = /^[a-z][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9_-]+)*$/;
const KIND = /^[a-z][a-z0-9_-]*$/;
const TAB_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const FOLD_ID = /^[a-z0-9][a-z0-9_-]*$/;
// Screen ids are namespaced like `story-director/world` (§13.1); widget names like `story-director.world-card`.
const SCREEN_ID = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;
const WIDGET_NAME = /^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)+$/;

/**
 * Checks a module definition (§6). Returns the list of problems, each a plain sentence part;
 * empty when it can register (clashes with other modules are checked by the registry).
 */
export function definitionProblems(def) {
    if (!isObject(def)) return ['the definition is not an object'];
    const problems = [];
    const fn = (value, where) => { if (typeof value !== 'function') problems.push(`${where} is not a function`); };
    const map = (value, where) => {
        if (value === undefined) return false;
        if (!isObject(value)) { problems.push(`${where} is not an object`); return false; }
        return true;
    };
    if (typeof def.id !== 'string' || !MODULE_ID.test(def.id)) problems.push('its id must be lowercase letters, digits, ".", "_" or "-" (like "story-director")');
    for (const key of ['name', 'version', 'description']) if (def[key] !== undefined && typeof def[key] !== 'string') problems.push(`${key} is not text`);
    if (def.requires !== undefined) {
        if (!isObject(def.requires)) problems.push('requires is not an object (like { storyBlock: ">=2.0.0" })');
        else if (def.requires.storyBlock !== undefined && (typeof def.requires.storyBlock !== 'string' || !parseRange(def.requires.storyBlock))) {
            problems.push('requires.storyBlock is not a version range (like ">=2.0.0" or "^2")');
        }
        if (def.requires.peers !== undefined) {
            if (!isObject(def.requires.peers)) problems.push('requires.peers is not an object (like { "story-director": "^2" })');
            else for (const [peer, range] of Object.entries(def.requires.peers)) {
                if (!MODULE_ID.test(peer)) problems.push(`requires.peers names "${peer}", which is not a module id (like "story-director")`);
                else if (typeof range !== 'string' || !parseRange(range)) problems.push(`requires.peers["${peer}"] is not a version range (like ">=2.0.0" or "^2")`);
            }
        }
    }

    if (def.capabilities !== undefined) {
        if (!Array.isArray(def.capabilities)) problems.push('capabilities is not a list of names (like ["custom-data"])');
        else if (def.capabilities.length > MAX_CAPABILITIES) problems.push(`capabilities lists more than ${MAX_CAPABILITIES} names`);
        else for (const name of def.capabilities) {
            if (typeof name !== 'string' || !SLUG.test(name)) problems.push(`capabilities names ${JSON.stringify(name)}, which is not a capability name (lowercase words joined by "-", like "custom-data")`);
        }
    }

    if (map(def.domains, 'domains')) {
        for (const [name, domain] of Object.entries(def.domains)) {
            if (!DOMAIN.test(name)) { problems.push(`the domain name "${name}" must start with a letter and use letters, digits, "_" or "-"`); continue; }
            if (name === HOST_DOMAIN) { problems.push(`the domain name "${name}" is the host's own (the timeline's save points); a module cannot declare it`); continue; }
            if (!isObject(domain)) { problems.push(`domain "${name}" is not an object`); continue; }
            fn(domain.initial, `domain "${name}" initial`);
            if (domain.deferred !== undefined && typeof domain.deferred !== 'boolean') problems.push(`domain "${name}" deferred must be true or false`);
            if (domain.validate !== undefined) fn(domain.validate, `domain "${name}" validate`);
            if (domain.counters !== undefined && (!Array.isArray(domain.counters) || domain.counters.some(path => typeof path !== 'string' || !/^[^/~][^~]*$/.test(path)))) {
                problems.push(`domain "${name}" counters must be a list of paths inside the domain, like "wallets/*/coin"`);
            }
            if (domain.scratch !== undefined && (!Array.isArray(domain.scratch) || domain.scratch.some(key => typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)))) {
                problems.push(`domain "${name}" scratch must be a list of field names in the domain, like "perReply"`);
            }
            if (typeof domain.initial === 'function') {
                let slice;
                try { slice = domain.initial(); } catch (error) { problems.push(`domain "${name}" initial() threw: ${error?.message ?? error}`); continue; }
                const problem = isObject(slice) ? jsonProblem(slice, `/domains/${name}`) : `domain "${name}" initial() does not return an object`;
                if (problem) problems.push(problem);
            }
        }
    }
    if (map(def.commands, 'commands')) {
        for (const [type, handler] of Object.entries(def.commands)) {
            if (!COMMAND.test(type)) problems.push(`the command name "${type}" must be words joined by dots (like "item.use")`);
            else if (type.startsWith(CAPTURE_PREFIX) || type.startsWith('module.')) problems.push(`the command name "${type}" uses a prefix Story Block keeps for itself ("capture." or "module.")`);
            if (isObject(handler)) {
                fn(handler.handler, `command "${type}" handler`);
                if (handler.internal !== undefined && typeof handler.internal !== 'boolean') problems.push(`command "${type}" internal is not true or false`);
                if (handler.prelude !== undefined && typeof handler.prelude !== 'boolean') problems.push(`command "${type}" prelude is not true or false`);
            } else fn(handler, `command "${type}"`);
        }
    }
    if (map(def.queries, 'queries')) {
        for (const [name, query] of Object.entries(def.queries)) {
            if (!COMMAND.test(name)) problems.push(`the query name "${name}" must be words joined by dots (like "party.actors")`);
            fn(query, `query "${name}"`);
        }
    }
    // The queries a guard may ask on replay (docs/v2/REPLAY.md): the module's own, named here, and a promise that each depends on
    // the state and its arguments alone.
    if (def.replayQueries !== undefined) {
        if (!Array.isArray(def.replayQueries)) problems.push('replayQueries is not a list of query names');
        else {
            for (const name of def.replayQueries) {
                if (typeof name !== 'string') problems.push('replayQueries names something that is not a query name');
                else if (typeof def.queries?.[name] !== 'function') problems.push(`replayQueries names "${name}", which is not one of this module's queries`);
            }
        }
    }
    if (map(def.capture, 'capture')) {
        const kinds = def.capture.kinds;
        if (!isObject(kinds) || !Object.keys(kinds).length) problems.push('capture.kinds names no kind');
        else {
            for (const [kind, spec] of Object.entries(kinds)) {
                if (!KIND.test(kind)) problems.push(`the capture kind "${kind}" must be lowercase letters, digits, "_" or "-"`);
                if (!isObject(spec)) { problems.push(`capture kind "${kind}" is not an object`); continue; }
                // `grammar` may be a function answering the line when the static part is built (a line that depends on what is
                // installed, such as an enabled pack: Story Block's `you`); it must answer one line of text.
                if (typeof spec.grammar === 'function') { /* read where it is used (grammarOf) */ }
                // (`heads`: a kind may send no grammar line and only name the heads a stray line of it is taken by, ['+ event', '~ event'].)
                else if (typeof spec.grammar === 'string' && !spec.grammar.trim() && headsOf(spec).length) { /* no line in the prompt, only heads */ }
                else if (typeof spec.grammar !== 'string' || !spec.grammar.trim()) problems.push(`capture kind "${kind}" has no grammar line`);
                else if (/\n/.test(spec.grammar.trim())) problems.push(`capture kind "${kind}" grammar is more than one line`);
                // Heads take stray lines for a kind, so each must name that kind (or an alias of it): another kind's head would take its lines.
                if (spec.heads !== undefined) {
                    const own = new Set([kind, ...(Array.isArray(spec.aliases) ? spec.aliases : [])]);
                    for (const head of Array.isArray(spec.heads) ? spec.heads : [spec.heads]) {
                        if (!own.has(typeof head === 'string' ? head.split(' ')[1] : undefined)) problems.push(`capture kind "${kind}" has a head "${String(head)}" that does not name the kind itself`);
                    }
                }
                if (spec.aliases !== undefined && (!Array.isArray(spec.aliases) || spec.aliases.some(alias => typeof alias !== 'string' || !KIND.test(alias)))) {
                    problems.push(`capture kind "${kind}" aliases must be a list of lowercase words`);
                }
                // A display kind (SPEC §4.4): read for the reader alone, no command runs (extras.js).
                if (spec.display !== undefined && spec.display !== false) {
                    const display = spec.display;
                    if (display !== true && !isObject(display)) problems.push(`capture kind "${kind}" display is not true or an object`);
                    else if (isObject(display)) {
                        if (display.perReply !== undefined && !(Number.isInteger(display.perReply) && display.perReply > 0)) problems.push(`capture kind "${kind}" display.perReply is not a positive whole number`);
                        if (display.read !== undefined && typeof display.read !== 'function') problems.push(`capture kind "${kind}" display.read is not a function`);
                        if (display.noun !== undefined && typeof display.noun !== 'string') problems.push(`capture kind "${kind}" display.noun is not text`);
                    }
                }
            }
        }
        fn(def.capture.apply, 'capture.apply');
    }
    if (map(def.context, 'context')) {
        if (def.context.static !== undefined) fn(def.context.static, 'context.static');
        if (def.context.tail !== undefined) fn(def.context.tail, 'context.tail');
        if (def.context.budget !== undefined && !(Number.isInteger(def.context.budget) && def.context.budget > 0)) problems.push('context.budget is not a positive whole number of tokens');
        // A context part: static and/or tail text of its own, usually under a feature (MODULES §F100).
        if (def.context.parts !== undefined) {
            if (!Array.isArray(def.context.parts)) problems.push('context.parts is not a list');
            else def.context.parts.forEach((part, index) => {
                const where = `context part ${index + 1}`;
                if (!isObject(part)) { problems.push(`${where} is not an object`); return; }
                if (part.static === undefined && part.tail === undefined) problems.push(`${where} has neither static nor tail`);
                if (part.static !== undefined) fn(part.static, `${where} static`);
                if (part.tail !== undefined) fn(part.tail, `${where} tail`);
            });
        }
    }
    if (map(def.hooks, 'hooks')) for (const [name, hook] of Object.entries(def.hooks)) fn(hook, `hook "${name}"`);
    // Cards under replies (reply-cards.js): each is { for(state, message, ctx) }.
    if (map(def.cards, 'cards')) {
        for (const [id, card] of Object.entries(def.cards)) {
            if (!isObject(card)) problems.push(`card "${id}" is not an object`);
            else fn(card.for, `card "${id}" for`);
        }
    }
    // The game view header's one toggle (view/game-header.js headerControlItems): { id, label, icon, query, command, args?, payload?, feature? }.
    if (def.headerControls !== undefined) {
        if (!Array.isArray(def.headerControls)) problems.push('headerControls is not a list');
        else if (def.headerControls.length > 1) problems.push('a module may add one header control, not several');
        else def.headerControls.forEach(control => {
            if (!isObject(control)) { problems.push('the header control is not an object'); return; }
            if (typeof control.id !== 'string' || !FOLD_ID.test(control.id)) problems.push('the header control has no usable id');
            for (const key of ['label', 'icon', 'query', 'command']) if (typeof control[key] !== 'string' || !control[key].trim()) problems.push(`the header control has no ${key}`);
            for (const key of ['args', 'payload']) if (control[key] !== undefined && !isObject(control[key])) problems.push(`the header control's ${key} is not an object`);
        });
    }
    if (map(def.settings, 'settings')) {
        const { defaults, schema, section, render, folds } = def.settings;
        if (defaults !== undefined) {
            if (!isObject(defaults)) problems.push('settings.defaults is not an object');
            else { const problem = jsonProblem(defaults, 'settings.defaults'); if (problem) problems.push(problem); }
        }
        if (schema !== undefined) {
            if (!isObject(schema)) problems.push('settings.schema is not an object');
            else for (const [key, field] of Object.entries(schema)) {
                const problem = fieldProblem(field, `settings field "${key}"`);
                if (problem) problems.push(problem);
            }
        }
        // `section` is either the custom panel itself, section(el, api), or its title with the panel
        // in `render(el, api)` (MODULES §A).
        if (section !== undefined && typeof section !== 'string') fn(section, 'settings.section');
        if (render !== undefined) fn(render, 'settings.render');
        // `folds`: panels of their own at the top of the settings, after Story Suite's (Story Block's Packs).
        if (folds !== undefined) {
            if (!Array.isArray(folds)) problems.push('settings.folds is not a list');
            else folds.forEach((item, index) => {
                const where = `settings fold ${index + 1}`;
                if (!isObject(item)) { problems.push(`${where} is not an object`); return; }
                if (typeof item.id !== 'string' || !FOLD_ID.test(item.id)) problems.push(`${where} has no usable id`);
                if (typeof item.title !== 'string' || !item.title.trim()) problems.push(`${where} has no title`);
                if (item.hint !== undefined && typeof item.hint !== 'string') problems.push(`${where}'s hint is not text`);
                fn(item.render, `${where} render`);
            });
        }
    }
    if (def.tabs !== undefined) {
        if (!Array.isArray(def.tabs)) problems.push('tabs is not a list');
        else def.tabs.forEach((tab, index) => {
            if (!isObject(tab)) { problems.push(`tab ${index + 1} is not an object`); return; }
            if (typeof tab.id !== 'string' || !TAB_ID.test(tab.id)) problems.push(`tab ${index + 1} has no usable id`);
            if (typeof tab.title !== 'string' || !tab.title.trim()) problems.push(`tab "${tab.id ?? index + 1}" has no title`);
            if (tab.icon !== undefined && typeof tab.icon !== 'string') problems.push(`tab "${tab.id}" icon is not text`);
            if (tab.bar !== undefined && typeof tab.bar !== 'boolean') problems.push(`tab "${tab.id}" bar is not true or false`);
            fn(tab.render, `tab "${tab.id ?? index + 1}" render`);
        });
    }
    // Screens and widgets (§13): only what the registry needs (ids, a render function); the screen
    // renderer checks the rest of a screen when it shows it.
    if (def.screens !== undefined) {
        if (!Array.isArray(def.screens)) problems.push('screens is not a list');
        else def.screens.forEach((screen, index) => {
            if (!isObject(screen)) problems.push(`screen ${index + 1} is not an object`);
            else if (typeof screen.id !== 'string' || !SCREEN_ID.test(screen.id)) problems.push(`screen ${index + 1} has no usable id (like "${def.id ?? 'module'}/name")`);
        });
    }
    if (map(def.widgets, 'widgets')) {
        for (const [name, widget] of Object.entries(def.widgets)) {
            // Story Block's own standard widgets are `ss.<name>` (MODULES §F9); everyone else uses its id.
            const prefix = def.id === HOST_MODULE ? STANDARD_PREFIX : `${def.id}.`;
            if (!WIDGET_NAME.test(name) || (typeof def.id === 'string' && !name.startsWith(prefix))) problems.push(`the widget name "${name}" must start with the module id and a dot (like "${def.id}.${name.split('.').at(-1)}")`);
            if (!isObject(widget)) { problems.push(`widget "${name}" is not an object`); continue; }
            fn(widget.render, `widget "${name}" render`);
        }
    }
    problems.push(...featureProblems(def));
    return problems;
}
