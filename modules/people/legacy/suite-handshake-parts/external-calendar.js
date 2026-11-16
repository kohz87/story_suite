// Reads the shared calendar of the extension that owns 'calendar'.
import { areaOwner } from './deferral.js';
import { safeSuite } from './shared-host.js';
/**
 * The calendar Delta should use while another extension owns 'calendar': that extension's
 * shared { era, months: [{ name, days }] }, or null (Delta then keeps its own calendar). A
 * missing, throwing or malformed provider is treated as absent.
 */
export function externalCalendar(choices = {}, suite = null) {
    const owner = areaOwner('calendar', choices, suite);
    if (!owner) return null;
    try {
        const shared = safeSuite(suite)?.api(owner.id)?.calendar?.();
        if (!shared || typeof shared !== 'object' || !Array.isArray(shared.months) || !shared.months.length) return null;
        return {
            era: String(shared.era ?? ''),
            months: shared.months.map(month => ({ name: String(month?.name ?? ''), days: Number(month?.days) })),
        };
    } catch {
        return null;
    }
}
