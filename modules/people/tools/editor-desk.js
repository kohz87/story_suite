/* NPC State's NPC editor on a desktop window (SHB3; mock sheets-desktop.html, frames dossier-edit and dossier-edit-end): 920 px, two columns,
   LEFT "Who they are" and RIGHT "With you and now", the head and the Save / Cancel row outside the one scrolling body. It only moves the
   fields editor-refine.js and continuity-ui.js built (every id and data name stays), and puts each one back when the window narrows. */

const DESK = '(min-width: 1100px)';
const GUARD = '__pplEditorDeskBound';
const LEFT = [
    ['life'], ['people_edit_name'], ['pair', 'people_edit_species', 'people_edit_gender'], ['people_edit_role'], ['people_edit_aliases'],
    ['people_edit_home_base'], ['custom'], ['pair', 'people_edit_age', 'people_edit_birthday'], ['pair', 'people_edit_apparent_age', 'people_edit_level'],
    ['people_edit_abilities'], ['people_edit_keepsakes'], ['people_edit_key_relationships'], ['portrait'], ['appearance'],
];
const RIGHT = [
    ['stats'], ['people_edit_relationship_summary'], ['pair', 'people_edit_mood', 'people_edit_location'], ['people_edit_status'], ['people_edit_goal'],
    ['people_edit_personality'], ['people_edit_behavior_profile'], ['people_edit_speech'], ['people_edit_background'], ['people_edit_mannerisms'],
    ['people_edit_memories'], ['hosted'], ['lock', 'people_edit_lock_profile'], ['protected'], ['lock', 'people_edit_minor'],
];
// The mock's box heights (rows): the long boxes are shorter in a column.
const ROWS = {
    people_edit_aliases: 2, people_edit_abilities: 2, people_edit_keepsakes: 2, people_edit_key_relationships: 2, people_edit_relationship_summary: 3,
    people_edit_personality: 3, people_edit_behavior_profile: 3, people_edit_speech: 2, people_edit_background: 2, people_edit_mannerisms: 2, people_edit_memories: 3,
};

const states = new WeakMap();   // dialog → { moved: [[node, marker]], made: [elements], rows: [[box, rows]], watch }

function el(doc, tag, cls, text) {
    const node = doc.createElement(tag);
    node.className = cls;
    if (text) node.textContent = text;
    return node;
}

// The label that holds control `id` (the editor's own markup: every field is a label around its control).
const fieldOf = (content, id) => content.querySelector(`#${id}`)?.closest('label') ?? null;

function pieces(content, key, ...ids) {
    if (key === 'life') return [content.querySelector('.ppl-editor-lifecycle'), content.querySelector('.delta-editor-life-control')].filter(Boolean);
    if (key === 'custom') return [...content.querySelectorAll('[data-delta-custom-field]')].map(input => input.closest('label')).filter(Boolean);
    if (key === 'portrait') return [content.querySelector('.ppl-editor-portrait-overrides')].filter(Boolean);
    if (key === 'appearance') return [content.querySelector('.delta-editor-appearance-forms')].filter(Boolean);
    if (key === 'stats') return [content.querySelector('.ppl-editor-stats')].filter(Boolean);
    if (key === 'hosted') return [content.querySelector('.ppl-editor-hosted')].filter(node => node?.children.length);
    if (key === 'protected') return [...content.querySelectorAll('p.ppl-muted')].filter(node => /^Currently protected:/i.test(node.textContent.trim()));
    if (key === 'lock' || key === 'pair') return ids.map(id => fieldOf(content, id)).filter(Boolean);
    return [fieldOf(content, key)].filter(Boolean);
}

function move(state, node, into) {
    if (state.moved.some(([done]) => done === node)) { into.appendChild(node); return; }
    const marker = node.ownerDocument.createComment('ppl-editor-desk');
    node.parentNode?.insertBefore(marker, node);
    state.moved.push([node, marker]);
    into.appendChild(node);
}

function fill(state, content, column, plan) {
    const doc = content.ownerDocument;
    for (const [key, ...ids] of plan) {
        const found = pieces(content, key, ...ids);
        if (!found.length) continue;
        let into = column;
        if (key === 'pair' || key === 'life') {
            into = el(doc, 'div', key === 'pair' ? 'ppl-ed-pair' : 'ppl-ed-life');
            state.made.push(into);
            column.appendChild(into);
        }
        for (const node of found) move(state, node, into);
    }
}

