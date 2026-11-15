// The host's own settings: their defaults and their schema.

import { MAX_CHANGE_LINES } from './limits.js';

export const HOST_SETTINGS_DEFAULTS = Object.freeze({ tailBudget: 1500, contextShare: 40, maxChangeLines: MAX_CHANGE_LINES, callQueue: true, panelStyle: 'glass', glassStrength: 50, font: 'nunito', textSize: '100', sendPending: true });
export const HOST_SETTINGS_SCHEMA = Object.freeze({
    tailBudget: Object.freeze({
        type: 'int', min: 100, max: 20000, label: 'Notes per reply (tokens)',
        help: 'The most Story Suite adds to the end of each reply\'s prompt, about four characters a token.',
    }),
    contextShare: Object.freeze({
        type: 'int', min: 10, max: 90, label: 'Share of the context (%)',
        help: 'The most of SillyTavern\'s context size (less the reply) Story Suite\'s instructions and notes take together; the rest is left for the conversation. The notes are cut to fit, the instructions never are.',
    }),
    maxChangeLines: Object.freeze({
        type: 'int', min: 10, max: 1000, label: 'Change lines per reply',
        help: 'The most change lines one reply may hold; any after them are not used and the Problems list says so.',
    }),
    callQueue: Object.freeze({
        type: 'bool', label: 'Run extra calls one at a time per connection',
        help: 'Story Suite\'s own model calls (Delta\'s scan, the arc planner, Assist) wait for each other when they use the same connection profile, so a local server that answers one request at a time is never asked twice at once. Calls on different profiles still go side by side.',
    }),
    // Story Suite's look (src/v2/view/theme.js): the panels and the font, for every Story Suite screen.
    panelStyle: Object.freeze({
        type: 'choice', label: 'Panel style', options: Object.freeze([
            Object.freeze({ value: 'glass', label: 'Glass' }),
            Object.freeze({ value: 'solid', label: 'Solid' }),
            Object.freeze({ value: 'sillytavern', label: 'Follow SillyTavern' }),
        ]),
        help: 'How Story Suite\'s panels look. Glass: see-through panels over your background. Solid: less transparency and no blur. Follow SillyTavern: its own colours and blur only. Light or dark follows your SillyTavern theme either way. Solid suits a busy background or a slow device; your system\'s "reduce transparency" setting also turns Glass into Solid.',
    }),
    glassStrength: Object.freeze({
        type: 'int', min: 30, max: 90, form: 'slider', label: 'Glass strength (%)',
        help: 'How dense the Glass panels are: low shows more of your background through them, high is easier to read on a busy one. Solid ignores it.',
    }),
    font: Object.freeze({
        type: 'choice', label: 'Font', options: Object.freeze([
            Object.freeze({ value: 'nunito', label: 'Nunito (soft and round)' }),
            Object.freeze({ value: 'theme', label: 'Your theme\'s font' }),
        ]),
        help: 'Nunito comes with Story Block, so it looks the same offline and with "Forbid external media" on. "Your theme\'s font" uses the font SillyTavern\'s theme sets.',
    }),
    // The size of Story Suite's own text (view/theme.js textSizeOf, view/size.css): Normal adds nothing.
    textSize: Object.freeze({
        type: 'choice', form: 'segmented', label: 'Text size', options: Object.freeze([
            Object.freeze({ value: '100', label: 'Normal' }),
            Object.freeze({ value: '110', label: '110%' }),
            Object.freeze({ value: '120', label: '120%' }),
        ]),
        help: 'Makes the text in Story Suite\'s panels bigger: the Game view, cards, dialogs and these settings. Your SillyTavern chat text keeps its own size (SillyTavern\'s User Settings → Font scale).',
    }),
    // The "Send pending" note above the message box (ui-host/send-note.js): a UI note only.
    sendPending: Object.freeze({
        type: 'bool', label: 'Send pending note',
        help: 'Shows a small note above the message box when a Send could not go yet (the story is still finishing, or a fight start is holding it), and sends your text once by itself when the story is free. It never changes what you typed.',
    }),
});
