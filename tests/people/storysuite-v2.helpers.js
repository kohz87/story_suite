import { createStorySuiteV2Adapter } from '../src/storysuite-v2.js';

// Story Suite v2 adapter (src/storysuite-v2.js): Delta registers with a Story Block v2 host when one
// is on the page, and does nothing otherwise. A fake sdk, a fake Delta runtime, fake timers and a
// small fake DOM stand in for Story Block, index.js, the browser and SillyTavern's drawer.

// ---- a small DOM: just what the adapter touches ----
export class FakeNode {
    constructor(doc, tag = 'div') {
        this.ownerDocument = doc;
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.style = {};
        this.dataset = {};
        this.hidden = false;
        this.id = '';
        this.listeners = {};
        this.writes = 0;
        this.html = '';
        const classes = new Set();
        this.classList = {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            contains: name => classes.has(name),
        };
    }
    set className(value) { this._cls = String(value); String(value).split(/\s+/).filter(Boolean).forEach(name => this.classList.add(name)); }
    get innerHTML() { return this.html + this.children.map(child => child.serialize()).join(''); }
    set innerHTML(value) { this.html = String(value); this.children = []; this.writes += 1; }
    append(...nodes) { for (const node of nodes) this.appendChild(node); }
    setAttribute(key, value) { (this.attrs ??= {})[key] = String(value); }
    getAttribute(key) { return this.attrs?.[key] ?? null; }
    // The markup a reader sees for DOM-built children (class, data-*, attributes, text escaped).
    serialize() {
        if (this.tagName === '#text') return this.html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const cls = this._cls ? ` class="${this._cls}"` : '';
        const data = Object.entries(this.dataset ?? {}).map(([key, value]) => ` data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}="${String(value)}"`).join('');
        const extra = Object.entries(this.attrs ?? {}).map(([key, value]) => ` ${key}="${value}"`).join('');
        return `<${String(this.tagName).toLowerCase()}${cls}${data}${extra}>${this.html}${this.children.map(child => child.serialize()).join('')}</${String(this.tagName).toLowerCase()}>`;
    }
    set textContent(value) { this.replaceChildren(); this.html = String(value); }
    get textContent() { return this.html; }
    get isConnected() {
        let node = this;
        while (node.parentNode) node = node.parentNode;
        return node === this.ownerDocument.documentElement;
    }
    detach() {
        if (!this.parentNode) return;
        const siblings = this.parentNode.children;
        siblings.splice(siblings.indexOf(this), 1);
        this.parentNode = null;
    }
    appendChild(child) {
        child.detach();
        this.children.push(child);
        child.parentNode = this;
        return child;
    }
    insertBefore(child, ref) {
        child.detach();
        const at = this.children.indexOf(ref);
        this.children.splice(at < 0 ? this.children.length : at, 0, child);
        child.parentNode = this;
        return child;
    }
    before(node) { this.parentNode.insertBefore(node, this); }
    remove() { this.detach(); }
    replaceChildren(...nodes) {
        for (const child of [...this.children]) child.detach();
        this.html = '';
        for (const node of nodes) this.appendChild(node);
    }
    contains(node) {
        for (let at = node; at; at = at.parentNode) if (at === this) return true;
        return false;
    }
    *walk() {
        for (const child of this.children) {
            yield child;
            yield* child.walk();
        }
    }
    querySelector(selector) {
        const name = selector.replace(/^\./, '');
        for (const node of this.walk()) if (node.classList.contains(name)) return node;
        return null;
    }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
}

export function fakeDocument() {
    const doc = { listeners: {} };
    doc.createElement = tag => new FakeNode(doc, tag);
    doc.createTextNode = text => Object.assign(new FakeNode(doc, '#text'), { html: String(text) });
    doc.documentElement = new FakeNode(doc, 'html');
    doc.body = doc.documentElement.appendChild(new FakeNode(doc, 'body'));
    doc.getElementById = id => {
        for (const node of doc.documentElement.walk()) if (node.id === id) return node;
        return null;
    };
    doc.addEventListener = (name, fn) => { (doc.listeners[name] ||= []).push(fn); };
    doc.dispatch = name => { for (const fn of doc.listeners[name] || []) fn({ type: name }); };
    doc.sent = [];
    doc.dispatchEvent = event => {
        doc.sent.push({ type: event.type, detail: event.detail });
        for (const fn of doc.listeners[event.type] || []) fn(event);
        return true;
    };
    return doc;
}

// SillyTavern's extensions drawer with Delta's panel (an extension_container holding an inline-drawer).
export function drawerWithPanel(doc, { display = 'block' } = {}) {
    const drawer = doc.body.appendChild(doc.createElement('div'));
    drawer.id = 'extensions_settings2';
    const before = drawer.appendChild(doc.createElement('div'));
    const panel = drawer.appendChild(doc.createElement('div'));
    panel.id = 'npc_state_delta_settings';
    panel.style.display = display;
    const inline = panel.appendChild(doc.createElement('div'));
    inline.className = 'inline-drawer';
    const after = drawer.appendChild(doc.createElement('div'));
    return { drawer, panel, inline, before, after };
}

