// The bottom sheet for one item: its facts and action buttons, mounted on the host's modal stack.

import { SCREEN_STRINGS } from '../../../../../../core/strings/screens.js';
import { fill } from '../../../../../../core/strings.js';
import { h } from '../../view/widgets/dom.js';
import { stackOf } from '../../view/modal-stack.js';
import { COMMON, slotLabel } from './shared-gear.js';

const S = SCREEN_STRINGS.inventory;
const G = S.gear;

// One action button. A plain action runs at once; one with `choices` (Drop 1 / Drop all, the members who may wear it) opens a row of buttons under it.
function actionButton(doc, action, close) {
    const wrap = h(doc, 'div', 'sheet-act');
    const main = h(doc, 'button', `ss-button${action.danger ? ' ss-button-danger' : ''}`);
    main.setAttribute('type', 'button');
    if (action.title) main.setAttribute('title', action.title);
    if (action.icon) {
        const mark = h(doc, 'i', `fa-solid ${action.icon}`);
        mark.setAttribute('aria-hidden', 'true');
        main.append(mark, ' ');
    }
    main.append(action.label);
    wrap.append(main);
    if (!action.choices?.length) {
        main.addEventListener('click', () => { if (!action.keepOpen) close(); action.run?.(); });
        return wrap;
    }
    const choices = h(doc, 'div', 'sheet-choices');
    choices.hidden = true;
    main.setAttribute('aria-expanded', 'false');
    for (const choice of action.choices) {
        const button = h(doc, 'button', `ss-button${choice.danger ? ' ss-button-danger' : ''}`, choice.label);
        button.setAttribute('type', 'button');
        if (choice.title) button.setAttribute('title', choice.title);
        button.addEventListener('click', () => { close(); choice.run?.(); });
        choices.append(button);
    }
    main.addEventListener('click', () => {
        choices.hidden = !choices.hidden;
        main.setAttribute('aria-expanded', String(!choices.hidden));
    });
    wrap.append(choices);
    return wrap;
}

/**
 * The bottom sheet for one item. `item` is the tile's item; `row` its `q.gx.rows[stack]` (null with Gear in fights off); `wearer` the wearer's name ('' for none).
 * `actions` are `{ label, title?, icon?, danger?, keepOpen?, run, choices? }` (`keepOpen`: the sheet stays, `run` draws into `slot`): `run()` must be the same handler the row's button calls (the command and its payload),
 * and `choices` are `{ label, title?, danger?, run }` shown under the action. The sheet closes before an action runs, so the screen can redraw.
 * Returns `{ el, slot, show, close }`. `show()` mounts it as a layer of the host's modal stack (view/modal-stack.js) on the document body, the way the app's other
 * dialogs are, NOT inside the screen (a screen's CSS cannot be `position: fixed`, and a screen scrolls): fixed at the bottom of the visible screen over a dim backdrop,
 * the list under it never moves. The stack owns Escape (only the top layer takes it, so the game view stays open) and keeps Tab inside it.
 * A tap on the dim, the Close button or Escape closes it; `returnTo` (the tile, or a function giving it after the screen drew again) gets the focus back, and `onClose` runs.
 */
export function itemSheet(doc, { item, row = null, wearer = '', actions = [], returnTo = null, onClose } = {}) {
    let open = true;
    let entry = null;
    const layer = h(doc, 'div', 'ss-dialog-backdrop inv-sheet-layer');
    const sheet = h(doc, 'section', 'ss-dialog inv-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', S.sheetLabel);
    sheet.tabIndex = -1;
    const close = () => {
        if (!open) return;
        open = false;
        if (entry) stackOf(doc).pop(entry, { focus: false });
        entry = null;
        layer.remove();
        onClose?.();
        const back = typeof returnTo === 'function' ? returnTo() : returnTo;
        back?.focus?.({ preventScroll: true });   // (after onClose: the screen may have drawn again, and the tile is a new node)
    };

    const head = h(doc, 'div', 't');
    head.append(
        h(doc, 'b', 'sheet-name', item.name),
        h(doc, 'span', 'm', [S.rarities[item.rarity || COMMON], S.kinds[item.kind]].filter(Boolean).join(' · ')),
    );
    const facts = h(doc, 'dl', 'sheet-facts');
    const fact = (label, value) => {
        if (value === '' || value === null || value === undefined) return;
        facts.append(h(doc, 'dt', '', label), h(doc, 'dd', '', String(value)));
    };
    if (row) fact(G.editSlot, slotLabel(item, row));
    if (row) fact(G.form.bonus, row.bonus || G.noBonus);
    if (row) fact(S.condTitle, G.words[row.word] ?? '');
    if (item.qty != 1) fact(S.itemCount, item.qty);
    if (item.weight !== undefined) fact(S.weight, item.weight);
    sheet.append(head);
    if (wearer) sheet.append(h(doc, 'p', 'sheet-who', fill(S.wornBy, { name: wearer })));
    sheet.append(facts);
    if (item.note) sheet.append(h(doc, 'p', 'note muted', item.note));

    const bar = h(doc, 'div', 'sheet-actions');
    for (const action of actions) bar.append(actionButton(doc, action, close));
    const x = h(doc, 'button', 'ss-button sheet-close', S.sheetClose);
    x.setAttribute('type', 'button');
    x.addEventListener('click', close);
    const slot = h(doc, 'div', 'sheet-slot');   // where an action that keeps the sheet open (Edit) draws its form
    sheet.append(slot, bar, x);

    layer.addEventListener('click', event => { if (event.target === layer) close(); });
    // An Escape inside the sheet (its buttons, the Edit form) stops here: it never reaches the document, so a game view under it stays open.
    layer.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault?.(); event.stopPropagation?.(); close(); }
    });
    layer.append(sheet);
    return {
        el: layer,
        slot,
        show() {
            (doc.body ?? doc).append(layer);
            entry = stackOf(doc).push({ name: 'inventory-sheet', el: layer, root: sheet, onEscape: () => { close(); return true; } });
            (bar.querySelector?.('button') ?? x).focus?.({ preventScroll: true });
        },
        close,
    };
}
