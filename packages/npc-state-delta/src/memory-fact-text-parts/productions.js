// The allowed sentences of a payload (fallback first) and the fallback text.
import { AXES, AXIS, QUEST_VERB } from './tables.js';

const sub = (template, p) => template.replaceAll('{P}', p);

// Every allowed sentence for a payload, fallback first. Several axes combine in canonical axis order, each clause's direction proven.
export function productions(kind, payload) {
    const p = payload || {};
    if (kind === 'met') return p.place ? [`I first met ${p.player} at ${p.place}.`, `At ${p.place}, I first met ${p.player}.`] : [`I first met ${p.player}.`];
    if (kind === 'milestone') return [`Milestone recorded: “${p.label}”.`];
    if (kind === 'move') {
        const axes = AXES.filter(axis => p.axes?.[axis]);
        if (axes.length === 1) return AXIS[axes[0]][p.axes[axes[0]] === '+' ? 'up' : 'down'].map(text => sub(text, p.player));
        const clause = axis => {
            const text = sub(AXIS[axis][p.axes[axis] === '+' ? 'up' : 'down'][0], p.player);
            return text.slice(0, -1).replace(/^My /, 'my ').replace(/^The /, 'the ');
        };
        const joined = axes.map(clause);
        const last = joined.pop();
        const body = `${joined.length ? `${joined.join(', ')} and ` : ''}${last}`;
        return [`${body.charAt(0).toUpperCase()}${body.slice(1)}.`];
    }
    if (kind === 'gift') return p.action === 'gift' ? [`I received a gift from ${p.player}.`, `${p.player} gave me a gift.`] : [`${p.player} helped me.`, `I was helped by ${p.player}.`];
    if (kind === 'lieCaught') return [`My lie to ${p.to} was caught.`, `I was caught lying to ${p.to}.`];
    if (kind === 'quest') return [`The task “${p.title}” ${QUEST_VERB[p.phase]}.`];
    if (kind === 'fight') {
        const base = p.side === 'beside' ? `I fought beside ${p.player}` : `I fought against ${p.player}`;
        const tail = p.result ? { won: ', and the party won', lost: ', and the party lost', fled: ', and the party fled' }[p.result] : '';
        return [`${base}${tail}.`];
    }
    if (kind === 'party') return [p.action === 'join' ? 'I joined the party.' : 'I left the party.'];
    return [];
}

export function fallbackText(kind, payload) { return productions(kind, payload)[0] || ''; }
