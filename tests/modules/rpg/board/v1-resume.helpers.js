// Drives a v1 fight to a fled, lost or won end through the page's Fight board (view.open), for the foe-bar resume tests.
import { createBoardView } from '../../../../modules/rpg/board/view.js';
import { boardApi } from '../../../core/helpers/board-port.js';
import { page } from '../view/page.js';
import { v1Host, headSid, step, stage } from './v1.helpers.js';

export async function resumeKit(t, options) {
    const { doc } = await page(t, { formula: 'standard' });
    const { host } = await v1Host(options);
    const meta = () => host.ctx.chatMetadata;
    // (the port's api is bound to the head reply: asked anew each call, since a send moves the head)
    const fresh = new Proxy({}, { get: (_, key) => (...args) => boardApi(meta(), () => host.head(), headSid(host))[key](...args) });
    const board = createBoardView({ doc, headState: () => host.head(), meta, store: host.store, interaction: fresh, rules: () => ({ formula: 'standard' }),
        query: (name, args) => host.sdk.query(name, args), readerName: () => 'Astra', levels: () => ({ ranks: [], playerRank: null }), on: () => true });
    t.after(() => { board.destroy(); host.close(); });
    const current = () => boardApi(meta(), () => host.head(), headSid(host)).current();
    /** Stages `choice` until the fight ends (at most `limit` steps); → the end state's outcome. */
    const play = (choice, limit = 40) => {
        for (let at = 0; at < limit && current()?.view?.state !== 'end'; at += 1) {
            const made = stage(host, step(choice, choice === 'normal' ? { target: '1.1' } : {}));
            if (!made.ok) throw new Error(made.error);
        }
        return current()?.view?.end?.outcome;
    };
    const foeHp = () => current().view.foeGroups.flatMap(group => group.members.map(foe => foe.hp));
    return { host, board, current, play, foeHp, meta };
}
