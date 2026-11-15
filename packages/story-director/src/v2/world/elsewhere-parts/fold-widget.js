// The fold head widget: a chevron, title and count that folds or opens a World section.

import { maker, spaced } from '../../screens/dom.js';
import { stChatId } from '../../screens/reveal.js';
import { foldMemory } from './fold-memory.js';

export const FOLD_WIDGET = 'story-director.fold';

/** Shows or folds `section` (a `[data-fold]` node): its class, its body and the head's aria state. */
function applyFold(section, head, open) {
    section.classList?.toggle('sd-fold-shut', !open);
    for (const child of Array.from(section.children ?? [])) if (child.classList?.contains('sd-fold-body')) child.hidden = !open;
    head.setAttribute('aria-expanded', String(open));
}

function renderFold(el, props, memory) {
    const make = maker(el.ownerDocument ?? globalThis.document);
    let value = props ?? {};
    const head = make('button', 'sd-fold-head', undefined, { type: 'button', 'aria-expanded': 'true' });
    el.replaceChildren(head);
    const section = () => el.closest?.('[data-fold]') ?? null;
    const keyOf = () => `${stChatId()}/${section()?.getAttribute('data-fold') || value.id || ''}`;
    const draw = () => {
        const chevron = make('span', 'sd-fold-chev', undefined, { 'aria-hidden': 'true' });
        chevron.append(make('i', 'fa-solid fa-chevron-down'));
        head.replaceChildren(...spaced([chevron, make('span', 'sd-fold-title', value.title ?? ''), ...(value.count ? [make('small', 'sd-fold-count', value.count)] : [])]));
        const node = section();
        if (node) applyFold(node, head, memory.get(keyOf()) !== false);
    };
    head.addEventListener('click', event => {
        event?.stopPropagation?.();
        const node = section();
        if (!node) return;
        const open = node.classList?.contains('sd-fold-shut') === true;
        applyFold(node, head, open);
        memory.set(keyOf(), open);
    });
    draw();
    return { update(next) { value = next ?? {}; draw(); }, destroy() { head.remove(); } };
}

/** The fold head widget; `memory` (tests): the remembered folds (the page's by default). */
export function createFoldWidget({ memory = foldMemory() } = {}) {
    return Object.freeze({
        props: Object.freeze({
            id: Object.freeze({ type: 'string', default: '' }),
            title: Object.freeze({ type: 'string', default: '' }),
            count: Object.freeze({ type: 'string', default: '' }),
            // The open chat's id (a query, so a chat switch changes the props and the fold is read again for the new chat).
            chat: Object.freeze({ type: 'string', default: '' }),
        }),
        primary: 'title',
        validate: () => [],
        render: (el, props) => renderFold(el, props, memory),
    });
}

export const foldWidget = createFoldWidget();
