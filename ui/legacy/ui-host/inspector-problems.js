// Story Block v2's page furniture: what the Inspector lists as a reply's problems, moved out of mountUi unchanged: the blocks its replay skipped, what the
// turn met reading it (change lines not used, with why), the newest head-selection notice per module, and the refused lines the notes keep.

// With `isolated` on (suite.isolatedApply), the reply's module failures are listed grouped under the module's name, after the other problems.
import { isModuleFailure, moduleFailures } from '../../../core/turn/apply-report.js';

export function inspectorProblemsFor(index, { store, runtime, notes, isolated = () => false, nameOf = id => id }) {
    const out = [];
    for (const item of store.problems?.() ?? []) if (item.index === index) out.push({ code: item.code ?? 'SKIPPED', message: item.message });
    const told = (runtime.turn?.problems?.() ?? []).filter(item => item?.index === index);
    const failed = isolated() === true ? moduleFailures(told, index, nameOf) : [];
    for (const item of told) if (!(failed.length && isModuleFailure(item))) out.push({ code: item.code ?? '', message: item.line ? `"${item.line}": ${item.message}` : item.message });
    for (const item of failed) out.push({ code: item.code, message: `${item.name}: ${item.reason}` });
    // The notice that a head selection fell to an earlier saved point is not tied to a reply: the Inspector shows the newest one per module.
    const fell = new Map();
    for (const item of runtime.turn?.problems?.() ?? []) if (item?.code === 'SELECTION_FELL' && !Number.isInteger(item.index)) fell.set(item.module, item);
    for (const item of fell.values()) out.push({ code: item.code, message: item.message });
    if (!told.length) for (const item of notes.refusedAt(index)) out.push({ code: 'REFUSED', message: item.reason ? `"${item.line}": ${item.reason}` : `"${item.line}"` });
    return out;
}
