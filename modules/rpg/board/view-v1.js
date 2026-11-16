// The page's own Fight board for a Combat Rules v1 fight: it draws the kind's view (FIGHT_SHAPE, `interaction.current().view`), asks each standing hero in turn, then stages one step.
// It holds only the picks of the open exchange (keyed by the fight's id and its step count); the engine, the foes' bars and the results are the kind's.
import { button, h } from '../../../ui/legacy/view/widgets/dom.js';

let held = { key: '', picks: [], sel: null };
const keyOf = (id, view, steps) => `${id}:${steps}:${view.actors.map(actor => actor.id).join(',')}`;
const bar = (label, value, max) => `${label} ${value}/${max}`;
const TARGETS = { member: 'Choose a target', group: 'Choose a group', ally: 'Choose who it is for' };

/** Draws the v1 board into `root`: `{ doc, id, steps, view, tools: { stage(step), auto(), discard(), send, sending, redraw } }`. */
export function renderV1(root, { doc, id, steps, view, tools }) {
    const key = keyOf(id, view, steps);
    if (held.key !== key) held = { key, picks: [], sel: null };
    const ended = view.state === 'end', asked = ended ? null : view.actors[held.picks.length] ?? null, body = h(doc, 'div', 'rpg-board-body');
    const status = h(doc, 'div', 'rpg-board-status');
    for (const person of view.party) status.appendChild(h(doc, 'p', 'rpg-board-chip', `${person.name} · ${bar('HP', person.hp, person.hpMax)} · ${bar('MP', person.mp, person.mpMax)} · ${bar('SP', person.sp, person.spMax)}`));
    for (const group of view.foeGroups) for (const foe of group.members) status.appendChild(h(doc, 'p', 'rpg-board-chip', `${foe.name}${group.tier ? ` (${group.tier})` : ''} · ${bar('HP', foe.hp, foe.max)}`));
    body.appendChild(status);
    const log = h(doc, 'details', 'rpg-board-log rpg-battle'), last = view.log.at(-1);
    log.open = ended;
    log.appendChild(h(doc, 'summary', '', last ? `Exchange ${last.n} · tap to read the full log` : 'Choose an action to begin.'));
    for (const round of view.log) { log.appendChild(h(doc, 'p', 'rpg-board-round', `Exchange ${round.n}`)); for (const row of round.rows) log.appendChild(h(doc, 'p', '', `${row.who}: ${row.what} — ${row.outcome}${row.math ? ` (${row.math})` : ''}`)); }
    body.appendChild(log);
    const panel = h(doc, 'div', 'rpg-board-controls'), row = h(doc, 'div', 'rpg-board-actions');
    const draw = () => tools.redraw();
    const commit = (action, target) => {
        const input = { actor: asked.id, choice: action.pick.choice, args: { ...action.pick.args, ...(target?.arg ?? {}) } };
        held.sel = null;
        if (action.pick.alone === true) { tools.stage({ inputs: [input] }); return; }
        held.picks = [...held.picks, input];
        if (held.picks.length >= view.actors.length) { const inputs = held.picks; held = { key: '', picks: [], sel: null }; tools.stage({ inputs }); } else draw();
    };
    if (ended) {
        panel.appendChild(h(doc, 'h4', 'rpg-board-end', `Fight ${view.end.outcome}`));
        panel.appendChild(h(doc, 'p', 'rpg-board-end-description', tools.waiting() ? 'Your waiting message carries the approach and this fight in one reply.' : 'Your next message carries this fight; the narrator tells it first.'));
        if (tools.sending()) panel.appendChild(h(doc, 'p', 'rpg-board-sending', 'Sending… the narrator is writing the reply.'));
        else if (tools.waiting()) panel.appendChild(button(doc, 'Send with this fight', 'ss-button ss-button-primary rpg-board-send', () => tools.send()));
    } else if (asked) {
        const member = view.party.find(person => person.actorId === asked.id);
        panel.appendChild(h(doc, 'p', 'rpg-board-prompt', held.sel ? TARGETS[held.sel.action.target] ?? 'Choose' : `${member?.name ?? 'Party'}: choose an action`));
        if (view.actors.length > 1) panel.appendChild(h(doc, 'small', 'rpg-board-step', `${held.picks.length + 1} of ${view.actors.length}`));
        for (const input of held.picks) panel.appendChild(h(doc, 'p', 'rpg-board-staged', `${view.party.find(person => person.actorId === input.actor)?.name ?? ''}: ${input.choice}`));
        const list = h(doc, 'div', 'rpg-board-choices');
        const option = (label, enabled, act) => { const node = button(doc, label, 'ss-button rpg-board-choice', act); node.disabled = !enabled; list.appendChild(node); };
        const kind = held.sel?.action.target;
        if (kind === 'member') for (const group of view.foeGroups) for (const foe of group.members.filter(entry => entry.hp > 0)) option(`${foe.name} (${foe.hp}/${foe.max})`, true, () => commit(held.sel.action, foe));
        else if (kind === 'group') for (const group of view.foeGroups) option(group.name, true, () => commit(held.sel.action, group));
        else if (kind === 'ally') for (const person of view.party.filter(entry => entry.hp > 0)) option(`${person.name} (${person.hp}/${person.hpMax})`, true, () => commit(held.sel.action, person));
        else for (const action of Object.values(asked.groups).flat()) option(`${action.label} · ${action.cost}`, action.enabled, () => { if (action.target === 'none') commit(action, null); else { held.sel = { action }; draw(); } });
        panel.appendChild(list);
        const back = button(doc, 'Back', 'ss-button rpg-board-back', () => { if (held.sel) held.sel = null; else held.picks = held.picks.slice(0, -1); draw(); });
        back.disabled = !(held.sel || held.picks.length);
        row.appendChild(back);
        row.appendChild(button(doc, 'Auto', 'ss-button ss-button-primary rpg-board-auto', () => { held = { key: '', picks: [], sel: null }; tools.auto(); }));
    }
    if (!tools.sending()) { row.appendChild(button(doc, 'Discard fight', 'ss-button rpg-board-discard', () => tools.discard())); panel.appendChild(row); }
    body.appendChild(panel);
    root.appendChild(body);
}
