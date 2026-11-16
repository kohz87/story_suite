/* Value helpers the relationship map parts share: plain text, a clamped score and a signed number. */
export function plain(value) { return String(value ?? '').trim(); }

export function score(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(-100, Math.min(100, Math.round(number))) : 0;
}

export function signed(value) { return value > 0 ? `+${value}` : (value < 0 ? `−${Math.abs(value)}` : '0'); }
