// The replay witnesses of a data-module action and the guard that checks them against the prefix.
import { DM_LIMITS as L, DM_OLD_ROOM, dmObject } from '../../schema.js';
import { validateDataMigration } from '../../check.js';
import { copy, atPath, conditionHolds } from '../../interpreter.js';
import { activeDefinition, actorsOf, instanceOf, publicView, projectImport } from '../../adapters.js';
import { hashJson } from '../../../../../../../core/replay.js';
import { rpgLib } from '../../../rpg-lazy.js';
import { PARTY_ACTIVE, PARTY_MAX } from '../../../lean-rpg/names.js';
import { hashOf, activeCount, blockCount, checkedTarget, partyRoomOf } from '../shared.js';

// Witnesses contain only relevant local paths. A guard never interprets effects or asks live
// services: it verifies the recorded decision against the prefix and allows the host's saved ops.
export function replayInputs(state, { module, subject = 'chat', reads = [], imports = [], actor = false, adapters = null, subjects = [], available = [], clock = false, party = false, bench = '' } = {}) {
    const domain = state?.domains?.dataModules, active = domain?.active?.[module];
    const definition = activeDefinition(state, module), instance = instanceOf(state, module, subject);
    return { active: active ? { hash: active.hash, generation: active.generation, attached: active.subjects.includes(subject) } : null,
        ...(clock ? { clock: state?.domains?.director?.time?.minutes ?? null } : {}),
        // (a marked join, creation or return: only whether the party had room, fewer than 8 active; unmarked replies record none)
        // (the limit is the one the selector recorded: 4 under the `partyFour` mark, else 8)
        ...(party ? { party: { room: partyRoomOf(state, party === PARTY_ACTIVE ? PARTY_ACTIVE : PARTY_MAX) } } : {}),
        // (a bench choice: the member who steps out is still in the party and has not left yet)
        ...(bench ? { bench: { active: Boolean(domain?.active?.[bench]), left: instanceOf(state, bench)?.fields?.left === true } } : {}),
        reads: reads.map(path => ({ path, value: copy(atPath(instance, path)) })),
        imports: Object.fromEntries(imports.map(alias => [alias, (adapters ?? definition?.imports)?.[alias] ? projectImport(state, (adapters ?? definition.imports)[alias]) : null])),
        actor: actor ? actorsOf(state)[subject] ?? null : null,
        ...(available.length ? { available: Object.fromEntries(available.map(alias => {
            const entry = (adapters ?? definition?.imports)?.[alias];
            return [alias, entry?.query === 'dataModules.public' ? {
                export: publicView(state, entry.args) !== null,
                actor: entry.args.who ? Boolean(actorsOf(state)[entry.args.who]) : null,
            } : null];
        })) } : {}),
        subjects: Object.fromEntries(subjects.filter(id => id !== 'chat').map(id => [id, actorsOf(state)[id] ?? null])) };
}

