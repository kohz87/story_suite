// The RPG's parts that run on the page while its feature is on, with no screens of their own (loaded by import() from live/sync.js):
// the fight pause that holds the reader's Send, the board it opens, the fight offer for standing foes, the battle log in the replies,
// and the bridge the new view reads the pause through (board/hold-bridge.js). The new view draws the pause, the offer and the board on
// its Fight tab; the battle log is drawn in the chat here.

import { createBattleLog } from '../view/battle-log.js';
import { isStandard, packRulesOf, rulesFromSettings } from '../rules.js';
import { packLevelsOf, xpRateFrom } from '../levels.js';
import { PRACTICE_SETTING, autoCapFrom, practiceOf } from '../names.js';
import { createBoardView } from '../board/view.js';
import { createFightOffers } from '../board/offers.js';
import { createStartController } from '../board/start-controller.js';
import { attachHoldBridge, claimScreen } from '../board/hold-bridge.js';

/** The screen the RPG asks the page to show for a fight: the new view shows it as its Fight tab (ui/port/hold.js). */
export const FIGHT_SCREEN = 'story-block/fight';
const STYLE_ATTR = 'data-ss-rpg';
// The battle log's look (lean-rpg.css), its Status bars (bars.css) and the Check card it draws in its place (check-card.css).
const STYLE_FILES = ['../view/lean-rpg.css', '../view/bars.css', '../view/check-card.css'];
// The fight offer is drawn by the new view (Fight tab, Needs you): nothing is drawn under the reply.
const NO_LINE = Object.freeze({ render() {}, update() {}, clear() {}, destroy() {} });

function addStyle(doc, file) {
    try {
        const href = new URL(file, import.meta.url).href;
        if ([...(doc.querySelectorAll?.(`link[${STYLE_ATTR}]`) ?? [])].some(link => link.getAttribute('href') === href)) return null;
        const link = doc.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute(STYLE_ATTR, '');
        link.setAttribute('href', href);
        (doc.head ?? doc.body).appendChild(link);
        return link;
    } catch { return null; }   // a page with no head: the log still works, with the base look
}

/**
 * mountRpgLive({ doc, ctx, store, events, headState, readerName, featureOn, meta, save, values, query, interaction, previewStart, generateHeld })
 * → { start, board, offers, battleLog, destroy() }. `headState()` is the head state, `meta()` / `save()` the open chat's metadata and its write,
 * `values()` Story Block's settings, `query(name, args)` the sdk's queries, `interaction` the sdk's interactions, `previewStart()` the turn's
 * fight-start preview and `generateHeld()` sends the held reply again.
 */
export function mountRpgLive({ doc, ctx, store, events = null, headState, readerName = () => '', featureOn = () => true, meta = () => null, save = () => {}, values = () => ({}), query = null, interaction = null, previewStart = () => null, generateHeld = () => {} }) {
    const links = STYLE_FILES.map(file => addStyle(doc, file)).filter(Boolean);
    const show = () => claimScreen(doc, FIGHT_SCREEN);
    const pack = () => {
        try {
            const found = packRulesOf(query?.('packs.content', { kind: 'rpg' }));
            if (!found) return null;
            const listed = (query?.('packs.list') ?? []).find(entry => entry?.id === found.pack);
            return { ...found, name: String(listed?.name ?? found.pack ?? '') };
        } catch { return null; }
    };
    const rules = () => rulesFromSettings(values(), pack());
    // Each read of the pack settles the timeline, so the offer reads it once per head.
    let packKept = null;
    const packOnce = () => {
        const head = headState();
        if (packKept && packKept.head === head) return packKept.value;
        const value = pack();
        packKept = { head: headState(), value };
        return value;
    };
    const levels = () => { let found = null; try { found = packLevelsOf(query?.('packs.content', { kind: 'rpg' })); } catch { found = null; } return { ranks: found?.ranks ?? [], playerRank: found?.playerRank ?? null, levelCap: found?.levelCap ?? null }; };
    let board;
    const start = createStartController({ doc, chat: () => ctx?.chat ?? [], meta, state: headState, preview: previewStart, interaction,
        board: () => board, on: () => featureOn(), save, refresh: () => {}, generate: generateHeld, cap: () => autoCapFrom(values()), show, close: () => {} });
    board = createBoardView({ doc, headState: () => start.state(), meta, save, store, interaction, practice: () => practiceOf(values()[PRACTICE_SETTING]) ?? undefined, rate: () => xpRateFrom(values()), rules, query, readerName, levels, on: featureOn, start, cap: () => autoCapFrom(values()) });
    const offers = createFightOffers({ ctx, doc, store, meta, on: () => featureOn() && isStandard(rulesFromSettings(values(), packOnce())), view: NO_LINE,
        open: ({ auto = false } = {}) => { if (!board.open()) return false; if (auto) board.auto(); show(); return true; }, save, refresh: () => {} });
    const offHold = attachHoldBridge({ doc, start, offers, discard: () => { if (interaction?.current?.()) interaction.discard(interaction.current().id); } });
    const battleLog = createBattleLog({ ctx, doc, store, events, featureOn, readerName, levels, offer: offers });
    // A pause that is ready (foes found, a choice to make) shows the Fight tab; a wait for the fight ("Setting up the fight…") shows only its dot.
    const offFightStart = events?.on?.('head', info => {
        if (!['interaction-start', 'fight-start', 'fight-start-done'].includes(info?.reason)) return;
        start.changed();
        const waiting = start.current();
        if (info.reason === 'fight-start-done' || !waiting || waiting.mode === 'working') return;
        show();
    });
    battleLog.refreshAll();
    return {
        start,
        board,
        offers,
        battleLog,
        destroy() {
            battleLog.destroy();
            offFightStart?.();
            offHold();
            start.destroy();
            for (const link of links) link.remove();
        },
    };
}
