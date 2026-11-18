// The People page's Portraits rows: each shows what portraits use now and writes back the way the old portrait panel saved it
// (a built-in style, or the chosen custom preset of the saved library; editing the style text moves to that custom preset).
import { DEFAULT_PORTRAIT_COMPOSITION, PORTRAIT_STYLE_PROMPT_LIMIT, PORTRAIT_COMPOSITION_PROMPT_LIMIT, normalizePortraitPromptFormat } from '../../../modules/people/core/core.js';
import { PORTRAIT_THEME_PRESETS, PORTRAIT_CUSTOM_PRESET_LIMIT } from '../../../modules/people/settings/runtime-settings-parts/portrait-preset-constants.js';
import { portraitCustomPreset, portraitCustomPresetLibrary, nextPortraitCustomPresetId } from '../../../modules/people/settings/runtime-settings-parts/portrait-preset-library.js';
import { swRow } from './kit.js';
import { row } from './kit-more.js';

const G = 'Portraits';
const BUILT_IN = Object.entries(PORTRAIT_THEME_PRESETS).filter(([key]) => key !== 'custom');
const FORMATS = [['Structured hybrid', 'hybrid'], ['Comma tags', 'tags'], ['Natural language', 'natural']];
const SAVE_NEW = 'Save as a new preset';
const DELETE = 'Delete this preset';
const customLabel = preset => `Custom · ${preset.name}`;
const cut = (value, limit) => String(value ?? '').slice(0, limit);

/** What portraits use now (the old panel's snapshot): a built-in style's own text, or the chosen custom preset's fields. A bucket with no style yet is Fantasy Anime. */
function current(b) {
  const theme = b.portraitThemePreset === undefined ? 'fantasy_anime' : PORTRAIT_THEME_PRESETS[b.portraitThemePreset] ? b.portraitThemePreset : 'custom';
  const presets = portraitCustomPresetLibrary(b.portraitCustomPresets);
  const active = presets.find(p => p.id === b.portraitCustomPresetId) ?? presets[0];
  const custom = theme === 'custom';
  return {
    theme, presets, active,
    positive: custom ? active.positive : PORTRAIT_THEME_PRESETS[theme].positive,
    negative: custom ? active.negative : PORTRAIT_THEME_PRESETS[theme].negative,
    composition: custom ? active.composition : cut(b.portraitComposition ?? DEFAULT_PORTRAIT_COMPOSITION, PORTRAIT_COMPOSITION_PROMPT_LIMIT),
    promptFormat: custom ? active.promptFormat : normalizePortraitPromptFormat(b.portraitPromptFormat),
    useMood: custom ? active.useMood : b.portraitUseMood !== false,
    useLocation: custom ? active.useLocation : b.portraitUseLocation === true,
  };
}

/** The stored keys for a style `next` (the snapshot's fields): the flat keys every reader uses, and with a custom style its preset in the library. */
function stored(next) {
  const pairs = [['portraitThemePreset', next.theme], ['portraitStylePositive', next.positive], ['portraitStyleNegative', next.negative], ['portraitComposition', next.composition],
    ['portraitPromptFormat', next.promptFormat], ['portraitUseMood', next.useMood], ['portraitUseLocation', next.useLocation]];
  if (next.theme !== 'custom') return pairs;
  const index = next.presets.findIndex(p => p.id === next.active.id);
  const presets = next.presets.map((p, i) => (i === index ? portraitCustomPreset({ ...p, positive: next.positive, negative: next.negative, composition: next.composition, promptFormat: next.promptFormat, useMood: next.useMood, useLocation: next.useLocation }, i) : p));
  return [...pairs, ['portraitCustomPresets', presets], ['portraitCustomPresetId', next.active.id]];
}

// A field change: the style text moves a built-in style to the chosen custom preset (as the old panel's text boxes did); the rest keep the style.
const edit = (field, toCustom = false) => (v, b) => {
  const now = current(b);
  return stored({ ...now, theme: toCustom ? 'custom' : now.theme, [field]: v });
};

