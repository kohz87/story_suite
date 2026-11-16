import { createCardMount } from '../../../../ui/legacy/view/mounts/card.js';
import { fakeChat, fakeQuery, fakeRenderer, screen, screensWith, setupDom } from './helpers.js';

export function world({ revs = [1, 2, 3, 4], users = [], observer = null, cards = { 'm/sheet': true }, defs, extra = {} } = {}) {
    const doc = setupDom();
    const chat = fakeChat(doc, revs, { users });
    const render = fakeRenderer();
    const query = fakeQuery();
    const screens = screensWith(defs ?? [
        screen('m/sheet', ['card', 'tab'], { title: 'Sheet', data: { hp: { query: 'party.hp' } } }),
        screen('m/off', ['card']),
        screen('m/tab', ['tab']),
    ], { reader: { cards } });
    const deps = {
        screens,
        render,
        query,
        stateAt: chat.stateAt,
        headIndex: chat.headIndex,
        changesAt: chat.changesAt,
        carriers: chat.carriers,
        swipeAt: chat.swipeAt,
        messageElement: chat.messageElement,
        IntersectionObserver: observer,
        ...extra,
    };
    return { doc, chat, render, query, screens, deps, cards: createCardMount(deps) };
}

export const cardsUnder = message => message.querySelectorAll('.ss-card');
export const sectionsOf = card => card.querySelectorAll('.ss-card-sec').map(section => section.getAttribute('data-ss-section'));
