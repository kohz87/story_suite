// The frame every display shares: header, notices and the empty line.
import { el, button, stop } from './elements.js';
import { blockName } from './words.js';

/**
 * Clear `pane` and lay down what every display shares: a header (name, summary,
 * "kept by" for a block another extension keeps, Edit), then the owner, error and
 * cut-off notices. Returns the header's actions element so a display can add its own buttons.
 */
export function renderFrame(pane, { def, error, truncated, onEdit, display, summary = '' } = {}) {
    pane.replaceChildren();
    pane.classList.add('story-block-display', `story-block-display-${display}`);
    const name = blockName(def);

    const head = el('div', 'story-block-head');
    const titles = el('div', 'story-block-head-titles');
    titles.appendChild(el('span', 'story-block-title', name));
    if (summary) titles.appendChild(el('span', 'story-block-summary', summary));
    // A block another extension keeps has no Edit button; this says why, and whose it is.
    if (def?.kept && def.owner) {
        const kept = el('span', 'story-block-kept', `kept by ${def.owner}`);
        kept.title = `Kept by ${def.owner}: only ${def.owner} changes it`;
        titles.appendChild(kept);
    }
    head.appendChild(titles);
    const actions = el('div', 'story-block-actions');
    if (typeof onEdit === 'function') {
        const edit = button('menu_button story-block-icon-button story-block-edit', { title: `Edit ${name}`, icon: 'fa-pen-to-square' });
        edit.addEventListener('click', stop(() => onEdit()));
        actions.appendChild(edit);
    }
    head.appendChild(actions);
    pane.appendChild(head);

    renderNotices(pane, { def, error, truncated });
    return actions;
}

export function renderNotices(pane, { def, error, truncated } = {}) {
    const name = blockName(def);
    // Another extension is the source of truth for what this block tracks (Story Suite): the
    // block is still shown as it is, and this says who owns it, so the reader can decide.
    if (def?.deferNote) pane.appendChild(notice('is-deferred', String(def.deferNote)));
    if (error) {
        const text = String(error).trim().replace(/\.$/, '');
        pane.appendChild(notice('is-error', `This reply's ${name} couldn't be read: ${text}. Showing the last valid state.`));
    }
    if (truncated) {
        // Stateful blocks never take a cut-off copy; a turn block may show what arrived.
        const tail = def?.kind !== 'stateful' ? ' What arrived may be incomplete.' : ' Showing the last valid state.';
        pane.appendChild(notice('is-truncated', `This reply's ${name} was cut off before it finished.${error ? '' : tail}`));
    }
}

const NOTICE_GLYPHS = { 'is-error': 'fa-triangle-exclamation', 'is-truncated': 'fa-scissors', 'is-deferred': 'fa-circle-info' };

function notice(kind, text) {
    const node = el('div', `story-block-notice ${kind}`);
    node.setAttribute('role', 'note');
    const glyph = el('i', `fa-solid ${NOTICE_GLYPHS[kind] ?? 'fa-scissors'}`);
    glyph.setAttribute('aria-hidden', 'true');
    node.append(glyph, el('span', 'story-block-notice-text', text));
    return node;
}

export function emptyText(def, state) {
    const name = blockName(def);
    // A per-reply block with no copy in the latest reply, or a kept block nothing filled yet.
    return state === null || state === undefined ? `No ${name} in the latest reply.` : `${name} is empty. It fills in as the story goes.`;
}

export function renderEmpty(parent, text) {
    return parent.appendChild(el('div', 'story-block-empty', text));
}
