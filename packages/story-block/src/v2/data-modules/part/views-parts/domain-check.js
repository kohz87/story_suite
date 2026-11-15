// The check of the data-modules domain's shape: pins, active modules and their instances.
import { DM_LIMITS as L, dmObject } from '../../schema.js';
import { scalarHolds } from '../../interpreter.js';
import { instanceOf } from '../../adapters.js';
import { hashOf, sizeOf } from '../shared.js';

export function validateDomain(domain) {
    if (!dmObject(domain) || Object.keys(domain).some(key => !['pins', 'active', 'instances', 'perReply', 'boardFlags'].includes(key))
        || ['pins', 'active', 'instances', 'perReply'].some(key => !dmObject(domain[key])) || (domain.boardFlags !== undefined && !dmObject(domain.boardFlags))) return ['Invalid dataModules domain.'];
    const errors = [];
    if (Object.keys(domain.pins).length > L.pins || sizeOf(domain.pins) > L.pinsBytes) errors.push('Retained pins exceed budget.');
    for (const [module, active] of Object.entries(domain.active)) {
        const definition = domain.pins[active.hash]?.definition;
        if (!definition || definition.id !== module || hashOf(definition) !== active.hash || !Number.isSafeInteger(active.generation)
            || active.generation < 1 || !Array.isArray(active.subjects) || active.subjects.length > L.subjects || new Set(active.subjects).size !== active.subjects.length) {
            errors.push('Invalid active data module.'); continue;
        }
        const prefix = { domains: { dataModules: domain } };
        for (const subject of active.subjects) {
            const instance = instanceOf(prefix, module, subject);
            if (!instance || sizeOf(instance) > L.instanceBytes || Object.keys(instance.fields).length !== Object.keys(definition.state).length
                || Object.entries(definition.state).some(([key, schema]) => !scalarHolds(schema, instance.fields[key]))
                || Object.keys(instance.offers).length + Object.keys(instance.settled).length > L.offers) errors.push('Invalid data module instance.');
        }
    }
    return errors;
}