function pickStyle(label, b) {
  const now = current(b);
  const built = BUILT_IN.find(([, p]) => p.label === label);
  if (built) return stored({ ...now, theme: built[0], positive: built[1].positive, negative: built[1].negative });
  const preset = now.presets.find(p => customLabel(p) === label);
  return preset ? stored({ ...now, theme: 'custom', active: preset, ...preset }) : null;
}

function presetAction(label, b) {
  const now = current(b);
  if (label === SAVE_NEW) {
    if (now.presets.length >= PORTRAIT_CUSTOM_PRESET_LIMIT) return null;
    const names = new Set(now.presets.map(p => p.name.toLowerCase()));
    let n = now.presets.length + 1;
    while (names.has(`custom ${n}`)) n += 1;
    const made = portraitCustomPreset({ ...now, id: nextPortraitCustomPresetId(now.presets), name: `Custom ${n}` }, now.presets.length);
    return stored({ ...now, theme: 'custom', presets: [...now.presets, made], active: made });
  }
  if (label === DELETE) {
    if (now.theme !== 'custom' || now.presets.length < 2) return null;
    const presets = now.presets.filter(p => p.id !== now.active.id);
    return stored({ ...now, presets, active: presets[0], ...presets[0], theme: 'custom' });
  }
  return null;
}

const DEFAULTS = [['portraitThemePreset', 'fantasy_anime'], ['portraitStylePositive', PORTRAIT_THEME_PRESETS.fantasy_anime.positive], ['portraitStyleNegative', PORTRAIT_THEME_PRESETS.fantasy_anime.negative],
  ['portraitComposition', DEFAULT_PORTRAIT_COMPOSITION], ['portraitPromptFormat', 'hybrid'], ['portraitUseMood', true], ['portraitUseLocation', false], ['portraitSaveToGallery', false]];
const sw = (key, label, field) => row(G, key, 'sw', label, { read: b => current(b)[field], write: edit(field) });

/** The Portraits rows of the People page (Reset People puts the built-in Fantasy Anime style back; the saved custom presets stay). */
export function portraitRows() {
  return [
    swRow(G, 'portraits', 'Generate portraits', 'portraitGenerationEnabled', true),
    row(G, 'stylePreset', 'sel', 'Style preset', {
      hint: 'Fantasy Anime is the built-in one', reset: DEFAULTS, optionsOf: b => [...BUILT_IN.map(([, p]) => p.label), ...current(b).presets.map(customLabel)],
      read: b => { const now = current(b); return now.theme === 'custom' ? customLabel(now.active) : PORTRAIT_THEME_PRESETS[now.theme].label; }, write: pickStyle,
    }),
    row(G, 'prompt', 'area', 'Prompt', { hint: 'The style text added to every portrait', read: b => current(b).positive, write: (v, b) => edit('positive', true)(cut(v, PORTRAIT_STYLE_PROMPT_LIMIT), b) }),
    row(G, 'leaveOut', 'area', 'Leave out', { read: b => current(b).negative, write: (v, b) => edit('negative', true)(cut(v, PORTRAIT_STYLE_PROMPT_LIMIT), b) }),
    row(G, 'composition', 'txt', 'Composition', { read: b => current(b).composition, write: (v, b) => edit('composition')(cut(v, PORTRAIT_COMPOSITION_PROMPT_LIMIT), b) }),
    row(G, 'promptFormat', 'sel', 'Prompt format', {
      hint: 'A character card can recommend one', options: FORMATS.map(f => f[0]), read: b => FORMATS.find(f => f[1] === current(b).promptFormat)[0],
      write: (v, b) => { const hit = FORMATS.find(f => f[0] === v); return hit ? edit('promptFormat')(hit[1], b) : null; },
    }),
    row(G, 'savedPortraitPresets', 'btn', 'Saved portrait presets', {
      options: [SAVE_NEW, DELETE], hintOf: b => `${current(b).presets.length} of ${PORTRAIT_CUSTOM_PRESET_LIMIT} saved · pick one in Style preset`, read: () => null, write: null, act: presetAction,
    }),
    sw('useTheCurrentMood', 'Use the current mood', 'useMood'),
    sw('useTheCurrentPlace', 'Use the current place', 'useLocation'),
    swRow(G, 'alsoSaveToSillytavernSGa', 'Also save to SillyTavern’s gallery', 'portraitSaveToGallery', false),
  ];
}
