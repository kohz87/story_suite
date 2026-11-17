import { createHost } from '../../../../testkit/index.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { levelOfClass } from '../../../../modules/rpg/formula.js';

export const block = (story, lines) => `${story}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
export const staticText = host => host.st.requests.at(-1)?.chat?.[0]?.content ?? '';
export const tailText = host => host.st.requests.at(-1).chat.filter(message => message.role === 'system').slice(1).map(message => message.content).join('\n');
export const lastIndex = host => host.ctx.chat.length - 1;
export const problems = (host, index = lastIndex(host)) => host.turn.problems().filter(item => item.index === index).map(item => item.message);
export const names = host => host.sdk.query('mounts.list').map(row => row.name);
export const names2 = host => Object.values(host.head().domains.scene.mounts ?? {}).map(row => row.name);
export const MARE = '+ mount Grey Mare | kind: horse | count: 1 | pace: 35 | where: ridden by Wessel';

export async function fresh(t, settings = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings });
    t.after(() => host.close());
    await host.send('Hello.', block('The yard.', ['~ place Stray Oar | kind: inn']));
    return host;
}

export async function character(host, who, soul = 1) {
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = who.toLowerCase(); defs.character.name = who; defs.character.state.who.default = who; defs.character.state.level.default = levelOfClass(soul);
    defs.skills.slug = `${who.toLowerCase()}-skills`; defs.skills.name = `${who}'s skills`; defs.skills.state.who.default = who;
    for (const definition of [defs.character, defs.skills]) {
        const result = await host.sdk.command('dm.define', { definition });
        if (!result.ok) throw new Error(result.message);
    }
}