export function fakeTimers() {
    let next = 1;
    const timeouts = new Map();
    const intervals = new Map();
    return {
        timeouts, intervals,
        setTimeout(fn) { const id = next++; timeouts.set(id, fn); return id; },
        clearTimeout(id) { timeouts.delete(id); },
        setInterval(fn) { const id = next++; intervals.set(id, fn); return id; },
        clearInterval(id) { intervals.delete(id); },
        /** Run every pending timeout once (the ones they schedule wait for the next call). */
        runTimeouts() {
            const due = [...timeouts.entries()];
            timeouts.clear();
            for (const [, fn] of due) fn();
            return due.length;
        },
        runIntervals() { for (const fn of [...intervals.values()]) fn(); },
    };
}

export function fakeSdk({ fail = false } = {}) {
    const sdk = {
        registered: [],
        registerModule(def) {
            if (fail) throw new Error('clash');
            sdk.registered.push(def);
        },
    };
    return sdk;
}

export const NPCS = [
    { id: 'npc_mira', name: 'Mira', aliases: ['The Smith'], present: true, archived: false },
    { id: 'npc_oren', name: 'Oren', aliases: [], present: false, archived: false },
    { id: 'npc_kael', name: 'Kael', aliases: [], present: false, archived: true },
];
export const RECORDS = {
    npc_mira: {
        id: 'npc_mira', name: 'Mira', aliases: ['The Smith'], role: 'Blacksmith', species: 'Human', personality: 'Blunt',
        memories: ['Forged the gate'], customFields: { Rank: 'Master' }, relationship: { trust: 12, affection: 3, desire: 0, tension: -4 },
        present: true, archived: false, lifeState: 'alive',
        portraitPromptPositive: 'secret prompt', profileEvidence: { role: ['x'] }, updatedAt: 99, manualProfileFields: ['role'],
    },
    npc_oren: { id: 'npc_oren', name: 'Oren', aliases: [], role: 'Guard', present: false, archived: false },
};
export const PNG = 'data:image/png;base64,iVBORw0KGgo=';
export const WEBP = 'data:image/webp;base64,UklGRg==';
export const FORM_PORTRAITS = {};

export function fakeDelta() {
    const delta = {
        enabled: true, cast: '<section class="npc-state-delta-present-roster">Mira</section>', filled: [], scans: 0, adds: 0,
        npcs: structuredClone(NPCS),
        suiteApi: { npcs: () => structuredClone(delta.npcs) },
        api: {
            isEnabled: () => delta.enabled,
            presentCastHtml: () => delta.cast,
            castEmptyReason: () => ({ text: 'The latest scan found no NPC in the scene.', scan: true }),
            fillPresentCast: root => delta.filled.push(root),
            getNpc: id => (RECORDS[id] ? structuredClone(RECORDS[id]) : null),
            formPortraits: id => structuredClone(FORM_PORTRAITS[id] || {}),
            scan: () => { delta.scans += 1; },
            addNpc: () => { delta.adds += 1; },
        },
    };
    return delta;
}

export function setup({ hostValue, delta = fakeDelta(), loadEmptyCast, calendarOwn } = {}) {
    const doc = fakeDocument();
    const dom = drawerWithPanel(doc);
    const timers = fakeTimers();
    const warnings = [];
    const box = { host: hostValue };
    const adapter = createStorySuiteV2Adapter({
        suiteApi: delta.suiteApi,
        delta: () => delta.api,
        version: '1.18.0',
        host: () => box.host,
        doc,
        timers,
        logger: { warn: (...args) => warnings.push(args) },
        ...(loadEmptyCast ? { loadEmptyCast } : {}),
        ...(calendarOwn ? { calendarOwn } : {}),
    });
    return { doc, dom, timers, warnings, box, adapter, delta };
}

export const v2Host = sdk => ({ ready: Promise.resolve(sdk) });

export async function hosted(options = {}) {
    const sdk = options.sdk || fakeSdk();
    const env = setup({ hostValue: v2Host(sdk), ...options });
    env.adapter.start();
    if (await env.adapter.settled() !== true) throw new Error('expected hosted adapter to settle');
    return { ...env, sdk, def: sdk.registered[0] };
}

// A Delta whose records carry portraits: Mira has a main portrait and a Raven form image, Oren none.
export function portraitDelta({ mira = {}, forms = { Raven: { form: 'Raven', dataUrl: WEBP } } } = {}) {
    const delta = fakeDelta();
    const records = {
        npc_mira: { ...structuredClone(RECORDS.npc_mira), portrait: { dataUrl: PNG, sourceName: 'mira.png' }, ...mira },
        npc_oren: structuredClone(RECORDS.npc_oren),
        npc_kael: { id: 'npc_kael', name: 'Kael', archived: true, portrait: { dataUrl: PNG } },
    };
    delta.records = records;
    delta.formReads = [];
    delta.api.getNpc = id => (records[id] ? structuredClone(records[id]) : null);
    delta.api.formPortraits = id => { delta.formReads.push(id); return id === 'npc_mira' ? structuredClone(forms) : {}; };
    return delta;
}

// A v1-style registry, as suite.js makes it, with Story Block v1's openSuite.
export function fakeRegistry() {
    const providers = new Map();
    const opened = [];
    return {
        opened,
        announce(provider) { providers.set(provider.id, { ...provider }); },
        withdraw(id) { providers.delete(id); },
        providers: () => [...providers.values()],
        has: id => providers.has(id),
        api: id => providers.get(id)?.api ?? null,
    };
}
