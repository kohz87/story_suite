// The job: checking and normalizing one pack from its text or parsed value (the three rounds: size and JSON, plain safe data, fields).

import { LIMITS } from '../limits.js';
import { byteLength, checkPlain } from '../safety.js';
import { dataModulesPackHash } from '../../modules/data-modules/check.js';
import { HOST_VERSION, SUITE_VERSION, fail, isObject } from '../validate/core.js';
import { normalize } from './normalize.js';

/**
 * Checks and normalizes one pack. Nothing here touches settings or state.
 */
export function validatePack(input, { hostVersion = HOST_VERSION, suiteVersion = SUITE_VERSION, capabilities = null, limits = LIMITS, dataModuleDefinitions = [], readableConditions = true } = {}) {
    let value = input;
    if (typeof input === 'string') {
        if (byteLength(input) > limits.packBytes) return fail('TOO_LARGE', '', `The pack is larger than ${Math.round(limits.packBytes / 1024)} KB.`);
        const text = input.replace(/^﻿/, '').trim();
        if (!text) return fail('NOT_JSON', '', 'The pack is empty.');
        try {
            value = JSON.parse(text);
        } catch (error) {
            return fail('NOT_JSON', '', `The pack is not valid JSON (${error.message}).`);
        }
    }
    if (!isObject(value)) return fail('NOT_OBJECT', '', 'A pack is one JSON object: { "id": …, "version": …, "requires": …, "content": … }.');
    const unsafe = checkPlain(value, limits);
    if (unsafe.length) return { ok: false, errors: unsafe };
    // Detached plain copy: nothing the caller still holds can change the pack later.
    const raw = JSON.parse(JSON.stringify(value));
    if (byteLength(JSON.stringify(raw)) > limits.packBytes) return fail('TOO_LARGE', '', `The pack is larger than ${Math.round(limits.packBytes / 1024)} KB.`);

    const errors = [], warnings = [];
    const add = (code, path, message) => { if (errors.length < limits.errors) errors.push({ code, path, message }); };
    const warn = (code, path, message) => { if (warnings.length < limits.errors) warnings.push({ code, path, message }); };
    const pack = normalize(raw, { add, warn, hostVersion, suiteVersion, capabilities, limits, dataModuleDefinitions, readableConditions });
    if (errors.length) return { ok: false, errors, ...(warnings.length ? { warnings } : {}) };
    const result = { ok: true, pack, raw, ...(warnings.length ? { warnings } : {}) };
    if (pack.content.dataModules !== undefined) {
        // Hash the checked snapshot, before a consumer can edit its detached result.
        Object.defineProperty(result, 'packHash', { value: dataModulesPackHash(pack), enumerable: false, configurable: true });
    }
    return result;
}
