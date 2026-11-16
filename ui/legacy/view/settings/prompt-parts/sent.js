// "Show what's sent": the sub-fold under the size that draws every part's exact text by place, with its size and Copy.

import { SETTINGS_TEXT, SENT_FOLD, sentText } from '../../../host-ui.js';
import { fill } from '../../../../../core/strings.js';
import { el, num } from './shared-dom.js';

// "Show what's sent": a sub-fold under the size, every part's exact text by place with its size and Copy (the clipboard, else the
// text is selected for copying by hand). It only reads. The texts are drawn only while it is open.
export function sentFold(doc, state, openState) {
    const T = SETTINGS_TEXT.sent;
    const details = el(doc, 'details', 'story-suite-subfold story-suite-sent');
    details.dataset.fold = SENT_FOLD;
    const summary = el(doc, 'summary');
    summary.append(el(doc, 'b', '', T.title), el(doc, 'small', '', T.hint));
    const body = el(doc, 'div', 'story-suite-subfold-body');
    details.append(summary, body);
    details.open = openState?.get(SENT_FOLD) === true;
    const draw = () => {
        if (!details.open || body.children.length) return;
        drawSent(doc, body, sentText(state.read.parts, state.read.own, { names: state.read.names, redact: state.read.redact }), state.read.tokensOf, state.read.exact);
    };
    details.addEventListener('toggle', () => {
        openState?.set(SENT_FOLD, details.open === true);
        draw();
    });
    // Opening it from outside (the footer bar, `openSettings({ fold: SENT_FOLD })`): open and draw now, not at the browser's own toggle.
    details.ssOpen = () => {
        details.open = true;
        openState?.set(SENT_FOLD, true);
        draw();
    };
    draw();
    return details;
}

function drawSent(doc, body, text, tokensOf, exact) {
    const T = SETTINGS_TEXT.sent;
    body.appendChild(el(doc, 'p', 'story-suite-muted', T.help));
    const actions = el(doc, 'div', 'story-suite-sent-actions');
    const copy = el(doc, 'button', 'menu_button story-suite-sent-copy');
    copy.type = 'button';
    copy.title = T.copyTitle;
    copy.setAttribute('aria-label', T.copyTitle);
    const glyph = el(doc, 'i', 'fa-solid fa-copy');
    glyph.setAttribute('aria-hidden', 'true');
    copy.append(glyph, el(doc, 'span', '', T.copy));
    const status = el(doc, 'span', 'story-suite-sent-status');
    status.setAttribute('role', 'status');
    actions.append(copy, status);
    body.appendChild(actions);
    const texts = el(doc, 'div', 'story-suite-sent-texts');
    const sections = [['static', T.static, text.static], ['tail', T.tail, text.tail]];
    if (text.own.length) sections.push(['own', T.own, text.own]);
    for (const [place, heading, list] of sections) {
        const section = el(doc, 'section', 'story-suite-sent-section');
        section.dataset.place = place;
        section.appendChild(el(doc, 'h5', '', heading));
        if (!list.length) section.appendChild(el(doc, 'p', 'story-suite-muted', T.nothing));
        for (const part of list) {
            const item = el(doc, 'div', 'story-suite-sent-part');
            item.dataset.module = part.module;
            const n = part.counted ? tokensOf(part.counted) : 0;
            const head = el(doc, 'p', 'story-suite-sent-head');
            head.append(el(doc, 'b', '', part.title), doc.createTextNode(' · '), el(doc, 'small', '', fill(exact ? T.tokens : T.about, { n: num(n) })));
            item.appendChild(head);
            if (part.text) {
                const pre = el(doc, 'pre', 'story-suite-sent-text', part.text);
                pre.tabIndex = 0;
                pre.setAttribute('aria-label', fill(T.textLabel, { part: part.title }));
                item.appendChild(pre);
            }
            if (part.dropped) item.appendChild(el(doc, 'p', 'story-suite-muted story-suite-sent-dropped', part.dropped === 1 ? T.droppedOne : fill(T.dropped, { n: part.dropped })));
            section.appendChild(item);
        }
        texts.appendChild(section);
    }
    body.appendChild(texts);
    copy.addEventListener('click', async () => {
        const clipboard = (doc.defaultView ?? globalThis).navigator?.clipboard;
        try {
            if (typeof clipboard?.writeText !== 'function') throw new Error('no clipboard');
            await clipboard.writeText(text.copy);
            status.textContent = T.copied;
        } catch {
            const win = doc.defaultView ?? globalThis;
            const range = doc.createRange?.();
            const selection = win.getSelection?.();
            if (range && selection) {
                range.selectNodeContents(texts);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            status.textContent = T.copyFailed;
        }
    });
}
