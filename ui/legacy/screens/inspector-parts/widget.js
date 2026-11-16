// The `story-block.inspector` widget: the picker, search and the reply's changes, receipts, problems and state.

import { STRINGS, fill } from '../../../../core/strings.js';
import { LIMITS, matchPaths } from '../../inspect.js';
import { cutAt } from '../../../../core/text.js';
import { rebuildTarget } from '../rebuild-banner.js';
import { el, button, section } from './shared-dom.js';
import { drawTree } from './tree.js';
import { diffLine, opLine } from './lines.js';

const S = STRINGS.inspector;

const MAX_OPS = 300;          // ops listed for one reply

/**
 * The `story-block.inspector` widget over `source` (inspect.js createInspectorSource): `{ replies(),
 * reply(index), headIndex(), memory: { index, search, open } }`. The reader's choices live in
 * `source.memory`, so a redraw of the screen keeps the reply picked, the search and what is open.
 * It redraws itself on the host's `head`, `committed` and `turn` events (api.on). `enabled()`: the
 * feature's switch; while it is off the widget draws nothing (B-rxui-11), wherever it is named.
 * `rebuild`: `{ widget, blocked, nameOf? }` (screens/rebuild-banner.js): while `blocked()` is a permanent dossier failure, the Problem row of that
 * cause gets the "Start this branch's dossiers from the chat" button, which opens the same confirmation Home's banner does.
 */
