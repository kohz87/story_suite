// The two host widgets of a card's footer: Show all / Show less, and the Open Quests link.

import { STRINGS } from '../../../../core/strings.js';
import { CAP_CLASS, QUESTS_SCREEN } from './names.js';
import { capToggle } from './toggle.js';

/** `story-block.show-more`: { target } (a selector inside the card that holds the widget; default `.sb-cap`), { key }, { more, less }. */
export function createShowMoreWidget() {
    return Object.freeze({
        props: {},
        primary: null,
        validate: () => [],
        render(host, props = {}, _api = {}) {
            const doc = host.ownerDocument ?? globalThis.document;
            const card = typeof host.closest === 'function' ? host.closest('section') : null;
            const selector = typeof props.target === 'string' && props.target ? props.target : `.${CAP_CLASS}`;
            const target = card?.querySelector?.(selector) ?? null;
            if (!target) return { update() {}, destroy() { host.replaceChildren(); } };
            const toggle = capToggle(doc, target, {
                key: typeof props.key === 'string' ? props.key : '',
                more: typeof props.more === 'string' && props.more ? props.more : STRINGS.showMore.more,
                less: typeof props.less === 'string' && props.less ? props.less : STRINGS.showMore.less,
            });
            host.replaceChildren(toggle.button);
            const view = doc.defaultView;
            const onResize = () => toggle.refresh();
            view?.addEventListener?.('resize', onResize);
            toggle.refresh();
            view?.requestAnimationFrame?.(() => toggle.refresh());
            return {
                update() { toggle.refresh(); },
                destroy() {
                    view?.removeEventListener?.('resize', onResize);
                    toggle.destroy();
                },
            };
        },
    });
}

/**
 * `story-block.quests-link`: Home's Quests card footer, a text button "Open Quests ›" that opens the Quests screen (Story Director's).
 * Nothing is drawn while that screen does not exist (`has(id)`), so Home alone shows no dead link. `open(id)` shows the screen.
 */
export function createQuestsLinkWidget({ has = () => false, open = () => false } = {}) {
    return Object.freeze({
        props: {},
        primary: null,
        validate: () => [],
        render(host) {
            host.replaceChildren();
            if (!has(QUESTS_SCREEN)) return { update() {}, destroy() { host.replaceChildren(); } };
            const doc = host.ownerDocument ?? globalThis.document;
            const button = doc.createElement('button');
            button.type = 'button';
            button.className = 'ss-button sb-open-quests';
            button.textContent = STRINGS.home.openQuests;
            button.addEventListener('click', () => { open(QUESTS_SCREEN); });
            host.replaceChildren(button);
            return { update() {}, destroy() { host.replaceChildren(); } };
        },
    });
}
