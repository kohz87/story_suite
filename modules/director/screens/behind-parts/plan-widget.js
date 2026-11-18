// The Director screen's plan cards widget (beats, hooks, clocks, off-screen, secrets, problems).

import { button, maker, spaced } from '../dom.js';

export const PLAN_WIDGET = 'story-director.plan';
const PLAN_SHOWN = 3;
const PLAN_CARDS = [['beats', 'Beats', 'beat'], ['hooks', 'Hooks the story is planning', 'hook'], ['clocks', 'Clocks', 'clock'], ['agendas', 'Off-screen', 'agenda'], ['secrets', 'Secrets', 'secret'], ['problems', 'Problems', 'problem']];

// An agenda's step bar and its progress line (the pulse's fields): done steps filled, the current one lighter, the rest empty.
function stepsLine(make, steps) {
    const box = make('div', 'sd-stepsbox');
    if (steps.of > 1) {
        const bar = make('span', 'sd-steps', undefined, { role: 'img', 'aria-label': steps.line });
        for (let n = 1; n <= steps.of; n += 1) bar.append(make('i', n < steps.at ? 'd' : n === steps.at ? 'c' : ''));
        box.append(bar, ' ');
    }
    const line = make('p', 'sd-meta');
    const bits = [steps.line && make('span', '', steps.line), steps.place && make('b', 'sd-place', steps.place), steps.arriving && make('span', 'sd-arriving', '→ arriving within the hour')].filter(Boolean);
    line.append(...spaced(bits));
    box.append(line);
    return box;
}

function renderPlan(el, props) {
    const make = maker(el.ownerDocument ?? globalThis.document);
    const root = make('div', 'sd-behind sd-plan');
    el.replaceChildren(root);
    let value = props?.value ?? null;
    const opened = new Set();

    const row = (item, kind) => {
        if (kind === 'problem') {
            const li = make('li', 'sd-problem', undefined, { 'data-kind': item.kind });
            li.append(make('span', 'sd-line', item.text), ' ', make('span', 'ss-pill sd-ptag', item.kind, { title: item.kind }));
            return li;
        }
        const li = make('li', 'sd-thread', undefined, { 'data-thread': item.id });
        li.append(make('span', 'sd-key', item.key));
        if (kind === 'secret' || kind === 'beat') return li;
        if (item.summary) li.append(' ', make('p', 'sd-line', kind === 'agenda' ? `wants: ${item.summary}` : item.summary));
        if (kind === 'agenda' && item.steps) li.append(' ', stepsLine(make, item.steps));
        const meta = [kind === 'agenda' && item.fields?.now ? `At: ${item.fields.now}` : '', kind === 'clock' && item.fields?.due ? `Due: ${item.fields.due}` : '', item.fields?.then ? `Next: ${item.fields.then}` : ''].filter(Boolean);
        // The text sits in a span: the sheet hides a `.sd-meta` with no child element.
        if (meta.length) {
            const line = make('p', 'sd-meta');
            line.append(make('span', '', meta.join(' · ')));
            li.append(' ', line);
        }
        return li;
    };

    function draw() {
        const data = value && typeof value === 'object' ? value : {};
        const cards = [];
        for (const [name, title, kind] of PLAN_CARDS) {
            const items = Array.isArray(data[name]) ? data[name] : [];
            if (!items.length) continue;
            const card = make('section', 'sd-kind ss-glass sd-plan-card', undefined, { 'data-kind': kind });
            const head = make('h4', 'sd-h', title);
            head.append(' ', make('small', '', String(items.length)));
            const shown = opened.has(name) ? items : items.slice(0, PLAN_SHOWN);
            const list = make('ul', 'sd-list sd-threads');
            list.append(...shown.map(item => row(item, kind)));
            card.append(head, ' ', list);
            if (items.length > PLAN_SHOWN) {
                const more = opened.has(name) ? 'Show less' : `+ ${items.length - PLAN_SHOWN} more`;
                card.append(' ', button(make, `${more} ${opened.has(name) ? '‹' : '›'}`, 'ss-button-quiet sd-more', null, () => {
                    if (!opened.delete(name)) opened.add(name);
                    draw();
                }));
            }
            cards.push(card);
        }
        root.replaceChildren(...spaced(cards));
    }

    draw();
    return { update(next) { value = next?.value ?? null; draw(); }, destroy() { root.remove(); } };
}

/** The Director screen's plan cards (bound to `director.plan`). The beats, off-screen and secrets are the feature `story-director.threads`'. */
export const planWidget = Object.freeze({
    props: Object.freeze({ value: Object.freeze({ type: 'object', default: null }) }),
    primary: 'value',
    validate: props => (props?.value !== undefined && props.value !== null && typeof props.value !== 'object' ? ['value must be the director.plan data.'] : []),
    render: renderPlan,
});