export function createInspectorWidget(source, { enabled = () => true, rebuild = null } = {}) {
    return Object.freeze({
        props: {},
        primary: null,
        validate: () => [],
        render(host, _props, api = {}) {
            // Off (the feature `story-block.inspector`), it draws nothing in any screen that names it.
            if (!enabled()) {
                host.replaceChildren();
                host.hidden = true;
                return { update() {}, destroy() {} };
            }
            const doc = host.ownerDocument ?? globalThis.document;
            const memory = source.memory;
            const root = el(doc, 'div', 'sb-insp');
            root.setAttribute('role', 'region');
            root.setAttribute('aria-label', S.title);
            const bar = el(doc, 'div', 'sb-insp-bar');
            const picker = el(doc, 'select', 'ss-input ss-select sb-insp-pick');
            picker.setAttribute('aria-label', S.pick);
            const older = button(doc, 'sb-insp-older', '◀', S.older);
            const newer = button(doc, 'sb-insp-newer', '▶', S.newer);
            const latest = button(doc, 'sb-insp-latest', S.latest, S.latest);
            const search = el(doc, 'input', 'ss-input ss-text sb-insp-search');
            search.setAttribute('type', 'search');
            search.setAttribute('placeholder', S.searchHint);
            search.setAttribute('aria-label', S.search);
            search.value = memory.search ?? '';
            bar.append(picker, older, newer, latest, search);
            const body = el(doc, 'div', 'sb-insp-body');
            body.setAttribute('aria-live', 'polite');
            root.append(bar, body);
            host.replaceChildren(root);

            let replies = [];
            const chosen = () => {
                if (!replies.length) return null;
                const want = memory.index;
                return replies.find(reply => reply.index === want) ?? replies[0];
            };

            function drawPicker() {
                replies = source.replies();
                const current = chosen();
                picker.replaceChildren(...replies.map(reply => {
                    const option = el(doc, 'option', '', fill(S.option, {
                        index: reply.index,
                        name: reply.name ? ` · ${reply.name}` : '',
                        rev: reply.rev,
                        head: reply.head ? S.headMark : '',
                    }));
                    option.value = String(reply.index);
                    option.setAttribute('value', String(reply.index));
                    if (reply.snippet) option.setAttribute('title', reply.snippet);
                    return option;
                }));
                picker.value = current ? String(current.index) : '';
                picker.disabled = replies.length === 0;
                const at = current ? replies.indexOf(current) : -1;
                older.disabled = at < 0 || at >= replies.length - 1;
                newer.disabled = at <= 0;
                latest.disabled = at <= 0;
                return current;
            }

            function drawBody(current) {
                body.replaceChildren();
                if (!current) {
                    body.appendChild(el(doc, 'p', 'muted sb-insp-empty', S.none));
                    return;
                }
                const view = source.reply(current.index);
                if (!view?.ok) {
                    body.appendChild(el(doc, 'p', 'muted sb-insp-empty', view?.message ?? S.none));
                    return;
                }
                const heading = el(doc, 'h3', 'sb-insp-head', fill(S.heading, { index: view.index, name: view.name ? ` · ${view.name}` : '', rev: view.rev ?? '—' }));
                if (view.checkpoint) heading.appendChild(el(doc, 'span', 'ss-pill ss-pill-soft', S.checkpoint));
                body.appendChild(heading);

                // What changed since the reply before.
                const changed = section(doc, 'sb-insp-changes', S.changed);
                if (!view.diff.entries.length) changed.appendChild(el(doc, 'p', 'muted sb-insp-empty', S.noChange));
                else {
                    const list = el(doc, 'ul', 'ss-listcard-rows sb-insp-diff');
                    list.append(...view.diff.entries.map(entry => diffLine(doc, entry)));
                    if (view.diff.more) list.appendChild(el(doc, 'li', 'muted', fill(S.moreChanges, { n: view.diff.more })));
                    changed.appendChild(list);
                }
                const ops = el(doc, 'details', 'sb-insp-ops-box');
                ops.appendChild(el(doc, 'summary', 'muted', fill(S.ops, { n: view.ops.length })));
                const opList = el(doc, 'ul', 'ss-listcard-rows sb-insp-ops');
                opList.append(...view.ops.slice(0, MAX_OPS).map(op => opLine(doc, op)));
                if (view.ops.length > MAX_OPS) opList.appendChild(el(doc, 'li', 'muted', fill(S.moreChanges, { n: view.ops.length - MAX_OPS })));
                ops.appendChild(opList);
                changed.appendChild(ops);
                body.appendChild(changed);

                // Receipts.
                const receipts = section(doc, 'sb-insp-receipts-box', `${S.receipts} (${view.receipts.length})`);
                if (!view.receipts.length) receipts.appendChild(el(doc, 'p', 'muted sb-insp-empty', S.noReceipts));
                else {
                    const list = el(doc, 'ul', 'ss-listcard-rows sb-insp-receipts');
                    for (const receipt of view.receipts) {
                        const row = el(doc, 'li', 'ss-listcard-row');
                        row.setAttribute('data-receipt', receipt.id);
                        const item = el(doc, 'div', 'ss-listcard-item');
                        const main = el(doc, 'span', 'ss-listcard-main');
                        main.appendChild(el(doc, 'span', 'ss-listcard-title', receipt.summary || receipt.type));
                        const meta = [receipt.type, receipt.module, receipt.cause, receipt.rev !== null ? `rev ${receipt.rev}` : '', receipt.narrate ? '' : S.untold].filter(Boolean).join(' · ');
                        main.appendChild(el(doc, 'span', 'ss-listcard-sub sb-insp-meta', meta));
                        item.appendChild(main);
                        row.appendChild(item);
                        list.appendChild(row);
                    }
                    receipts.appendChild(list);
                }
                body.appendChild(receipts);

                // Problems.
                const problems = section(doc, 'sb-insp-problems-box', `${S.problems} (${view.problems.length})`);
                let target = null;
                try { target = rebuild ? rebuildTarget(rebuild.blocked()) : null; } catch { target = null; }
                // The "start from the chat" button and the place its confirmation opens, on a Problem row.
                const rebuildButton = row => {
                    const slot = el(doc, 'div', 'sb-insp-rebuild-slot');
                    const go = el(doc, 'button', 'ss-btn ss-btn-primary sb-insp-rebuild', STRINGS.rebuild.start);
                    go.type = 'button';
                    go.addEventListener('click', () => {
                        go.hidden = true;
                        const widget = rebuild.widget.render(slot, { inline: true, open: true, onCancel: () => { widget.destroy(); go.hidden = false; } }, {});
                    });
                    row.append(go, slot);
                };
                if (!view.problems.length && !target) problems.appendChild(el(doc, 'p', 'muted sb-insp-empty', S.noProblems));
                else {
                    const list = el(doc, 'ul', 'ss-listcard-rows sb-insp-problems');
                    const rowOf = (message, code) => {
                        const row = el(doc, 'li', 'ss-listcard-row');
                        const item = el(doc, 'div', 'ss-listcard-item');
                        const main = el(doc, 'span', 'ss-listcard-main');
                        main.appendChild(el(doc, 'span', 'ss-listcard-title', message));
                        if (code) main.appendChild(el(doc, 'span', 'ss-listcard-sub', code));
                        item.appendChild(main);
                        row.appendChild(item);
                        list.appendChild(row);
                        return row;
                    };
                    for (const problem of view.problems) {
                        const row = rowOf(problem.message, problem.code);
                        // One button for the block, on the first row of its cause.
                        if (target && problem.code === target.code) { rebuildButton(row); target = null; }
                    }
                    // The block is the timeline's, not a reply's: when no reply row carries it, it has its own row.
                    if (target) rebuildButton(rowOf(STRINGS.rebuild.rowTitle, `${target.code} · ${rebuild.nameOf?.(target.module) ?? target.module}`));
                    problems.appendChild(list);
                }
                body.appendChild(problems);

                // The whole state, folding, with the search.
                const state = section(doc, 'sb-insp-state', S.state);
                const query = String(memory.search ?? '').trim();
                const found = query ? matchPaths(view.state, query) : null;
                if (found) {
                    state.appendChild(el(doc, 'p', 'muted sb-insp-count', found.count === 0 ? S.notFound
                        : fill(found.capped ? S.foundCapped : S.found, { n: found.capped ? LIMITS.matches : found.count })));
                }
                const tree = el(doc, 'div', 'sb-insp-tree');
                if (!found || found.count > 0) drawTree(tree, view.state, { doc, open: memory.open, search: found });
                state.appendChild(tree);
                body.appendChild(state);
            }

            function redraw() {
                drawBody(drawPicker());
            }

            const pick = index => {
                // The newest reply means "follow the story": the picker moves on with new replies.
                memory.index = replies[0]?.index === index ? null : index;
                redraw();
            };
            const step = by => {
                const at = replies.indexOf(chosen());
                const next = replies[at + by];
                if (next) pick(next.index);
            };
            picker.addEventListener('change', () => pick(Number(picker.value)));
            older.addEventListener('click', () => step(1));
            newer.addEventListener('click', () => step(-1));
            latest.addEventListener('click', () => pick(replies[0]?.index ?? null));
            search.addEventListener('input', () => {
                memory.search = cutAt(String(search.value ?? ''), 200);
                drawBody(chosen());
            });

            const offs = [];
            if (typeof api?.on === 'function') {
                for (const name of ['head', 'committed', 'turn', 'modules']) {
                    try {
                        const off = api.on(name, () => redraw());
                        if (typeof off === 'function') offs.push(off);
                    } catch { /* an older host without that event */ }
                }
            }
            redraw();
            return {
                update: () => redraw(),
                destroy() {
                    for (const off of offs.splice(0)) off();
                    root.remove?.();
                },
            };
        },
    });
}
