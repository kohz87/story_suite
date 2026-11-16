// The Inventory screen's Grid view widget: tiles, folding categories, Worn per wearer and the item sheet.

import { KIND_ORDER } from '../../domains/inventory.js';
import { STRINGS, fill } from '../../strings.js';
import { categorySection, foldSection, foldStore, itemSheet, wornSection } from '../inventory-grid.js';
import { h, shell } from '../../view/widgets/dom.js';
import { editable } from '../../view/widgets/editable.js';

const S = STRINGS.inventory;
const G = S.gear;

export const INVENTORY_GRID_WIDGET = 'story-block.inventory-grid';
const GEAR_ORDER = Object.freeze(['equipment', 'consumable', 'goods', 'quest', 'material', 'money']);
const CARRY_MS = 5000;   // how long a focus waits for the screen's next draw

const shown = (item, filter) => (!filter.rarity || filter.rarity === item.rarity)
    && (filter.equippedOnly !== 'true' || item.equipped != null)
    && (!filter.find || String(item.name ?? '').toLowerCase().includes(String(filter.find).toLowerCase()))
    && (!filter.kind || filter.kind === item.kind);

/**
 * The Grid view. Props (the screen's data, see the template): `items` (q.items), `counts`, `rows` (q.gx.rows, null with Gear in fights off), `wearers`, `owners`, `kit`,
 * `users` (q.gear.users), `filter` ({ kind, rarity, find, equippedOnly } as the header's boxes hold them). Folds are kept per chat on this device. A tile opens the item's sheet whose
 * buttons send the same commands as the list row's (Equip, Unequip, Use on…, Drop) and whose Edit draws the row's own Edit form; nothing here changes the state itself.
 */