export function dataModuleGuard(view, info) {
    try {
        const { guard, recorded, source } = info, predicate = guard?.predicate;
        if (guard?.owner !== 'story-block' || guard.version !== 2 || !['dm.pin', 'dm.attach', 'dm.migrate', 'dm.act', 'dm.set', 'dm.tick', 'dm.settle', 'dm.define', 'dm.redefine', 'dm.remove', 'dm.join'].includes(predicate?.kind)
            || !dmObject(recorded) || hashJson(recorded.source) !== hashJson(source)) return { ok: false, reason: 'Malformed data module guard.' };
        const domain = view.state.domains?.dataModules;
        if (predicate.kind === 'dm.pin' || predicate.kind === 'dm.define' || predicate.kind === 'dm.join') {
            // A joining companion is two blocks made as one action (the Character, then the Skills block kept in `decision.more`, then the
            // Combat rules and Foes blocks a story's first character brings when it has none).
            const join = predicate.kind === 'dm.join', more = join ? recorded.decision?.more : [];
            if (join && (!Array.isArray(more) || more.length < 1 || more.length > 1 + (rpgLib()?.RPG_EXTRAS.length ?? Infinity) || !more.every(dmObject))) return { ok: false, reason: 'Malformed data module guard.' };
            if (domain?.active?.[predicate.module] || recorded.pin.interpreter !== 1 || recorded.pin.definition.id !== predicate.module
                || hashOf(recorded.pin.definition) !== predicate.hash) return { ok: false, reason: 'Pin selection or checked definition changed.' };
            // (a join recorded without the party witness was made under the old room, 8 own blocks and 16 pins: the guard keeps that, as Re-read does)
            const room = join && !recorded.selector?.party ? DM_OLD_ROOM : L;
            if (activeCount(domain) + more.length >= room.pins) return { ok: false, reason: 'Data module limit changed.' };
            // A Skills block made with its Character (the wizard) goes with it: with the Character gone from this prefix, it is skipped too.
            const after = recorded.decision?.after;
            if (predicate.kind === 'dm.define' && after !== undefined && (typeof after !== 'string' || !domain?.active?.[after])) return { ok: false, reason: 'The Character this Skills block was made with is not in the story now.' };
            const chatBlock = (pin, module) => pin?.packId === 'chat' && pin.packVersion === '0' && pin.packHash === null && pin.definition?.pack === 'chat'
                && module === `pack.chat/${pin.definition.slug}` && pin.definition.scope === 'chat';
            if ((predicate.kind !== 'dm.pin' && (!chatBlock(recorded.pin, predicate.module) || blockCount(domain) + more.length >= room.definitions))) return { ok: false, reason: 'Block selection or chat limit changed.' };
            // A companion joined a story that had blocks: if every one of them is gone (a delete or swipe of the reply that made them), the join is skipped
            // with its own reason instead of failing to find the place it was written in.
            if (join && recorded.decision?.base === true && !domain) return { ok: false, reason: 'The blocks this story had when the companion joined are gone; Re-read this action.' };
            checkedTarget(recorded.pin.definition, view.state);
            for (const second of more) {
                if (domain?.active?.[second.module] || second.module === predicate.module || second.pin?.interpreter !== 1 || second.pin.definition?.id !== second.module
                    || hashOf(second.pin.definition) !== second.hash || !chatBlock(second.pin, second.module)) return { ok: false, reason: 'Block selection or chat limit changed.' };
                checkedTarget(second.pin.definition, view.state);
            }
        } else {
            const active = domain?.active?.[predicate.module];
            if (!active || !activeDefinition(view.state, predicate.module) || hashOf(activeDefinition(view.state, predicate.module)) !== active.hash) return { ok: false, reason: 'The required frozen pin is missing or damaged.' };
            if (predicate.kind === 'dm.migrate') {
                if (active.hash !== recorded.decision.previous || predicate.generation !== active.generation + 1
                    || hashOf(recorded.pin.definition) !== predicate.hash
                    || !validateDataMigration(activeDefinition(view.state, predicate.module), recorded.pin.definition).ok) return { ok: false, reason: 'Migration prerequisite changed.' };
            } else if (predicate.kind === 'dm.redefine') {
                if (domain.pins[active.hash]?.packId !== 'chat' || activeDefinition(view.state, predicate.module).pack !== 'chat'
                    || recorded.pin?.packId !== 'chat' || recorded.pin.packVersion !== '0' || recorded.pin.packHash !== null
                    || active.hash !== recorded.decision.previous || predicate.generation <= active.generation
                    || recorded.pin.definition.id !== predicate.module || recorded.pin.definition.pack !== 'chat'
                    || predicate.module !== `pack.chat/${recorded.pin.definition.slug}` || recorded.pin.definition.scope !== 'chat'
                    || hashOf(recorded.pin.definition) !== predicate.hash) return { ok: false, reason: 'Block generation or checked definition changed.' };
                checkedTarget(recorded.pin.definition, view.state);
            } else if (active.hash !== predicate.hash || active.generation !== predicate.generation
                || (predicate.kind === 'dm.attach' ? active.subjects.includes(predicate.subject) : !active.subjects.includes(predicate.subject))) return { ok: false, reason: 'Pin generation or attached subject changed.' };
            if (predicate.kind === 'dm.remove' && (domain.pins[active.hash]?.packId !== 'chat' || activeDefinition(view.state, predicate.module).pack !== 'chat')) return { ok: false, reason: 'This is not a chat block.' };
        }
        const witness = view.query('dataModules.replayInputs', recorded.selector);
        if (hashJson({ source, witness, predicate, decision: recorded.decision }) !== guard.inputHash) return { ok: false, reason: 'Data module prefix prerequisite changed; Re-read this action.' };
        // The conditions this action answered (a kind's, a rule's) are asked again on the prefix: a change before that leaves every
        // answer as it was leaves the action as it was.
        const conds = recorded.decision?.conds ?? [];
        if (conds.length) {
            const definition = activeDefinition(view.state, predicate.module), instance = instanceOf(view.state, predicate.module, predicate.subject);
            const inputs = { ...(recorded.decision.inputs ?? {}), ...(witness.imports ?? {}) };
            for (const record of conds) if (!conditionHolds(definition, record, instance.fields, inputs)) return { ok: false, reason: 'A condition this action answered would now be answered differently; Re-read this action.' };
        }
        return { ok: true };
    } catch { return { ok: false, reason: 'Damaged or unsupported data module pin/guard.' }; }
}
