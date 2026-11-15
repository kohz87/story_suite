// Reading a card entry's JSON text as data, shared by the portraits and settings readers.

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const parse = text => {
    try {
        return JSON.parse(String(text ?? '').replace(/^﻿/, ''));
    } catch {
        return undefined;
    }
};
