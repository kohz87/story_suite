// Story Director v2, part screens: the widget `story-director.quests` that draws the Quests tab as cards.

import { maker } from '../dom.js';
import { chipOf, isQuestThread, rowsOf, text } from './rows.js';

export const QUESTS_WIDGET = 'story-director.quests';

const PIN = 'M8 1.5a4.75 4.75 0 0 0-4.75 4.75c0 3.4 4 7.6 4.2 7.8a.75.75 0 0 0 1.1 0c.2-.2 4.2-4.4 4.2-7.8A4.75 4.75 0 0 0 8 1.5Zm0 6.6a1.85 1.85 0 1 1 0-3.7 1.85 1.85 0 0 1 0 3.7Z';
const CHECK = 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.2 4.6-3.9 4.3a.75.75 0 0 1-1.1 0L4.8 8.9a.75.75 0 1 1 1.1-1l.9.9 3.3-3.7a.75.75 0 1 1 1.1 1Z';

function icon(doc, finished) {
    if (typeof doc.createElementNS !== 'function') return null;
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('class', `sd-q-icon${finished ? ' sd-q-done' : ''}`);
    svg.setAttribute('aria-hidden', 'true');
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', finished ? CHECK : PIN);
    svg.appendChild(path);
    return svg;
}

function render(el, props, memory) {
    const doc = el.ownerDocument ?? globalThis.document;
    const make = maker(doc);
    const view = doc.defaultView;
    const root = make('div', 'sd-q-root');
    el.replaceChildren(root);
    const observers = [];
    let value = props?.value ?? null;

    const card = (thread, finished) => {
        const li = make('li', 'sd-q', undefined, { 'data-thread': thread.id, 'data-status': thread.status });
        const chip = chipOf(thread);
        const head = make('div', 'sd-q1');
        head.append(make('b', 'sd-qt', thread.key), make('span', `sd-chip sd-chip-${chip.tone}`, chip.label));
        li.append(head);

        const summary = text(thread.summary);
        const step = text(thread.fields?.step) || text(thread.fields?.goal);
        const key = `more:${thread.id}`;
        let body = null;
        let more = null;
        if (summary) {
            body = make('p', 'sd-q2', summary, { 'data-open': String(memory.get(key) === true) });
            li.append(body);
        }
        const foot = make('div', 'sd-q3');
        if (step) {
            const glyph = icon(doc, finished);
            if (glyph) foot.append(glyph);
            foot.append(make('span', 'sd-q-step', step));
        }
        if (body) {
            more = make('button', 'ss-pill ss-pill-outline ss-tap-pill sd-q-more', undefined, { type: 'button' });
            const sync = () => {
                const expanded = body.getAttribute('data-open') === 'true';
                more.textContent = expanded ? 'Less' : 'More';
                more.setAttribute('aria-expanded', String(expanded));
            };
            sync();
            more.addEventListener('click', event => {
                event?.stopPropagation?.();
                memory.set(key, body.getAttribute('data-open') !== 'true');
                body.setAttribute('data-open', String(memory.get(key)));
                sync();
            });
            // Shown only where the text is cut (measured once drawn); a long text counts as cut where nothing can be measured.
            const cut = () => {
                if (body.getAttribute('data-open') === 'true') return true;
                return body.clientHeight > 0 ? body.scrollHeight > body.clientHeight + 1 : [...summary].length > 90;
            };
            const recheck = () => { more.hidden = !cut(); };
            recheck();
            foot.append(more);
            if (typeof view?.requestAnimationFrame === 'function') view.requestAnimationFrame(recheck);
            if (typeof view?.ResizeObserver === 'function') {
                const observer = new view.ResizeObserver(recheck);
                observer.observe(li);
                observers.push(observer);
            }
        }
        foot.hidden = !step && !body;
        li.append(foot);

        const rows = rowsOf(thread);
        if (rows.length) {
            const list = make('dl', 'sd-q-rows');
            for (const [label, text_] of rows) list.append(make('dt', '', label), make('dd', '', text_));
            li.append(list);
        }
        // An older chat's quest: its v1 fields stay readable, as a muted line (nothing is changed or written back).
        if (thread.rpg != null || thread.owed != null || thread.ready != null) {
            li.append(make('p', 'sd-q-old', 'From an earlier version (read only)'));
            if (thread.owed != null && thread.rpg == null && text(thread.owed.text)) {
                li.append(make('p', 'sd-q-old', `Reward from an earlier version: ${text(thread.owed.text)}`));
            }
        }
        return li;
    };

    function draw() {
        for (const observer of observers.splice(0)) observer.disconnect();
        const threads = (Array.isArray(value) ? value : []).filter(isQuestThread);
        const open = threads.filter(thread => thread.status === 'active');
        const done = threads.filter(thread => thread.status !== 'active');
        const parts = [];
        if (open.length) {
            const section = make('section', 'sd-q-sec');
            section.append(make('h4', 'sd-q-label', `Active (${open.length})`));
            const list = make('ul', 'sd-q-list');
            for (const thread of open) list.append(card(thread, false));
            section.append(list);
            parts.push(section);
        }
        if (done.length) {
            const fold = make('details', 'sd-q-fold');
            if (memory.get('finished') === true) fold.setAttribute('open', '');
            fold.addEventListener('toggle', () => memory.set('finished', fold.open === true));
            fold.append(make('summary', '', `Finished (${done.length})`));
            const list = make('ul', 'sd-q-list');
            for (const thread of done) list.append(card(thread, true));
            fold.append(list);
            parts.push(fold);
        }
        if (!parts.length) parts.push(make('p', 'sd-q-none', 'No quests or goals yet.'));
        root.replaceChildren(...parts);
    }

    draw();
    // The template's plain list is hidden by this class once the cards are drawn (not by :has()); set after the first draw, so a
    // draw that throws leaves the plain list showing.
    el.classList?.add('sd-qw-drawn');
    return {
        update(next) {
            value = next?.value ?? null;
            draw();
        },
        destroy() {
            for (const observer of observers.splice(0)) observer.disconnect();
            root.remove();
            el.classList?.remove('sd-qw-drawn');
        },
    };
}

/** The widget definition; `memory` (tests): where open/closed is remembered (the page's by default). */
export function createQuestsWidget({ memory = new Map() } = {}) {
    return Object.freeze({
        props: Object.freeze({ value: Object.freeze({ type: 'array', default: null }) }),
        primary: 'value',
        validate: props => (props?.value !== undefined && props.value !== null && !Array.isArray(props.value) ? ['value must be the director.threads list.'] : []),
        render: (el, props) => render(el, props, memory),
    });
}

export const questsWidget = createQuestsWidget();
