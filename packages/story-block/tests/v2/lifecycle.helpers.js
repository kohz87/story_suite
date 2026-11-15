import { INIT_PREFIX } from '../../src/v2/registry.js';

export const PEER = 'story-director';

// Story Director's stand-in: a time domain and a clock command.
export const director = (version = '2.0.0-beta.2', extra = {}) => ({
    id: PEER,
    name: 'Story Director',
    version,
    domains: { director: { initial: () => ({ minutes: 0 }) } },
    commands: { 'director.advance'(ctx, { by = 1 } = {}) { ctx.draft('director').minutes += by; return { summary: 'time passes', narrate: false }; } },
    queries: { 'director.time': state => ({ minutes: state.domains.director?.minutes ?? null }) },
    ...extra,
});

// The mechanics module: needs Story Director, keeps a party, reads wound lines, speaks in the prompt.
export function mech({ range = '>=2.0.0-beta.1', calls = {}, id = 'rpg-battle', peers = { [PEER]: range }, hooks = {}, domain = 'party', features = undefined } = {}) {
    const count = name => { calls[name] = (calls[name] ?? 0) + 1; };
    return {
        id,
        name: 'RPG Battle',
        version: '2.0.0-beta.2',
        requires: { storyBlock: '>=2.0.0-beta.2', peers },
        domains: { [domain]: { initial: () => ({ rulesVersion: 2, rulesHash: 'h-1', actors: {} }) } },
        commands: {
            'combat.start'(ctx) { ctx.draft(domain).actors.hero = { hp: 10 }; count('start'); return { summary: 'A fight starts.', narrate: false }; },
            'combat.peek'(ctx) {
                let said = null;
                try { ctx.call('director.advance', {}); } catch (error) { said = error.code; }
                return { summary: `called: ${said}`, narrate: false, data: { said } };
            },
        },
        queries: { 'combat.session': state => ({ fighters: Object.keys(state.domains[domain]?.actors ?? {}) }) },
        capture: {
            kinds: { wound: { grammar: '~ wound Name — how' } },
            apply(ctx, line) { ctx.draft(domain).actors[line.name] = { hurt: true }; count('capture'); return { summary: `${line.name} is hurt.`, narrate: false }; },
        },
        context: { static: () => 'RB RULES: fights are played in code.', tail: () => ({ lines: ['RB TAIL'], optional: [] }), budget: 100 },
        hooks: {
            canGenerate: () => { count('canGenerate'); return { ok: false, reason: 'Make a character first.' }; },
            beforeGenerate: () => { count('beforeGenerate'); return ['RB CUE']; },
            afterReply: () => { count('afterReply'); },
            ...hooks,
        },
        tabs: [{ id: 'party', title: 'Party', render: () => {} }],
        ...(features ? { features } : {}),
    };
}

// NSD's stand-in: no peers; a canGenerate that allows and a cue of its own.
export const social = () => ({
    id: 'npc-state-delta',
    name: 'NPC State Delta',
    version: '1.2.20',
    domains: { npc: { initial: () => ({ meters: {} }) } },
    hooks: { canGenerate: () => true, beforeGenerate: () => ['NSD CUE'] },
    context: { static: () => 'NSD RULES.', budget: 50 },
});

// Everything the last reply's request carried (the prompt text the model was sent).
export const requestText = host => JSON.stringify(host.st.requests.at(-1));
export const modulesById = host => Object.fromEntries(host.sdk.modules().map(entry => [entry.id, entry]));
export const initReceipts = (host, id) => host.sdk.receipts().map(entry => entry.receipt).filter(receipt => receipt.type === `${INIT_PREFIX}${id}`);