export function createInventoryGridWidget({ chatKey = () => '', storage = undefined } = {}) {
    const stores = new Map();
    // The tab and game-view mounts build this widget again on every redraw (view/mounts/common.js, keep=false), so the focus cannot ride on the old instance: where it was
    // (a tile's stack and the stacks in order, or none; only for the same chat) waits here for the next instance's first draw, a few seconds at most.
    let carry = null;
    const foldsFor = () => {
        const prefix = `story-block.inventoryFold|${chatKey()}|`;
        if (!stores.has(prefix)) stores.set(prefix, foldStore({ prefix, storage }));
        return stores.get(prefix);
    };
    return Object.freeze({
        props: {}, primary: null, validate: () => [],
        render(el, first, api) {
            return shell(el, 'div', 'inv-grid', ({ doc, root, cleanup }) => {
                let props = first ?? {};
                const content = h(doc, 'div', 'inv-grid-body');
                root.append(content);
                let sheet = null;
                let editing = null;
                const run = (type, payload) => api?.command?.(type, payload);
                const actionsOf = (item, row) => {
                    const { stack, name } = item;
                    const out = [];
                    if (item.kind === 'equipment') {
                        if (row) {
                            if (row.place === '' && row.slotKey !== '' && row.bound == null) {
                                out.push({ label: G.equip, icon: 'fa-hand-fist', title: fill(S.equipTitle, { name }),
                                    choices: (props.owners ?? []).map(who => ({ label: who.label, title: fill(G.equipWhoTitle, { name, who: who.label }), run: () => run('item.equip', { stack, owner: who.value, transfer: true }) })) });
                            } else if (row.place !== '' && row.bound == null) out.push({ label: S.unequip, title: fill(G.unequipTitle, { name }), run: () => run('inventory.unequip', { stack }) });
                        } else if (item.equipped == null) out.push({ label: S.equip, icon: 'fa-hand-fist', title: fill(S.equipTitle, { name }), run: () => run('inventory.equip', { stack }) });
                        else out.push({ label: S.unequip, title: fill(S.unequipTitle, { name }), run: () => run('inventory.unequip', { stack }) });
                    }
                    const users = props.users?.[stack] ?? [];
                    if (item.kind === 'consumable' && users.length > 0) {
                        out.push({ label: S.useOn, icon: 'fa-flask', title: fill(S.useOnTitle, { name }),
                            choices: users.map(who => ({ label: who.name, title: fill(S.useOnWho, { name }), run: () => run(who.via ?? 'item.use', { stack, target: who.id }) })) });
                    }
                    if (!row || row.bound == null) {
                        const all = { label: item.qty != 1 ? fill(S.dropAll, { qty: item.qty }) : S.drop, danger: true, run: () => run('inventory.drop', { stack, qty: item.qty }) };
                        out.push({ label: S.drop, icon: 'fa-trash-can', title: fill(S.dropTitle, { name }),
                            choices: item.qty != 1 ? [{ label: S.dropOne, danger: true, run: () => run('inventory.drop', { stack, qty: 1 }) }, all] : [all] });
                    }
                    out.push({ label: S.editLabel, icon: 'fa-pencil', keepOpen: true, run: () => beginEdit(item, row) });
                    return out;
                };
                const beginEdit = (item, row) => {
                    if (!sheet) return;
                    // One form only: Edit while it is open closes it again (the sheet keeps the button, and each press used to add another form below).
                    if (editing) { editing.destroy?.(); editing = null; sheet.slot.replaceChildren?.(); return; }
                    const gear = row ? { kind: item.kind, stack: item.stack, owner: item.owner, by: row.byId, place: row.place, slot: row.slotKey, bound: row.bound?.who ?? '', def: item.def, rarity: item.rarity, row, kit: props.kit === true, owners: props.owners ?? [] } : undefined;
                    const form = { value: item.name, itemCount: props.counts?.[item.stack] ?? item.qty, itemNote: item.note ?? '', displayValue: false, kind: 'item', label: S.editItem, command: 'inventory.edit',
                        payload: { stack: item.stack, group: true }, open: true, bare: true, onClose: () => sheet?.close(), ...(gear ? { gear } : {}) };
                    editing = editable.render(sheet.slot, form, api);
                };
                const closeSheet = () => { sheet?.close(); };
                const noteFocus = stack => {
                    const order = Array.from(content.querySelectorAll?.('[data-stack]') ?? []).map(node => node.getAttribute('data-stack'));
                    carry = { stack, order, at: Date.now(), chat: chatKey() };
                };
                // First draw of a new instance: the tile of the carried stack, else the next one after it, else the one before, else the first tile. Only while nothing else has the focus.
                const takeCarry = () => {
                    const was = carry;
                    carry = null;
                    const active = doc.activeElement;
                    if (!was || was.chat !== chatKey() || Date.now() - was.at > CARRY_MS || (active && active !== doc.body)) return;
                    const from = was.order.indexOf(was.stack);
                    const later = from < 0 ? [] : was.order.slice(from + 1);
                    const earlier = from < 0 ? [] : was.order.slice(0, from).reverse();
                    const tile = [was.stack, ...later, ...earlier].map(stack => content.querySelector?.(`[data-stack="${stack}"]`)).find(Boolean) ?? content.querySelector?.('.tile');
                    tile?.focus?.({ preventScroll: true });
                };
                const open = (item, tile) => {
                    closeSheet();
                    const row = props.rows?.[item.stack] ?? null;
                    // The sheet is a layer of the host's modal stack on the body (itemSheet), not a child of this screen. On close the focus goes to this stack's tile as drawn then.
                    const back = () => content.querySelector?.(`[data-stack="${item.stack}"]`) ?? tile;
                    const made = itemSheet(doc, { item, row, wearer: row?.by ?? '', actions: actionsOf(item, row), returnTo: back, onClose: () => { noteFocus(item.stack); editing?.destroy?.(); editing = null; if (sheet === made) sheet = null; } });
                    sheet = made;
                    made.show();
                };
                const toggler = id => open => { foldsFor().set(id, open); draw(id); };
                function draw(focusId = '') {
                    const rows = props.rows && typeof props.rows === 'object' ? props.rows : null;
                    const filter = props.filter ?? {};
                    const items = (props.items ?? []).filter(item => shown(item, filter));
                    const folds = foldsFor();
                    const order = rows ? [...GEAR_ORDER, ...KIND_ORDER.filter(kind => !GEAR_ORDER.includes(kind))] : KIND_ORDER;
                    const parts = [];
                    // A redraw replaces every tile and fold: the focus goes to the same one (a tile by its stack, a fold by its id), else the first tile, rather than to the body.
                    const active = doc.activeElement;
                    const kept = active && content.contains?.(active) ? { stack: active.getAttribute?.('data-stack'), fold: active.getAttribute?.('data-fold') } : null;
                    for (const kind of order) {
                        const mine = items.filter(item => item.kind === kind && !(rows && rows[item.stack]?.place));
                        const section = categorySection(doc, { kind, title: rows && kind === 'equipment' ? G.bagTitle : S.kinds[kind], items: mine, rows, open: folds.get(`cat-${kind}`, true), onToggle: toggler(`cat-${kind}`), onOpen: open });
                        if (section) parts.push(section);
                        if (rows && kind === 'equipment') {
                            const worn = wornSection(doc, { wearers: props.wearers ?? [], items, rows, open: value => folds.get(`worn-${value}`, true), onToggle: (value, on) => toggler(`worn-${value}`)(on), onOpen: open });
                            if (worn.children.length) {   // under one rule-style head, "WORN 9", like the mockup's: the wearers' folds are its body
                                const count = items.filter(item => rows[item.stack]?.place && (props.wearers ?? []).some(who => who.value === rows[item.stack].byId)).length;
                                parts.push(foldSection(doc, { id: 'cat-worn', label: G.wornTitle, count, open: folds.get('cat-worn', true), onToggle: toggler('cat-worn'), body: worn, className: 'cat cat-worn', rule: true }));
                            }
                        }
                    }
                    if (!parts.length && (props.items ?? []).length) parts.push(h(doc, 'p', 'nomatch-grid muted', S.noMatch));
                    content.replaceChildren(...parts);
                    if (focusId) content.querySelector?.(`[data-fold="${focusId}"]`)?.focus?.();
                    else if (kept) (content.querySelector?.(kept.stack ? `[data-stack="${kept.stack}"]` : `[data-fold="${kept.fold}"]`) ?? content.querySelector?.('.tile') ?? content.querySelector?.('.fold-head'))?.focus?.({ preventScroll: true });
                }
                draw();
                takeCarry();
                const leave = () => {
                    closeSheet();
                    const active = doc.activeElement;
                    if (active && content.contains?.(active) && active.getAttribute?.('data-stack')) noteFocus(active.getAttribute('data-stack'));
                };
                cleanup(leave);
                return { update(next) { props = next ?? {}; draw(); }, destroy: leave };
            });
        },
    });
}
