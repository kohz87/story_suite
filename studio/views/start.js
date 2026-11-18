// The start page (views/route.js PAGES, mock MK-9): Open a pack, and New world and New game. New asks for a name and an id (made from
// the name until the id is typed by hand) in a sheet, then opens a blank pack (model/blank.js) through `ctx.openDoc`, as if it had been
// picked. Where the page is given no `openDoc`, the blank pack goes in through the Studio's own Open (its file input), which opens it the
// same way a picked pack.json is opened.

import { h } from '../../ui/kit/dom.js';
import { openSheet } from '../../ui/kit/sheet.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { blankPack, idFromName, idProblem } from '../model/blank.js';

const KINDS = {
    world: { title: 'New world', desc: 'The places, people and events you play in. It starts empty', after: 'nothing in any part yet' },
    game: { title: 'New game', desc: 'The calendar, money, weather, names and rules. A part you leave empty is the Built-in game’s', after: 'every part empty, so each is the Built-in game’s' },
};

const row = (title, desc, button) => h('div', { class: 'srow' }, h('span', { class: 'lb' }, h('b', title), h('small', desc)), h('span', { class: 'ctl' }, button));

// The Open way in: the blank pack as a picked `<id>.json` on the Studio's file input. Returns a refusal in words, or ''.
function openAsPicked(input, doc) {
    if (!input || typeof DataTransfer !== 'function' || typeof File !== 'function') return 'The Studio could not open the new pack here.';
    const files = new DataTransfer();
    files.items.add(new File([JSON.stringify(doc, null, 2)], `${doc.id}.json`, { type: 'application/json' }));
    input.files = files.files;
    input.dispatchEvent(new Event('change'));
    return '';
}

/** Opens the New world or New game sheet. `ctx`: the page context; `input`: the Studio's file input (used when ctx has no openDoc). */
export function openNewSheet(ctx, kind, input = null) {
    const words = KINDS[kind];
    const sheet = openSheet({}, { title: words.title, id: 'st-new' });
    let byHand = false;
    const name = fieldRow({ type: 'text', key: 'name', label: 'Name', hint: 'Shown in Settings › Packs', value: '' });
    const id = fieldRow({ type: 'text', key: 'id', label: 'Id', hint: 'Settings and chats name it by this: lowercase letters, digits and dashes. Made from the name', value: '' });
    const nameBox = name.querySelector('input');
    const idBox = id.querySelector('input');
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const create = h('button', { type: 'button', class: 'btn2 pri st-create', onClick: () => make() }, 'Create');
    // The id's problem shows once there is something to judge: a typed id, or a name that made none.
    const judge = () => {
        const problem = idProblem(idBox.value);
        setProblem(id, idBox.value || nameBox.value.trim() ? problem : '');
        create.disabled = Boolean(problem);
        return problem;
    };
    nameBox.addEventListener('input', () => { if (!byHand) idBox.value = idFromName(nameBox.value); judge(); });
    idBox.addEventListener('input', () => { byHand = idBox.value !== ''; judge(); });
    function make() {
        if (judge()) return;
        const doc = blankPack(kind, { name: nameBox.value, id: idBox.value });
        const refusal = typeof ctx.openDoc === 'function'
            ? (result => (result?.ok ? '' : result?.refusal ?? 'The new pack was not opened.'))(ctx.openDoc({ doc, kind, name: `${words.title} (not exported yet)` }))
            : openAsPicked(input, doc);
        if (refusal) { said.textContent = refusal; said.hidden = false; return; }
        sheet.close();
    }
    for (const box of [nameBox, idBox]) box.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault?.(); make(); } });
    judge();
    sheet.body.append(name, id,
        h('p', { class: 'fine' }, `It opens empty and passes the pack check: version 0.1.0, ${words.after}. You can change all of this on Overview.`), said,
        h('div', { class: 'st-new-acts', style: 'display:flex;justify-content:flex-end;gap:8px;padding-top:6px' },
            h('button', { type: 'button', class: 'btn2 st-cancel', onClick: () => sheet.close() }, 'Cancel'), create));
    nameBox.focus?.();
    return sheet;
}

/** `ctx`: `{ pick(), openDoc?(opened) }`; `pick` opens the file picker. Returns the page's nodes. */
export function renderPage(ctx) {
    // The Studio's file input, found from the page once it is mounted (New uses it when the page has no openDoc).
    const inputNear = button => button.closest?.('.su-root, .st-app')?.querySelector?.('input.st-file') ?? globalThis.document?.querySelector?.('input.st-file') ?? null;
    const newButton = kind => {
        const button = h('button', { type: 'button', class: 'btn2 st-new', dataset: { kind }, onClick: () => openNewSheet(ctx, kind, inputNear(button)) }, KINDS[kind].title);
        return button;
    };
    return [
        h('section', { class: 'sgrp st-open-grp' }, h('div', { class: 'gt' }, 'Open'),
            row('Open a pack', 'A pack .zip (its pack.json, portraits and game.json), or pack.json files picked together with their portraits. An old-format pack opens read-only',
                h('button', { type: 'button', class: 'btn2 pri st-start', onClick: () => ctx.pick() }, 'Open…'))),
        h('section', { class: 'sgrp st-new-grp' }, h('div', { class: 'gt' }, 'New'),
            row(KINDS.world.title, KINDS.world.desc, newButton('world')),
            row(KINDS.game.title, KINDS.game.desc, newButton('game'))),
    ];
}
