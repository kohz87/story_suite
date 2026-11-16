import { suite } from './helpers/pacing-suite.js';
import { MODULE_ID } from '../src/storysuite-v2.js';
import { FEATURE_NOTES } from '../src/npc-meters-config.js';

export const said = "I didn't sell a spell.";

export function notesSpy() {
    const calls = [];
    return {
        calls,
        run: change => calls.push(['run', change]),
        flag: (text, cue) => calls.push(['flag', text, cue]),
    };
}

export const ON = { [FEATURE_NOTES]: true };
export const oren = s => s.host.head().domains.people?.bonds?.npcs?.npc_oren;
export const cast = async (s, name = 'Oren') => (await s.host.sdk.query('npc.cast', {})).find(item => item.name === name);
export const optional = s => s.host.registry.module(MODULE_ID).context.tail({ state: s.host.head(), chat: { length: s.host.ctx.chat.length } }).optional;
export const shape = s => JSON.stringify(s.host.head()).replace(/sw_[a-z0-9]+/g, 'sw');

// The run's conditions: tailBudget 550, a crowded earlier section (Story Director's lines) with a kept Initiative line, a kept pulse prelude, nobody present.
export async function crowded(keptTokens) {
    const { assemble, estimateTokens, KEPT_TAIL_TOKENS } = await import('../../../core/prompt.js');
    const s = await suite({ allowance: null, features: ON, present: [] });
    await s.setDay(1);
    const initiative = 'Initiative: Mira acts first, then the guards, then Oren.';
    const filler = Array.from({ length: 11 }, (_, i) => `Scene note ${i + 1}: ${"the harbour street holds its breath ".repeat(5)}`.trim());
    s.host.registry.register({ id: 'aa-crowd', name: 'Crowd', context: { tail: () => ({ lines: [{ text: initiative, keep: true }, ...filler, 'Guild: the last ordinary line.'] }) } });
    const view = { state: s.host.head(), query: () => null, settings: {}, chat: { length: s.host.ctx.chat.length } };
    const built = assemble({ registry: s.host.registry, view, settings: { tailBudget: 550 }, keptTokens });
    return { built, initiative, estimateTokens, KEPT_TAIL_TOKENS };
}
