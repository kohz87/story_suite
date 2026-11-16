// The additive upgrade of an older Skills block with the missing slots.
import { DM_LIMITS as L } from '../../schema.js';
import { validateDataModules, dataModuleDefaults, dataModuleHash } from '../../check.js';
import { copy, atPath } from '../../interpreter.js';
import { activeDefinition } from '../../adapters.js';
import { rpg, rawDefinition, instancePath } from '../shared.js';

// The additive upgrade of a Skills block made before the extra slots (five slots, no `sig`; templates.js grownSkills): when it is first needed (a learn line once the level
// has opened a slot the block lacks, or a cast member's skills to mark), the block's pin is replaced by the same definition with the missing slots and the mark added.
// Nothing is removed or renamed; the fields it adds start at their defaults and every existing skill keeps its rank and practice. It is part of the action that needed it:
// its ops carry the new pin and a Re-read plans it again from the same prefix, so rebuild, Re-read and reload all give the same block (the pack is not asked).
// → the new definition (the draft holds it), or null when nothing was missing.
export function growSkills(ctx, prefix, draft, module) {
    const domain = prefix.domains.dataModules, old = domain?.active?.[module], current = activeDefinition(prefix, module);
    if (!old || !current || current.role !== 'skills' || current.pack !== 'chat' || domain.pins[old.hash]?.packId !== 'chat') return null;
    const grown = rpg().grownSkills(rawDefinition(current));
    if (!grown) return null;
    const catalog = Object.keys(domain.active).map(id => activeDefinition(prefix, id)).filter(Boolean);
    const checked = validateDataModules([grown], { packId: 'chat', capabilities: ['data-modules-v1', 'story-director'], definitions: catalog });
    if (!checked.ok) return null;
    const definition = checked.definitions[0], hash = dataModuleHash(definition);
    if (Object.keys(draft.pins).length >= L.pins + 1) return null;
    draft.pins[hash] = copy({ definition, packId: 'chat', packVersion: '0', packHash: null, interpreter: 1 });
    draft.active[module] = { ...copy(old), hash, generation: Math.max(ctx.rev, old.generation + 1) };
    const fields = atPath(draft, instancePath(module, 'chat')).fields;
    for (const [key, value] of Object.entries(dataModuleDefaults(definition.state))) if (!Object.hasOwn(fields, key)) fields[key] = value;
    if (old.hash !== hash && !Object.values(draft.active).some(entry => entry.hash === old.hash)) delete draft.pins[old.hash];
    return definition;
}
