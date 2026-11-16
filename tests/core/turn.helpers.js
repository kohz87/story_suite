import { createHost } from '../../packages/story-block/testkit/index.js';

// The closing cue (turn/text.js) is the last text of a reply's prompt; the tests that read the tail's own text look before it.
export const noCue = text => String(text).replace(/\n\nAfter the story, write the <Changes> block[^\n]*$/, '');

// A small inventory module: items by name, a capture kind `item`, a command for the UI.
export function bag() {
    return {
        id: 'bag',
        name: 'Bag',
        domains: {
            inventory: {
                initial: () => ({ items: {} }),
                validate: slice => (Object.values(slice.items).some(qty => qty < 0) ? ['A count went below zero.'] : []),
            },
        },
        commands: {
            'bag.add'(ctx, { name, qty }) {
                const inv = ctx.draft('inventory');
                inv.items[name] = (inv.items[name] ?? 0) + qty;
                return { summary: `Ren picks up ${qty} ${name} (now ${inv.items[name]}).`, narrate: true };
            },
        },
        capture: {
            kinds: { item: { grammar: '+ item Name | qty: 1', aliases: ['items'] } },
            apply(ctx, line) {
                const inv = ctx.draft('inventory');
                const qty = Number(line.labels.qty ?? 1);
                if (!Number.isInteger(qty) || qty < 1) ctx.fail('INVALID', `"${line.labels.qty}" is not a count.`);
                const have = inv.items[line.name] ?? 0;
                if (line.op === '-' && have < qty) ctx.fail('NOT_ENOUGH', `There is no ${line.name} left.`);
                inv.items[line.name] = line.op === '-' ? have - qty : have + qty;
                return { summary: `${line.op === '-' ? 'Lost' : 'Got'} ${qty} ${line.name}.`, narrate: false };
            },
        },
        context: {
            static: () => 'Bag: the story never sets counts.',
            tail: view => ({ lines: [`[Bag] ${Object.entries(view.state.domains.inventory.items).map(([name, qty]) => `${name} x${qty}`).join(', ') || 'empty'}`] }),
        },
    };
}

export const fakeHost = ({ modules = [], ...options } = {}) => createHost({ fakes: true, core: false, modules: [bag(), ...modules], ...options });
export const stored = (host, index) => host.ctx.chat[index].extra.storySuite;
export const items = host => host.head().domains.inventory.items;
export const systemText = request => request.chat.filter(message => message.role === 'system').map(message => message.content).join('\n---\n');