// The dialog takes the suite's colours and font while the suite is on the page (its tokens live on .su-root); without it the editor keeps SillyTavern's.
function borrowSuiteLook(dialog, add) {
    const suite = dialog.ownerDocument.querySelector('.su-root');
    if (!add || !suite) {
        for (const name of [...dialog.style]) if (name.startsWith('--su-')) dialog.style.removeProperty(name);
        dialog.removeAttribute('data-scheme');
        return;
    }
    for (const name of [...suite.style]) if (name.startsWith('--su-')) dialog.style.setProperty(name, suite.style.getPropertyValue(name));
    const scheme = suite.getAttribute('data-scheme');
    if (scheme) dialog.setAttribute('data-scheme', scheme);
}

function arrange(dialog) {
    const content = dialog.querySelector('#people_editor_content');
    if (!content || states.has(dialog)) return;
    const doc = dialog.ownerDocument;
    const state = { moved: [], made: [], rows: [], watch: null };
    states.set(dialog, state);
    const head = content.querySelector('.ppl-editor-head');
    const close = dialog.querySelector('.popup-button-close');
    if (head) {
        move(state, head, content.parentNode);
        content.parentNode.insertBefore(head, content);
        if (close) move(state, close, head);
    }
    const cols = el(doc, 'div', 'ppl-ed-cols');
    const left = el(doc, 'div', 'ppl-ed-col');
    const right = el(doc, 'div', 'ppl-ed-col');
    left.appendChild(el(doc, 'h4', 'ppl-ed-sec', 'Who they are'));
    right.appendChild(el(doc, 'h4', 'ppl-ed-sec', 'With you and now'));
    cols.append(left, right);
    state.made.push(cols);
    const intro = [...content.children].find(node => node.matches('p.ppl-muted'));
    if (intro) intro.after(cols); else content.prepend(cols);
    fill(state, content, left, LEFT);
    fill(state, content, right, RIGHT);
    for (const [id, rows] of Object.entries(ROWS)) {
        const box = content.querySelector(`#${id}`);
        if (box) { state.rows.push([box, box.getAttribute('rows')]); box.setAttribute('rows', String(rows)); }
    }
    // (sections and the Advanced fold left with nothing in them are hidden, not removed: narrowing the window puts every field back)
    for (const box of content.querySelectorAll('.delta-editor-section, .delta-editor-advanced')) {
        if (box.matches('.delta-editor-appearance-forms')) continue;
        const holder = box.querySelector('.delta-editor-section-grid, .delta-editor-advanced-body');
        if (holder && !holder.children.length && !box.hidden) { box.hidden = true; state.made.push({ unhide: box }); }
    }
    // A part added after this (the appearance section draws a frame later) goes to its column too.
    state.watch = new MutationObserver(() => {
        const late = content.querySelector(':scope > .delta-editor-appearance-forms');
        if (late) fill(state, content, left, [['appearance']]);
    });
    state.watch.observe(content, { childList: true });
    borrowSuiteLook(dialog, true);
    dialog.classList.add('ppl-ed-desk');
}

function restore(dialog) {
    const state = states.get(dialog);
    if (!state) return;
    states.delete(dialog);
    state.watch?.disconnect();
    dialog.classList.remove('ppl-ed-desk');
    borrowSuiteLook(dialog, false);
    for (const [node, marker] of state.moved.reverse()) marker.replaceWith(node);
    for (const made of state.made) { if (made.unhide) made.unhide.hidden = false; else made.remove?.(); }
    for (const [box, rows] of state.rows) { if (rows === null) box.removeAttribute('rows'); else box.setAttribute('rows', rows); }
}

/** Lays an open NPC editor dialog out for the window: two columns from 1,100 px, the build's one column under it; kept in step while it is open. */
export function fitEditorToWindow(dialog) {
    const view = dialog?.ownerDocument?.defaultView;
    const query = view?.matchMedia?.(DESK);
    if (!query) return;
    const apply = () => {
        if (!dialog.isConnected) { query.removeEventListener?.('change', apply); restore(dialog); return; }
        if (query.matches) arrange(dialog); else restore(dialog);
    };
    if (!dialog.__pplDeskWatched) { dialog.__pplDeskWatched = true; query.addEventListener?.('change', apply); }
    apply();
}

function start() {
    if (typeof document === 'undefined' || document[GUARD]) return;
    document[GUARD] = true;
    // editor-refine.js says when it has grouped a new editor; the appearance section is added on the next frame, so this waits one more.
    document.addEventListener('people:editor-mounted', event => {
        const dialog = event.target?.closest?.('.ppl-editor-popup');
        if (dialog) requestAnimationFrame(() => requestAnimationFrame(() => fitEditorToWindow(dialog)));
    });
}

start();
