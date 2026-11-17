// World events, the tempo setting (`chronicle.tempo` under Story Director, stored as text like the map's scales): how fast the world moves.

/** The tempo the daily step runs at: the setting as a number (a bad or absent value is 1; a number outside 0.25-4 is passed on so the step warns and uses 1). */
export function tempoOf(settings) {
    const raw = settings?.tempo;
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : 1;
}
