// Groups one reply's receipts and Problems by the module that owns them, and lists the modules that could not finish the reply (suite.isolatedApply on).
// Read-only: it adds nothing to the store. The card's "could not finish" row and the Inspector read it; a settle receipt can be grouped later
// under the same `byModule` map without changing its shape.

const FAILED_CODES = new Set(['FAILED', 'TIMEOUT']);

/** A Problem that says a module could not finish the reply: it names a module, no change line, and is FAILED or TIMEOUT. */
export const isModuleFailure = item => Boolean(item) && typeof item.module === 'string' && item.module !== '' && !item.line && FAILED_CODES.has(item.code);

/**
 * The modules that could not finish reply `index`: [{ module, name, reason, code }], in the order the Problems were told, one per (module, code, message).
 * `nameOf(id)` gives a module's display name (default: the id). Nothing for a reply with no such Problem.
 */
export function moduleFailures(problems, index, nameOf = id => id) {
    const out = [];
    const seen = new Set();
    for (const item of Array.isArray(problems) ? problems : []) {
        if (!isModuleFailure(item) || item.index !== index) continue;
        const reason = String(item.message ?? '').trim();
        const key = `${item.module}\n${item.code}\n${reason}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let name = item.module;
        try { name = String(nameOf(item.module) || item.module); } catch { name = item.module; }
        out.push({ module: item.module, name, reason, code: item.code });
    }
    return out;
}

/**
 * `{ byModule: { [moduleId]: { receipts, problems } }, failed }` for reply `index`: its receipts (by their `module`) and its Problems (by their
 * `module`; the ones naming none are left out of the map), and `failed` from moduleFailures. Modules appear in the order they are first met.
 */
export function applyReport({ receipts = [], problems = [], index, nameOf } = {}) {
    const byModule = {};
    const slot = id => (byModule[id] ??= { receipts: [], problems: [] });
    for (const receipt of Array.isArray(receipts) ? receipts : []) if (typeof receipt?.module === 'string' && receipt.module !== '') slot(receipt.module).receipts.push(receipt);
    for (const item of Array.isArray(problems) ? problems : []) if (item?.index === index && typeof item.module === 'string' && item.module !== '') slot(item.module).problems.push(item);
    return { byModule, failed: moduleFailures(problems, index, nameOf) };
}
