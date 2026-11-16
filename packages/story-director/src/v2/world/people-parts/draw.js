// Story Director v2, people widget: draws the cast cards and chips into an element and keeps them fresh.

import { maker } from '../../screens/dom.js';
import { lineKey } from '../../../changes.js';
import { dossierOpener, castApi } from './delta-api.js';

export const HERE_QUERY = 'director.world.here';

let widgets = 0;   // one section id per widget (two World screens can be alive at once)

const later = typeof queueMicrotask === 'function' ? queueMicrotask : fn => Promise.resolve().then(fn);

export function render(el, props, api, { open = dossierOpener, cast = castApi } = {}) {
    const doc = el.ownerDocument ?? globalThis.document;
    const make = maker(doc);
    const box = make('div', 'wv-cast');
    const root = make('ul', 'wv-people', undefined, { 'aria-label': 'People here' });
    const mark = make('span', 'ss-pill ss-pill-soft wv-updating', 'updating');
    mark.hidden = true;
    el.replaceChildren(mark, box, root);
    let lastCards = [];
    let lastCovered = new Set();
    let value = props?.value ?? null;
    let off = null;
    let watched = null;
    let pending = false;
    let gone = false;
    // Flag `suite.redrawScheduler` on: the widget is a `people` section of sdk.panels (drawn once per frame, with the others) (the onChange subscription stays, idle while the flag is on, so the widget keeps updating if the flag is turned off).
    const panels = api?.panels?.on === true ? api.panels : null;
    let offSection = null;

    const thoughtNode = (thought, tag = 'span') => {
        const node = make(tag, 'wv-thought');
        node.append(make('i', 'fa-solid fa-comment-dots', undefined, { 'aria-hidden': 'true' }), ' ', make('span', 'wv-thought-text', thought));
        node.setAttribute?.('title', 'Inner chatter: only they know it');
        return node;
    };
    const chip = (person, opener, link) => {
        const item = make('li', 'wv-person');
        const face = link
            ? make('button', 'wv-chip wv-link', undefined, { type: 'button', title: `Open ${person.name}'s dossier` })
            : make('span', 'wv-chip');
        if (link) {
            face.append(make('i', 'fa-solid fa-address-card', undefined, { 'aria-hidden': 'true' }), ' ');
            face.addEventListener('click', event => {
                event?.stopPropagation?.();
                try { opener(person.name); } catch { /* the dossier could not open; nothing else to do */ }
            });
        }
        face.append(make('span', 'wv-name', person.name));
        if (typeof person.stance === 'string' && person.stance) face.append(' ', make('span', 'wv-stance', person.stance));
        item.append(face);
        if (typeof person.thought === 'string' && person.thought) item.append(thoughtNode(person.thought, 'p'));
        return item;
    };

    // Subscribes to NPC State Delta's changes once its page API is there (it may come after the first draw).
    const watch = page => {
        if (!page || watched === page) return;
        try { off?.(); } catch { /* gone */ }
        watched = page;
        try { off = page.onChange(refresh) ?? null; } catch { off = null; }
    };

    const draw = () => {
        const people = (Array.isArray(value?.people) ? value.people : []).filter(person => person && typeof person.name === 'string' && person.name);
        const page = value?.nsd === true ? cast?.() ?? null : null;
        watch(cast?.() ?? null);
        const covered = new Set();
        let cards = 0;
        if (page && page.available?.() === true) {
            const thoughts = new Map((Array.isArray(value?.chatter) ? value.chatter : []).filter(item => item?.key && item?.text).map(item => [item.key, item.text]));
            try {
                cards = Number(page.render(box, {
                    slot: (name, aliases = []) => {
                        const keys = [name, ...(Array.isArray(aliases) ? aliases : [])].map(lineKey).filter(Boolean);
                        keys.forEach(key => covered.add(key));
                        const key = keys.find(item => thoughts.has(item));
                        return key ? thoughtNode(thoughts.get(key)) : null;
                    },
                })) || 0;
            } catch { cards = 0; }
        }
        let keep = false;
        if (cards > 0) {
            box.hidden = false;
            lastCards = Array.from(box.children);
            lastCovered = new Set(covered);
        } else {
            let busy = false;
            try { busy = page && typeof page.busy === 'function' && page.busy() === true; } catch { busy = false; }
            keep = busy && lastCards.length > 0;
            box.replaceChildren(...(keep ? lastCards : []));
            box.hidden = !keep;
            if (keep) lastCovered.forEach(key => covered.add(key));
        }
        mark.hidden = !keep;
        const shown = cards > 0 || keep;
        const opener = open?.() ?? null;
        root.replaceChildren(...people
            .filter(person => !(shown && covered.has(person.key || lineKey(person.name))))
            .map(person => chip(person, opener, value?.nsd === true && person.dossier === true && opener)));
        root.hidden = root.children?.length === 0 && shown;
    };

    // The here view again (the dossier flags, the stances), then a redraw.
    function redraw() {
        if (gone) return;
        if (typeof api?.query === 'function') {
            try {
                const next = api.query(HERE_QUERY);
                if (next && typeof next === 'object') value = next;
            } catch { /* keep the last answer */ }
        }
        draw();
    }
    // NPC State Delta changed: redraw, once.
    function refresh() {
        if (pending || gone) return;
        if (offSection && api?.panels?.on === true) return;   // (the flag is on: the section draws it; this subscription only works once the flag goes off)
        pending = true;
        later(() => {
            pending = false;
            redraw();
        });
    }
    // What the section shows is the here view; a change NPC State announces (`changed(['people'])`) draws it even when that is the same answer.
    const hereView = () => { try { return api.query(HERE_QUERY) ?? null; } catch { return null; } };

    draw();
    if (panels) offSection = panels.register(`story-director.world-people.${widgets += 1}`, { keys: ['people'], drawn: true, isVisible: () => !gone && el.isConnected !== false, read: hereView, draw: redraw });
    return {
        update(next) { value = next?.value ?? null; draw(); },
        destroy() {
            gone = true;
            try { offSection?.(); } catch { /* gone */ }
            try { off?.(); } catch { /* gone */ }
            off = null;
            mark.remove();
            box.remove();
            root.remove();
        },
    };
}
