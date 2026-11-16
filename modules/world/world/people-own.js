// Story Director v2, World people (flag `suite.worldPeopleOwn`): draws the present cast's cards itself from NPC State's queries
// (npc.present, npc.meters, npc.portrait, npc.dossier; `director.keyPeople` for the Key tag) instead of NPC State Delta's global page API.
// `createOwnCast(api, { open })` has the page API's shape ({ available, busy, render, onChange }), so the widget's chips, thoughts and
// covered-people logic (people-parts/draw.js) stay exactly as they are. The cards use NPC State's own classes (its stylesheet draws them).

import { lineKey } from '../changes.js';

const CLASS = {
    pane: 'npc-state-delta-story-pane', roster: 'npc-state-delta-present-roster', head: 'npc-state-delta-present-roster-head', grid: 'npc-state-delta-present-grid',
    cell: 'npc-state-delta-present-cell', card: 'npc-state-delta-present-card', text: 'npc-state-delta-present-card-text',
};

const text = value => (typeof value === 'string' ? value.trim() : '');

export function createOwnCast(api, { open = () => null, signal = () => null } = {}) {
    const who = new WeakMap();   // a cell → { name, aliases }
    const listeners = new Set();
    let tell = null;             // the page API object whose onChange we follow, and how to let go of it
    // NPC State's own change tell (its people cache refills after a swipe, delete or chat change without a store write): a signal only, nothing is drawn
    // from it. While `suite.redrawScheduler` is off the own path depends on `NPCStateDeltaCast.onChange` for it, so J15 needs an sdk-side tell (or the
    // scheduler on) before that global goes. `signal()` is asked again at each render, so a page API that appears after the mount is followed too.
    const follow = () => {
        let page = null;
        try { page = signal() ?? null; } catch { page = null; }
        if (page === (tell?.page ?? null)) return;
        try { tell?.off?.(); } catch { /* gone */ }
        tell = null;
        if (!page || !listeners.size) return;
        try { tell = { page, off: page.onChange?.(() => listeners.forEach(fn => fn())) }; } catch { tell = null; }
    };
    const ask = (name, args) => { try { return api?.query?.(name, args) ?? null; } catch { return null; } };
    const names = () => {
        const list = ask('npc.present', {});
        return Array.isArray(list) ? list.map(text).filter(Boolean) : null;
    };
    const keyKeys = () => {
        const out = new Set();
        const list = ask('director.keyPeople', {});
        for (const entry of Array.isArray(list) ? list : []) {
            if (!entry || entry.removed) continue;
            for (const label of [entry.name, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]) { const key = lineKey(text(label)); if (key) out.add(key); }
        }
        return out;
    };

    // One person's card cell (the markup of Delta's present card, as the World draws it: no now lines, no side copy).
    function cell(doc, name, keys) {
        const dossier = ask('npc.dossier', { name }) ?? {};
        const shown = text(dossier.name) || name;
        const meters = ask('npc.meters', { name });
        const portrait = ask('npc.portrait', { name });
        const id = text(dossier.id) || shown;
        const make = (tag, className, content) => {
            const node = doc.createElement(tag);
            if (className) node.className = className;
            if (content !== undefined) node.textContent = content;
            return node;
        };
        const item = make('div', `${CLASS.cell} ${CLASS.cell}-idle npc-state-delta-world-cell npc-state-delta-world-people`);
        item.dataset.npcId = id;
        const card = make('button', CLASS.card);
        card.setAttribute('type', 'button');
        card.dataset.npcId = id;
        card.setAttribute('aria-label', `Open ${shown} dossier`);
        const face = make('span', 'npc-state-delta-present-card-portrait');
        if (typeof portrait === 'string' && portrait) {
            const img = make('img');
            img.setAttribute('src', portrait);
            img.setAttribute('alt', `${shown} portrait`);
            face.append(img);
        } else {
            const holder = make('div', 'npc-state-delta-present-card-placeholder');
            holder.setAttribute('aria-hidden', 'true');
            holder.append(make('span', '', shown.trim().charAt(0).toUpperCase() || '?'));
            face.append(holder);
        }
        const body = make('span', CLASS.text);
        const head = make('span', 'npc-state-delta-present-card-head');
        const label = make('b', 'npc-state-delta-present-card-name', shown);
        label.setAttribute('title', shown);
        head.append(label);
        const aliases = Array.isArray(dossier.aliases) ? dossier.aliases : [];
        if ([shown, ...aliases].some(item => keys.has(lineKey(text(item))))) {
            const tag = make('span', 'npc-state-delta-key-tag', '★ Key');
            tag.setAttribute('title', 'Key person (Story Director)');
            head.append(tag);
        }
        head.append(make('span', 'npc-state-delta-present-card-stage', text(meters?.rank)));
        const line = [text(dossier.role), text(dossier.mood)].filter(Boolean).join(' · ') || 'Present NPC';
        const role = make('small', 'npc-state-delta-present-card-role', line);
        role.setAttribute('title', line);
        body.append(head, role);
        card.append(face, body);
        item.append(card);
        who.set(item, { name: shown, aliases });
        return item;
    }

    function bind(el) {
        if (el.__sdWorldOwnClick) return;
        el.__sdWorldOwnClick = true;
        el.addEventListener?.('click', event => {
            const row = event.target?.closest?.('.npc-state-delta-world-people');
            const name = row ? who.get(row)?.name : null;
            if (!name) return;
            try { open()?.(name); } catch { /* the dossier could not open */ }
        });
    }

    return Object.freeze({
        available: () => names() !== null,
        busy: () => false,
        render(el, { slot = null } = {}) {
            const list = names();
            const doc = el?.ownerDocument ?? globalThis.document;
            follow();
            if (!el || !list || !doc) return 0;
            bind(el);
            const keys = keyKeys();
            const cells = list.map(name => cell(doc, name, keys));
            const make = (tag, className, content) => { const node = doc.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; };
            const header = make('div', CLASS.head);
            header.append(make('span', 'npc-state-delta-kicker', 'PRESENT NPCS'), make('small', '', `${cells.length} shown`));
            const roster = make('section', CLASS.roster);
            const grid = make('div', CLASS.grid);
            grid.append(...cells);
            roster.append(header, ...(cells.length ? [grid] : []));
            const pane = make('div', CLASS.pane);
            pane.append(...(cells.length ? [roster] : []));
            el.replaceChildren(pane);
            if (typeof slot === 'function') {
                for (const item of cells) {
                    const { name, aliases } = who.get(item);
                    let node = null;
                    try { node = slot(name, [...aliases]); } catch { node = null; }
                    if (node && typeof node === 'object' && typeof node.nodeType === 'number') {
                        node.classList?.add?.('npc-state-delta-v2-slot');
                        item.querySelector?.(`.${CLASS.text}`)?.append(node);
                    }
                }
            }
            return cells.length;
        },
        // A change the store tells (`changed`): the same moments the section would draw on; the widget redraws once per task.
        onChange(fn) {
            if (typeof fn !== 'function') return () => {};
            let off = () => {};
            try { if (typeof api?.on === 'function') off = api.on('changed', () => fn()) ?? off; } catch { /* no store events */ }
            listeners.add(fn);
            follow();
            return () => {
                try { off(); } catch { /* gone */ }
                listeners.delete(fn);
                if (!listeners.size) { try { tell?.off?.(); } catch { /* gone */ } tell = null; }
            };
        },
    });
}
