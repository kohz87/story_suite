// The Prompt card: the budgets (the form engine) with the size block under them, redrawn as the reader changes a budget.

import { SETTINGS_TEXT } from '../../../host-ui.js';
import { renderSettingsForm } from '../../form/form.js';
import { sectionBlock } from '../../form/fields.js';
import { matchesSearch } from '../../form/schema.js';
import { focusNode, revealIn, showAndFocus } from '../../scroll.js';
import { PROMPT_FOLD, PROMPT_SCHEMA, PROMPT_TEXT } from './text.js';
import { el } from './shared-dom.js';
import { paintSize } from './size.js';

/**
 * The Prompt card: the budgets (the form engine) and the size under them. `reader` is createPromptReader's; `onChange()` is told
 * after a budget changed (the footer bar and the other pages follow); `openState` keeps "Show what's sent" open across redraws.
 * → { el, refresh(), filter(text), destroy(), focus(), openSent() }.
 */
export function renderPromptCard(parent, { doc, settings, reader, openState = new Map(), onChange = null }) {
    const card = sectionBlock(doc, { title: PROMPT_TEXT.title, hint: PROMPT_TEXT.hint, id: 'ss_prompt_card' });
    card.el.classList.add('ss-prompt-card');
    card.el.dataset.fold = PROMPT_FOLD;
    const form = renderSettingsForm(card.body, { moduleId: null, schema: PROMPT_SCHEMA, settings, doc, quiet: true, className: 'ss-prompt-form', onChange: () => { draw(); onChange?.(); } });
    const block = el(doc, 'div', 'story-suite-subsection story-suite-size');
    block.setAttribute('aria-live', 'polite');
    card.body.appendChild(block);
    parent.appendChild(card.el);
    let run = 0;
    function draw() {
        const mine = ++run;
        const read = reader.read();
        if (!read) {
            block.replaceChildren(el(doc, 'p', 'story-suite-muted', SETTINGS_TEXT.size.none));
            return;
        }
        paintSize(doc, block, read, openState);
        reader.readExact(read).then(exact => {
            if (mine === run && exact) paintSize(doc, block, exact, openState);
        });
    }
    draw();
    return {
        el: card.el,
        refresh() {
            form.refresh();
            draw();
        },
        filter(text) {
            const query = String(text ?? '').trim();
            const shown = form.filter(text);
            const match = matchesSearch('prompt.size', { label: `${PROMPT_TEXT.title} ${SETTINGS_TEXT.size.title}`, help: SETTINGS_TEXT.size.help }, 'Prompt', text);
            // The card stays while any of its rows or its size matches; the size alone is shown with its heading.
            card.setHidden(Boolean(query) && !shown && !match);
            block.hidden = Boolean(query) && !match;
            return shown + (query && match ? 1 : 0);
        },
        destroy() {
            run += 1;
            form.destroy();
            card.el.remove();
        },
        field: key => form.field(key),
        keys: () => form.keys(),
        focus() {
            const first = form.keys()[0];
            const input = first ? form.field(first).row.querySelector('input, select, button') : null;
            return showAndFocus(input, 'center');
        },
        openSent() {
            const details = block.querySelector('details.story-suite-sent');
            if (!details) return false;
            details.ssOpen();
            revealIn(null, details, 'start');
            focusNode(details.querySelector('summary'));
            return true;
        },
    };
}
