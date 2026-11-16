// The macro's name, its length cap and the paths the old macro engine can read.

export const MACRO_NAME = 'sb';
export const MACRO_MAX = 300;
// What the old macro engine can read (one registration each, no fallback).
export const LEGACY_PATHS = Object.freeze(['scene.place', 'scene.time', 'scene.date', 'scene.weather', 'scene.present', 'money', 'money.text',
    'party.me.name', 'party.me.level', 'party.me.xp', 'party.me.health', 'party.me.mana', 'party.me.stamina']);
