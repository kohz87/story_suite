// The bounded, typed payload of one fact kind (what is stored).
import { AXES, QUEST_VERB } from './tables.js';
import { playerLabel, safeLiteral } from './literals.js';

// Bounded, typed payload of one kind (what is stored): null when the kind or an essential value is missing or unsafe.
export function cleanPayload(kind, raw = {}) {
    const p = playerLabel(raw.player);
    if (kind === 'met') {
        const place = safeLiteral(raw.place);
        return { player: p, ...(place ? { place } : {}) };
    }
    if (kind === 'milestone') { const label = safeLiteral(raw.label); return label ? { label } : null; }
    if (kind === 'move') {
        const axes = {};
        for (const axis of AXES) if (raw.axes?.[axis] === '+' || raw.axes?.[axis] === '-') axes[axis] = raw.axes[axis];
        return Object.keys(axes).length ? { player: p, axes } : null;
    }
    if (kind === 'gift') return raw.action === 'gift' || raw.action === 'help' ? { player: p, action: raw.action } : null;
    if (kind === 'lieCaught') { const to = safeLiteral(raw.to); return to ? { to } : null; }
    if (kind === 'quest') { const title = safeLiteral(raw.title); return title && QUEST_VERB[raw.phase] ? { title, phase: raw.phase } : null; }
    if (kind === 'fight') {
        if (raw.side !== 'beside' && raw.side !== 'against') return null;
        return { player: p, side: raw.side, ...(['won', 'lost', 'fled'].includes(raw.result) ? { result: raw.result } : {}) };
    }
    if (kind === 'party') return raw.action === 'join' || raw.action === 'leave' ? { action: raw.action } : null;
    return null;
}
