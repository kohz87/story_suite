// Scripted play for the matrix runner: reply text, module facts, setup commands and sending a reply.

import { MODULES, ORDER } from '../../modules.js';
import { keysOf } from './keys.js';

const linesFor = (keys, set) => keysOf({}, keys).flatMap(key => MODULES[key][set]);
const replyText = (keys, set) => `The ${set} reply.\n\n<Changes>\n${linesFor(keys, set).join('\n')}\n</Changes>`;
const factsOf = (host, keys) => Object.fromEntries(keysOf({}, keys).map(key => [key, MODULES[key].facts(host)]));

async function runSetups(host, keys) {
    for (const key of ORDER.filter(entry => keys.includes(entry))) if (MODULES[key].setup) await MODULES[key].setup(host);
}
async function play(host, keys, set) {
    const sent = await host.send(`Turn ${set}.`, replyText(keys, set));
    if (sent.aborted) throw new Error(`the reply ${set} was held back: ${host.st.notices.map(item => `"${item.reason}"`).join(', ') || 'no reason given'}`);
    return sent;
}

export { replyText, factsOf, runSetups, play };
